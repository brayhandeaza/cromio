import EventEmitter from 'events';
import PQueue from 'p-queue';
import zlib from 'zlib';
import TLS from 'tls';
import net from 'net';
import { Buffer } from 'buffer';
import { ip } from 'address';
import { ClientFromServerType, TriggerCallback, ServerContructorType, MessageDataType, SubscriptionCallback, SubscriptionDefinitionType, TriggerDefinitionType, MiddlewareContextType, TriggerHandler, MiddlewareCallback, LogsType, ServerExtension, TSLOptions } from '../../types';
import { ALLOW_MESSAGE } from '../../constants';
import { Extensions } from './Extensions';
import { calculateConcurrency, safeStringify } from '../../helpers';


export class Server<TInjected extends object = {}> {
    private extensions!: Extensions<TInjected>;
    private port: number;
    private logs: boolean;
    private triggers = new Map<string, TriggerHandler>();
    private globalMiddlewares: TriggerCallback[] = [];
    private events: SubscriptionDefinitionType = new Map();
    private subscriptions = new Map<string, Map<string, TLS.TLSSocket | net.Socket>>();
    private clients = new Map<string, ClientFromServerType>();
    public client: TLS.TLSSocket | net.Socket | null = null;
    public server: TLS.TLSSocket | net.Socket | null = null;
    private eventEmitter = new EventEmitter();
    private tls: TSLOptions | null = null;
    private Logs = {
        trigger: ({ trigger, language, ip }: LogsType) => {
            console.log(`✅ Logs(RPC): trigger="${trigger}" language="${language}" ip="${ip}" message="Request received and processed successfully."`);
        },
        error: ({ trigger, language, ip, message }: LogsType) => {
            console.log(`❌ Logs(Error): trigger="${trigger}" language="${language}" ip="${ip}" message="${message}"`);
        }
    }
    public event = {
        emit: (event: string, data: any) => this.emitEvent(event, data),
        subscribe: (event: string, callback: (data: any) => void) => this.subscribe(event, callback),
    };

    constructor({ port = 1000, clients = [], logs = true, tls }: ServerContructorType) {
        this.port = port;
        this.logs = logs;
        this.tls = tls || null;


        clients.forEach(client => this.clients.set(client.secretKey, client));
        this.extensions = new Extensions();

    }


    public start() {
        if (this.tls?.key && this.tls?.cert) {
            const tlsOptions = {
                key: Buffer.from(this.tls.key || ''),
                cert: Buffer.from(this.tls.cert || ''),
            };
            const server = TLS.createServer(tlsOptions, (socket) => {
                this.client = socket;

                socket.on('data', async (data) => this.handleIncomingData(socket, data));
                socket.on('error', (err) => this.break(err));
                socket.on('end', () => this.handleDisconnect(socket));
            });

            server.listen(this.port, () => {
                this.extensions.triggerHook('onStart', {
                    server: this
                });

                console.log(`🔐 TLS Server listening locally on: tls=true host=localhost port=${this.port}`);
                console.log(`🔐 TLS Server listening on: tls=true host=${ip()} port=${this.port}\n`);
            });
        } else {
            const server = net.createServer(socket => {
                this.client = socket;
                socket.on('data', async (data) => this.handleIncomingData(socket, data));
                socket.on('error', (err) => this.break(err));
                socket.on('end', () => this.handleDisconnect(socket));
            });

            server.listen(this.port, () => {
                this.extensions.triggerHook('onStart', {
                    server: this
                });

                console.log(`🌐 TPC Server listening locally on: tls='${this.tls}' host=localhost port=${this.port}`);
                console.log(`🌐 TPC Server listening on: tls='${this.tls}' host=${ip()} port=${this.port}\n`);
            });
        }
    }

    public addExtension<TNew extends {}>(...exts: ServerExtension<TNew>[]): asserts this is Server<TInjected & TNew> & TNew {
        exts.forEach(ext => {
            if (ext.injectProperties) {
                const injected = ext.injectProperties(this as any); // We assert `any` here internally
                Object.assign(this, injected);
            }

            this.extensions.useExtension(ext)
        });
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
        triggers.forEach((callback, name) => {
            this.addTrigger(name, callback);
        })

    }

    public registerSubscriptionDefinition({ subscriptions }: { subscriptions: SubscriptionDefinitionType }) {
        this.events = new Map([...this.events, ...subscriptions]);
    }

    public addTrigger(name: string, ...callbacks: MiddlewareCallback[]) {
        this.triggers.set(name, async (payload, credentials) => {
            const context: MiddlewareContextType = {
                server: this,
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


    // ###### PRIVATE METHODS ######
    // #############################

    private break(err: any) {
        this.extensions.triggerHook("onError", {
            server: this,
        });
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

    private async handleIncomingData(socket: TLS.TLSSocket | net.Socket, data: Buffer) {
        try {
            const request: MessageDataType = JSON.parse(data.toString());
            const { trigger, payload, uuid, type, credentials } = request;

            this.extensions.triggerHook("onRequest", {
                server: this,
                request: {
                    trigger,
                    type,
                    payload,
                    client: {
                        uuid,
                        ...credentials
                    }
                },
            });

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

    private handleDisconnect(socket: TLS.TLSSocket | net.Socket) {
        this.extensions.triggerHook("onStop", {
            server: this
        });

        this.removeSocketFromAllEvents(socket);
    }

    private async handleSUBSCRIBE(trigger: string, socket: TLS.TLSSocket | net.Socket, uuid: string) {
        if (!this.subscriptions.has(trigger)) {
            this.subscriptions.set(trigger, new Map());
        }
        this.subscriptions.get(trigger)!.set(uuid, socket);
        if (this.logs) console.log(`🆕 Subscribed to event '${trigger}'`);
        this.safeWrite(socket, { initialized: trigger });
    }

    private async handleEVENT(trigger: string, payload: any, socket: TLS.TLSSocket | net.Socket, uuid: string, credentials: ClientFromServerType) {
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

    private async handleRPC(trigger: string, payload: any, socket: TLS.TLSSocket | net.Socket, credentials: ClientFromServerType) {
        try {
            const handler = this.triggers.get(trigger);
            if (!handler) {
                const msg = `Schema '${trigger}' not found on server side.`;
                throw new Error(msg);
            }

            const result = await handler(payload, { ...credentials, socket });
            if (!result) {
                this.safeWrite(socket, result);
            }

        } catch (error: any) {
            this.safeWrite(socket, { error: error.toString() });
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
        const concurrency = Math.max(1, Math.min(subscribers.size, calculateConcurrency(memoryUsedMB)));
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

    private rejectRequest(socket: TLS.TLSSocket | net.Socket, message: string) {
        this.extensions.triggerHook("onError", {
            server: this,
        });
        this.safeWrite(socket, { error: message });
    }

    private safeWrite(socket: TLS.TLSSocket | net.Socket, message: any) {
        if (message) {
            const buffer = Buffer.from(safeStringify(message), "utf8");
            const lengthBuffer = Buffer.alloc(4);
            lengthBuffer.writeUInt32BE(buffer.length, 0);            

            socket.write(Buffer.concat([lengthBuffer, buffer]));           
        }
    }

    private removeSocketFromAllEvents(socket: TLS.TLSSocket | net.Socket) {
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
