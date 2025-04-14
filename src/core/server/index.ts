import EventEmitter from 'events';
import net from 'net';
import { Buffer } from 'buffer';
import { ip } from 'address';
import { ClientFromServerType, TriggerCallback, ServerContructorType, MessageDataType, SubscriptionCallback, SubscriptionDefinitionType } from '../../types';
import { ALLOW_MESSAGE } from '../../constants';
import PQueue from 'p-queue';

export class Server {
    private port: number;
    private triggers: Map<string, TriggerCallback> = new Map();
    private events: SubscriptionDefinitionType = new Map();
    private clients: Map<string, ClientFromServerType> = new Map();
    private eventEmitter: EventEmitter = new EventEmitter();
    private subscriptions: Map<string, Map<string, net.Socket>> = new Map();
    private logs: boolean;
    public event: {
        emit: (event: string, data: any) => void,
        subscribe: (event: string, callback: (data: any) => void) => void,
    }

    constructor({ port = 1000, clients = [], logs = true }: ServerContructorType) {
        this.port = port;
        this.logs = logs;

        this.clients = new Map();
        clients.forEach((client) => {
            this.clients.set(client.secretKey, client);
        });

        this.event = {
            emit: (event: string, data: any) => this.emitEvent(event, data),
            subscribe: (event: string, callback: (data: any) => void) => this.onEvent(event, callback),
        }

    }

    public onEvent(event: string, callback: SubscriptionCallback): void {
        this.events.set(event, callback);

        if (this.logs)
            console.log(`📥 Registered server-side event handler for '${event}'`);
    }


    public addTrigger(name: string, callback: TriggerCallback): void {
        this.triggers.set(name, callback);
    }

    public registerTriggerDefinition(triggerDefinition: Map<string, TriggerCallback>): void {
        this.triggers = new Map([...this.triggers, ...triggerDefinition]);
    }

    public registerSubscriptionDefinition(subscriptionDefinition: SubscriptionDefinitionType): void {        
        this.events = new Map([...this.events, ...subscriptionDefinition]);
    }
    public start(): void {
        const server = net.createServer(socket => {
            socket.on('data', (data) => {
                try {
                    const { trigger, payload, uuid, type, credentials }: MessageDataType = JSON.parse(data.toString());
                    const clientAuthorized = this.verifyClient(credentials, trigger);

                    if (!clientAuthorized.passed) {
                        const buffer = Buffer.from(JSON.stringify({
                            error: "Client not authorized to access this server",
                            client: credentials,
                        }));

                        return socket.write(buffer);
                    }

                    if (type === ALLOW_MESSAGE.RPC) {
                        const callback = this.getCallback(trigger);
                        if (!callback) {
                            console.log(`🚫 Request failed: schema=${trigger} language=${credentials.language} ip=${credentials.ip} message="Requested schema '${trigger}' does not exist on the server. Ensure it has been registered correctly."`);

                            const buffer = Buffer.from(JSON.stringify({
                                error: `Schema '${trigger}' not found on server side. Please check the schema name.`,
                            }));

                            return socket.write(buffer);
                        }

                        if (this.logs)
                            this.showLogs({ trigger, credentials });


                        const result = callback(payload);
                        const buffer = Buffer.from(JSON.stringify(result));
                        socket.write(buffer);

                    } else if (type === ALLOW_MESSAGE.EVENT) {
                        if (!this.subscriptions.has(trigger)) {
                            this.subscriptions.set(trigger, new Map());
                        }

                        const subscription = this.subscriptions.get(trigger)!;
                        subscription.set(credentials.ip, socket);

                        const callback = this.events.get(trigger)!;
                        const { passed, message } = this.verifyEvent(!!callback, credentials, trigger, uuid);

                        if (passed) {
                            callback(payload);
                            socket.write(Buffer.from(JSON.stringify({ subscribed: trigger })));

                        } else {
                            const buffer = Buffer.from(JSON.stringify({ error: message }));
                            socket.write(buffer);
                        }

                    } else if (type === ALLOW_MESSAGE.SUBSCRIBE) {
                        if (!this.subscriptions.has(trigger)) {
                            this.subscriptions.set(trigger, new Map());
                        }

                        const subscription = this.subscriptions.get(trigger)!;
                        subscription.set(uuid, socket);

                        if (this.logs) {
                            console.log(`🆕 Event '${trigger}' initialized for future subscriptions.`);
                        }

                        socket.write(Buffer.from(JSON.stringify({ initialized: trigger })));
                    }

                } catch (err: any) {
                    socket.write(`Error: ${err.message}`);
                }

            });

            socket.on("end", (data: any) => {
                this.removeSocketFromAllEvents(socket);
                console.log('Client disconnected');
            });
        });

        server.listen(this.port, () => {
            console.log(`🔋 Server listening loacally on: host=localhost port=${this.port}`);
            console.log(`🔋 Server listening on: host=${ip()} port=${this.port}\n`);
        });
    }

    private emitEvent(event: string, data: any): void {
        this.eventEmitter.emit(event, data);

        const subscribers = this.subscriptions.get(event);
        if (subscribers && subscribers.size > 0) {
            const concurrency = Math.min(10, subscribers.size); // Limit to max 10 concurrent writes
            const dynamicQueue = new PQueue({ concurrency });

            if (this.logs)
                console.log(`📡 Event '${event}' emitted to ${subscribers.size} clients (concurrency: ${concurrency}). Data:`, data);

            subscribers.forEach((socket) => {
                dynamicQueue.add(() => {
                    return new Promise<void>((resolve, reject) => {
                        try {
                            const message = JSON.stringify({
                                type: ALLOW_MESSAGE.EVENT,
                                event,
                                data,
                            });

                            socket.write(Buffer.from(message), (err) => {
                                if (err) {
                                    console.warn(`❌ Failed to send event '${event}' to client.`);
                                    return reject(err);
                                }
                                resolve();
                            });
                        } catch (error) {
                            console.error(`❌ Error sending event to client:`, error);
                            reject(error);
                        }
                    });
                });
            });

        } else {
            console.log(`⚠️ Event '${event}' not found. No clients subscribed to this event.`);
        }
    }

    private removeSocketFromAllEvents(socket: net.Socket): void {
        this.subscriptions.forEach((subscribers, event) => {
            for (const [clientId, clientSocket] of subscribers.entries()) {
                if (clientSocket === socket) {
                    subscribers.delete(clientId);
                    break;
                }
            }

            // Clean up if no more subscribers for this event
            if (subscribers.size === 0) {
                this.subscriptions.delete(event);
            }
        });
    }

    private showLogs({ trigger, credentials }: { trigger: string, credentials: ClientFromServerType }): void {
        console.log(`✅ Request received: schema=${trigger} language=${credentials.language} ip=${credentials.ip}`);
    }

    private getCallback(name: string): TriggerCallback | undefined {
        return this.triggers.get(name);
    }

    private verifyClient(credentials: ClientFromServerType, schema: string): { passed: boolean, message: string } {
        if (!credentials.secretKey)
            return {
                passed: false,
                message: `🚫 Authentication failed: schema=${schema} language=${credentials.language} ip=${credentials.ip} message=""The 'secretKey' you provided is incorrect or missing."`
            };

        const client = this.clients.get(credentials.secretKey);
        if (!client && this.clients.size! > 0)
            return {
                passed: false,
                message: `🚫 Authentication failed: schema=${schema} language=${credentials.language} ip=${credentials.ip} message="Client did not provide valid credentials or failed authentication checks."`
            };

        if (client) {
            if (client.language !== credentials.language)
                return {
                    passed: false,
                    message: `🚫 Authentication failed: schema=${schema} language=${credentials.language} ip=${credentials.ip} message="Client is only allowed access from '${client.language}', but the request was made using '${credentials.language}'"`
                };

            if (client.ip !== credentials.ip && client.ip !== undefined)
                return {
                    passed: false,
                    message: `🚫 Authentication failed: schema=${schema} language=${credentials.language} ip=${credentials.ip} message="Client is only allowed access from '${client.ip}', but the request was made from '${credentials.ip}'"`
                }
        }

        return {
            passed: true,
            message: ""
        };
    }
    private verifyEvent(isSubbscribed: boolean, credentials: ClientFromServerType, event: string, clientId: string): { passed: boolean, message: string } {
        if (!isSubbscribed) {
            const message = `🚫 Unsubscribe Event: event='${event}' ip=${credentials.ip} client=${clientId} message="No event named '${event}' is registered on the server."`

            if (this.logs)
                console.log(message);

            return {
                passed: false,
                message
            };
        }

        const message = `📡 Incoming Event: event='${event}' ip=${credentials.ip} client=${clientId} client=${clientId}`
        return {
            passed: true,
            message
        };
    }
}