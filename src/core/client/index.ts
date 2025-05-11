import net from 'net';
import TLS from 'tls';
import shortUUID from 'short-uuid';
import zlib from 'zlib';
import { ip } from 'address';
import { CredentialsType, EncodingType, MessageDataType, ClientPluginsType, SubscriptionDefinitionType, ServerOptions, ClientConfig } from '../../types';
import { ALLOW_MESSAGE, DECODER, LOCALHOST, PLATFORM } from '../../constants';
import { Buffer } from 'buffer';


export class Client {
    private clientId: string = shortUUID.generate();
    private decoder: EncodingType;
    private credentials: CredentialsType | undefined;
    private eventSockets: Map<string, net.Socket> = new Map();
    private plugins: Map<string, ClientPluginsType> = new Map();
    private client: TLS.TLSSocket | net.Socket = new net.Socket();
    private servers: ServerOptions[] = [];
    private currentServerIndex: number = 0;


    public event: {
        emit: (event: string, data: any) => void,
        subscribe: (event: string, callback: (data: any) => void) => void,
        unsubscribe: (event: string) => void,
        registerSubscriptionDefinition: ({ subscriptions, subscribe }: { subscriptions: SubscriptionDefinitionType, subscribe?: Function }) => void
    }


    constructor({ decoder = DECODER.BUFFER, servers }: ClientConfig) {
        this.decoder = decoder;
        servers.forEach((server) => {
            this.servers.push(server);
        });

        this.event = {
            emit: (event: string, data: any) => this.emit(event, data),
            subscribe: (event: string, callback: (data: any) => void) => this.subscribe(event, callback),
            unsubscribe: (event: string) => this.unsubscribe(event),
            registerSubscriptionDefinition: ({ subscriptions: subscriptionDefinition, subscribe }: { subscriptions: SubscriptionDefinitionType, subscribe?: Function }) => this.registerSubscriptionDefinition(subscriptionDefinition)
        }
    }

    private getNextServer(): ServerOptions {
        const server = this.servers[this.currentServerIndex];
        this.currentServerIndex = (this.currentServerIndex + 1) % this.servers.length;
        return server;
    }


    public addPlugin(callback: ClientPluginsType[]): void {
        callback.forEach((plugin) => {
            this.plugins.set(shortUUID.generate(), plugin);
        });
    }

    public call(trigger: string, payload: any): Promise<any> {
        return new Promise((resolve, reject) => {
            const { tls, port, host, credentials } = this.getNextServer();

            if (tls?.cert && tls?.key && tls?.ca && tls?.ca.length > 0) {
                const tlsOptions = {
                    host,
                    port,
                    key: Buffer.from(tls.key || ''),
                    cert: Buffer.from(tls.cert || ''),
                    ca: tls.ca || [],
                    rejectUnauthorized: true
                };

                const client = TLS.connect(tlsOptions, () => {
                    const message = JSON.stringify({
                        uuid: shortUUID.generate(),
                        trigger,
                        type: ALLOW_MESSAGE.RPC,
                        payload,
                        credentials: credentials ? { ...credentials, language: PLATFORM, ip: ip() || LOCALHOST } : undefined
                    });

                    client.write(message);
                })


                let rawBuffer = Buffer.alloc(0);
                let compressedLength: number | null = null;

                client.on('data', async (chunk) => {
                    rawBuffer = Buffer.concat([rawBuffer, chunk]);

                    while (true) {
                        if (compressedLength === null && rawBuffer.length >= 4) {
                            compressedLength = rawBuffer.readUInt32BE(0);
                            rawBuffer = rawBuffer.subarray(4);
                        }

                        if (compressedLength !== null && rawBuffer.length >= compressedLength) {
                            const compressedData = rawBuffer.subarray(0, compressedLength);
                            rawBuffer = rawBuffer.subarray(compressedLength);
                            compressedLength = null;

                            let decompressed;
                            try {
                                decompressed = zlib.unzipSync(compressedData);
                            } catch (err) {
                                console.error("Failed to unzip:", err);
                                return;
                            }

                            const messageLength = decompressed.readUInt32BE(0);
                            const messageBuffer = decompressed.subarray(4, 4 + messageLength);

                            if (this.decoder === DECODER.JSON) {
                                resolve(JSON.parse(messageBuffer.toString("utf8")));
                            } else if (this.decoder === DECODER.BUFFER) {
                                resolve(messageBuffer);
                            } else {
                                resolve(messageBuffer.toString(this.decoder));
                            }
                        } else {
                            break; // not enough data yet
                        }
                    }
                });

                client.on('error', (err) => reject(err));
                client.on('end', () => this.handleDisconnect(client));
                client.on('close', () => this.handleDisconnect(client));

            } else {
                const client = new net.Socket();
                client.connect(port, host, () => {
                    const message = JSON.stringify({
                        uuid: shortUUID.generate(),
                        trigger,
                        type: ALLOW_MESSAGE.RPC,
                        payload,
                        credentials: credentials ? { ...credentials, language: PLATFORM, ip: ip() || LOCALHOST } : undefined
                    });

                    client.write(message);
                });


                let rawBuffer = Buffer.alloc(0);
                let compressedLength: number | null = null;

                client.on('data', async (chunk) => {
                    rawBuffer = Buffer.concat([rawBuffer, chunk]);

                    while (true) {
                        if (compressedLength === null && rawBuffer.length >= 4) {
                            compressedLength = rawBuffer.readUInt32BE(0);
                            rawBuffer = rawBuffer.subarray(4);
                        }

                        if (compressedLength !== null && rawBuffer.length >= compressedLength) {
                            const compressedData = rawBuffer.subarray(0, compressedLength);
                            rawBuffer = rawBuffer.subarray(compressedLength);
                            compressedLength = null;

                            let decompressed;
                            try {
                                decompressed = zlib.unzipSync(compressedData);
                            } catch (err) {
                                console.error("Failed to unzip:", err);
                                return;
                            }

                            const messageLength = decompressed.readUInt32BE(0);
                            const messageBuffer = decompressed.subarray(4, 4 + messageLength);

                            if (this.decoder === DECODER.JSON) {
                                resolve(JSON.parse(messageBuffer.toString("utf8")));
                            } else if (this.decoder === DECODER.BUFFER) {
                                resolve(messageBuffer);
                            } else {
                                resolve(messageBuffer.toString(this.decoder));
                            }

                        } else {
                            break; // not enough data yet
                        }
                    }
                });

                client.on('error', (err) => reject(err));
                client.on('end', () => this.handleDisconnect(client));
                client.on('close', () => this.handleDisconnect(client));
            }
        });
    }

    private handleDisconnect(client: net.Socket | TLS.TLSSocket) {
        client.end();
        client.destroy();
    }

    safeJSONParse(data: string): any {
        try {
            return JSON.parse(data);
        } catch (error) {
            return data;
        }
    }

    private subscribe(event: string, callback: (data: any) => void): void {
        if (this.eventSockets.has(event)) {
            console.log(`⚠️ Already subscribed to event: '${event}'`);
            return;
        }

        this.servers.forEach(({ port, host }) => {
            const socket = new net.Socket();

            socket.connect(port, host, () => {
                const message = JSON.stringify({
                    uuid: shortUUID.generate(),
                    type: ALLOW_MESSAGE.SUBSCRIBE,
                    trigger: event,
                    credentials: this.credentials,
                });

                socket.write(message);
            });

            socket.on('data', (data) => {
                const parsed: MessageDataType = JSON.parse(data.toString());
                try {
                    this.plugins.forEach((plugin) => {
                        if (plugin.requestReceived)
                            plugin.requestReceived(parsed, this)
                    });

                    if (parsed.type === ALLOW_MESSAGE.EVENT && parsed.trigger === event)
                        callback(parsed.payload);

                } catch (err) {
                    this.plugins.forEach((plugin) => {
                        if (plugin.requestFailed) {
                            plugin.requestFailed({ error: { message: `❌ Failed to parse event '${event}' data:` } }, parsed)
                        }
                    });

                    console.error(`❌ Failed to parse event '${event}' data:`, err);
                }
            });

            socket.on('error', (err) => {
                console.error(`❌ Error in subscription to '${event}':`, err);
            });

            socket.on('end', () => {
                // process.kill(0)           
            });
        })
    }

    private registerSubscriptionDefinition(subscriptionDefinition: SubscriptionDefinitionType): void {
        subscriptionDefinition.forEach((callback, event) => this.subscribe(event, callback));
    }

    private emit(event: string, data: any): void {
        this.client.on('error', (err) => {
            console.error(`❌ Error in event emitter socket:`, err);
            this.client.destroy();
        });

        this.client.on('end', () => {
            console.log(`🛑 Event emitter socket ended`);
        });

        const message = JSON.stringify({
            uuid: this.clientId,
            type: ALLOW_MESSAGE.EVENT,
            trigger: event,
            payload: data,
            credentials: this.credentials,
        });

        this.client.write(message);
    }

    private unsubscribe(event: string) {
        const socket = this.eventSockets.get(event);
        if (socket) {
            socket.end();
            this.eventSockets.delete(event);
            console.log(`🔕 Unsubscribed from event '${event}'`);
        }
    }
}


