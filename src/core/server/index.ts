// ./src/core/server/index.ts

import EventEmitter from 'events';
import net from 'net';
import { Buffer } from 'buffer';
import { ip } from 'address';
import { parse } from 'stack-trace';
import {
    ClientFromServerType, TriggerCallback, ServerContructorType,
    MessageDataType, SubscriptionCallback, SubscriptionDefinitionType,
    TriggerDefinitionType, MiddlewareContextType,
    TriggerHandler, MiddlewareCallback,
    LogsType
} from '../../types';
import { ALLOW_MESSAGE } from '../../constants';
import PQueue from 'p-queue';

export class Server {
    private port: number;
    private logs: boolean;
    private triggers = new Map<string, TriggerHandler>();
    private globalMiddlewares: TriggerCallback[] = [];
    private events: SubscriptionDefinitionType = new Map();
    private subscriptions = new Map<string, Map<string, net.Socket>>();
    private clients = new Map<string, ClientFromServerType>();
    private eventEmitter = new EventEmitter();
    private Logs = {
        trigger: ({ trigger, language, ip }: LogsType) => {
            console.log(`✅ Logs(RPC): trigger="${trigger}" language="${language}" ip="${ip}" message="Request received and processed successfully."`);
        },
        error: ({ trigger, language, ip, message }: LogsType) => {
            console.log(`❌ Error: trigger="${trigger}" language="${language}" ip="${ip}" message="${message}"`);
        }
    }

    public event = {
        emit: (event: string, data: any) => this.emitEvent(event, data),
        subscribe: (event: string, callback: (data: any) => void) => this.subscribe(event, callback),
    };

    constructor({ port = 1000, clients = [], logs = true }: ServerContructorType) {
        this.port = port;
        this.logs = logs;
        clients.forEach(client => this.clients.set(client.secretKey, client));
    }

    public addMiddleware(callback: TriggerCallback) {
        this.globalMiddlewares.push(callback);
    }

    public addGlobalMiddleware(...callbacks: TriggerCallback[]) {
        this.globalMiddlewares.push(...callbacks);
    }

    public subscribe(event: string, callback: SubscriptionCallback) {
        this.events.set(event, callback);
        if (this.logs) console.log(`📥 Registered server-side event handler for '${event}'`);
    }


    public async trigger(name: string, payload: any, credentials: ClientFromServerType) {
        const handler = this.triggers.get(name);
        if (!handler) throw new Error(`Trigger '${name}' is not registered.`);
        return await handler(payload, credentials);
    }

    public registerTriggerDefinition({ triggers }: { triggers: TriggerDefinitionType }) {
        this.triggers = new Map([...this.triggers, ...triggers]);
    }

    public registerSubscriptionDefinition({ subscriptions }: { subscriptions: SubscriptionDefinitionType }) {
        this.events = new Map([...this.events, ...subscriptions]);
    }

    public start() {
        const server = net.createServer(socket => {
            socket.on('data', async (data) => this.handleIncomingData(socket, data));
            socket.on('end', () => this.handleDisconnect(socket));
        });

        server.listen(this.port, () => {
            console.log(`🔋 Server listening locally on: host=localhost port=${this.port}`);
            console.log(`🔋 Server listening on: host=${ip()} port=${this.port}\n`);
        });
    }

    public addTrigger(name: string, ...callbacks: MiddlewareCallback[]) {
        this.triggers.set(name, async (payload, credentials) => {
            const context: MiddlewareContextType = {
                trigger: name,
                credentials,
                body: payload,
                socket: credentials.socket,
                response: (data: any) => {
                    if (credentials.socket) {
                        this.safeWrite(credentials.socket, data);
                    } else {
                        console.warn('⚠️ Cannot respond: socket is undefined.');
                    }
                }
            };

            await this.runMiddlewareChain([...this.globalMiddlewares, ...callbacks], context);
        });
    }

    private break(err: any) {
        if (err instanceof Error) {
            return err;
        } else if (typeof err === 'string') {
            return new Error(err);
        } else if (typeof err === 'object' && err !== null) {
            return new Error(JSON.stringify(err));
        } else {
            return new Error('Unknown error');
        }
    }

    private async runMiddlewareChain(callbacks: MiddlewareCallback[], context: MiddlewareContextType): Promise<void> {
        for (const callback of callbacks) {
            let responded = false;
            let responsePayload: any = null;

            try {
                await callback({
                    ...context,
                    response: (msg: any) => {
                        responded = true;
                        responsePayload = msg;
                    },
                });
            } catch (err: any) {
                const error = this.break(err);

                if (this.logs) this.Logs.error({
                    trigger: context.trigger,
                    language: context.credentials.language,
                    ip: context.credentials.ip,
                    message: error.message
                });

                context.response({ error: error.message });
                return;
            }

            if (responded) {
                if (this.logs) this.Logs.trigger({
                    trigger: context.trigger,
                    language: context.credentials.language,
                    ip: context.credentials.ip,
                });
                context.response(responsePayload);
                return;
            }
        }
    }

    private async handleIncomingData(socket: net.Socket, data: Buffer) {
        try {
            const request: MessageDataType = JSON.parse(data.toString());
            const { trigger, payload, uuid, type, credentials } = request;

            const auth = this.verifyClient(credentials, trigger);
            if (!auth.passed) return this.rejectRequest(socket, auth.message);

            switch (type) {
                case ALLOW_MESSAGE.RPC: return this.handleRPC(trigger, payload, socket, credentials);
                case ALLOW_MESSAGE.EVENT: return this.handleEVENT(trigger, payload, socket, uuid, credentials);
                case ALLOW_MESSAGE.SUBSCRIBE: return this.handleSUBSCRIBE(trigger, socket, uuid);
                default: return this.safeWrite(socket, { error: 'Invalid message type.' });
            }
        } catch (err: any) {
            this.safeWrite(socket, { error: err.toString() });
        }
    }

    private handleDisconnect(socket: net.Socket) {
        this.removeSocketFromAllEvents(socket);
    }

    private async handleSUBSCRIBE(trigger: string, socket: net.Socket, uuid: string) {
        if (!this.subscriptions.has(trigger)) {
            this.subscriptions.set(trigger, new Map());
        }
        this.subscriptions.get(trigger)!.set(uuid, socket);
        if (this.logs) console.log(`🆕 Subscribed to event '${trigger}'`);
        this.safeWrite(socket, { initialized: trigger });
    }

    private async handleEVENT(trigger: string, payload: any, socket: net.Socket, uuid: string, credentials: ClientFromServerType) {
        const callback = this.events.get(trigger);
        const verified = this.verifyEvent(!!callback, credentials, trigger, uuid);
        if (!verified.passed) return this.safeWrite(socket, { error: verified.message });

        if (!this.subscriptions.has(trigger)) {
            this.subscriptions.set(trigger, new Map());
        }

        this.subscriptions.get(trigger)!.set(credentials.ip, socket);
        callback!(payload);
        this.safeWrite(socket, { subscribed: trigger });
    }

    private async handleRPC(trigger: string, payload: any, socket: net.Socket, credentials: ClientFromServerType) {
        try {
            const handler = this.triggers.get(trigger);
            if (!handler) {
                const msg = `Schema '${trigger}' not found on server side.`;
                return this.safeWrite(socket, { error: msg });
            }

            const result = await handler(payload, { ...credentials, socket });
            this.safeWrite(socket, result);
        } catch (error) {
            console.log({ error });
        }
    }

    private emitEvent(event: string, data: any) {
        this.eventEmitter.emit(event, data);
        const subscribers = this.subscriptions.get(event);
        if (!subscribers?.size) {
            console.log(`⚠️ No clients subscribed to '${event}'.`);
            return;
        }

        const memoryUsedMB = process.memoryUsage().heapUsed / 1024 / 1024;
        const concurrency = Math.max(1, Math.min(subscribers.size, this.calculateConcurrency(memoryUsedMB)));
        const queue = new PQueue({ concurrency });

        if (this.logs)
            console.log(`📡 Emitting '${event}' to ${subscribers.size} clients. (concurrency=${concurrency}, heap=${memoryUsedMB.toFixed(2)} MB)`);

        subscribers.forEach(socket => {
            queue.add(() => this.safeWrite(socket, {
                type: ALLOW_MESSAGE.EVENT,
                trigger: event,
                payload: data,
            }));
        });
    }


    private rejectRequest(socket: net.Socket, message: string) {
        this.safeWrite(socket, { error: message });
    }

    private safeStringify(input: any): string {
        try {
          return JSON.stringify(input).replaceAll(/{}\s*/g, '').trim();
        } catch (err) {
          return String(input);
        }
      }
      

    private safeWrite(socket: net.Socket, message: any): Promise<void> {
        return new Promise((resolve, reject) => {
            socket.write(Buffer.from(this.safeStringify(message)), err => {
                if (err) return reject(err);
                resolve();
            });
        });
    }

    private calculateConcurrency(memoryUsedMB: number): number {
        if (memoryUsedMB < 100) return 10;
        if (memoryUsedMB < 200) return 7;
        if (memoryUsedMB < 300) return 5;
        if (memoryUsedMB < 400) return 3;
        return 1;
    }

    private removeSocketFromAllEvents(socket: net.Socket) {
        this.subscriptions.forEach((subscribers, event) => {
            for (const [id, clientSocket] of subscribers.entries()) {
                if (clientSocket === socket) {
                    subscribers.delete(id);
                }
            }
            if (subscribers.size === 0) {
                this.subscriptions.delete(event);
            }
        });
    }


    private verifyClient(credentials: ClientFromServerType, schema: string): { passed: boolean, message: string } {
        if (!credentials.secretKey) {
            return {
                passed: false,
                message: `🚫 Missing secretKey for schema=${schema}, language=${credentials.language}, ip=${credentials.ip}`,
            };
        }

        const client = this.clients.get(credentials.secretKey);
        if (!client && this.clients.size) {
            return {
                passed: false,
                message: `🚫 Unauthorized client for schema=${schema}, ip=${credentials.ip}`,
            };
        }

        if (client) {
            if (client.language !== credentials.language) {
                return {
                    passed: false,
                    message: `🚫 Invalid language. Expected '${client.language}', got '${credentials.language}'`,
                };
            }
            if (client.ip && client.ip !== credentials.ip) {
                return {
                    passed: false,
                    message: `🚫 Invalid IP. Expected '${client.ip}', got '${credentials.ip}'`,
                };
            }
        }

        return { passed: true, message: "" };
    }

    private verifyEvent(hasCallback: boolean, credentials: ClientFromServerType, event: string, clientId: string): { passed: boolean, message: string } {
        if (!hasCallback) {
            const msg = `🚫 Event not found: '${event}' from ip=${credentials.ip}, client=${clientId}`;
            if (this.logs) console.log(msg);
            return { passed: false, message: msg };
        }

        const msg = `📡 Incoming Event: '${event}' from ip=${credentials.ip}, client=${clientId}`;
        return { passed: true, message: msg };
    }
}
