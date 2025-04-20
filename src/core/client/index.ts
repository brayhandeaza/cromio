import net from 'net';
import TLS from 'tls';
import { ip } from 'address';
import { ClientContructorType, CredentialsType, EncodingType, MessageDataType, ClientPluginsType, SubscriptionDefinitionType, TSLOptions } from '../../types';
import { ALLOW_MESSAGE, DECODER, LOCALHOST, PLATFORM } from '../../constants';
import shortUUID, { uuid } from 'short-uuid';

export class Client {
    private host: string;
    private port: number;
    private clientId: string = shortUUID.generate();
    private decoder: EncodingType;
    private credentials: CredentialsType | undefined;
    private eventSockets: Map<string, net.Socket> = new Map();
    // private eventEmitterSocket: net.Socket = new net.Socket();
    private plugins: Map<string, ClientPluginsType> = new Map();
    private tls: TSLOptions | null = null;
    private client: TLS.TLSSocket | net.Socket = new net.Socket();


    public event: {
        emit: (event: string, data: any) => void,
        subscribe: (event: string, callback: (data: any) => void) => void,
        unsubscribe: (event: string) => void,
        registerSubscriptionDefinition: ({ subscriptions, subscribe }: { subscriptions: SubscriptionDefinitionType, subscribe?: Function }) => void
    }


    constructor({ host, port, decoder = DECODER.BUFFER, credentials, tls }: ClientContructorType) {
        this.host = host;
        this.port = port;
        this.decoder = decoder;
        this.credentials = credentials ? { ...credentials, language: PLATFORM, ip: ip() || LOCALHOST } : undefined;
        this.tls = tls || null;


        this.createFlexibleServer();

        // this.eventEmitterSocket = new net.Socket();
        // this.eventEmitterSocket.connect(this.port, this.host, () => {
        //     console.log(`🔌 Event emitter socket connected to ${this.host}:${this.port}`);
        // });

        // this.eventEmitterSocket.on("close", (data) => {
        //     const { event, data: eventData } = JSON.parse(data.toString());
        //     this.emit(event, eventData);
        // });

        this.event = {
            emit: (event: string, data: any) => this.emit(event, data),
            subscribe: (event: string, callback: (data: any) => void) => this.subscribe(event, callback),
            unsubscribe: (event: string) => this.unsubscribe(event),
            registerSubscriptionDefinition: ({ subscriptions: subscriptionDefinition, subscribe }: { subscriptions: SubscriptionDefinitionType, subscribe?: Function }) => this.registerSubscriptionDefinition(subscriptionDefinition)
        }
    }

    public addPlugin(callback: ClientPluginsType[]): void {
        callback.forEach((plugin) => {
            this.plugins.set(shortUUID.generate(), plugin);
        });
    }

    public call(trigger: string, payload: any): Promise<any> {
        return new Promise((resolve, reject) => {
            if (this.tls?.cert && this.tls?.key && this.tls?.ca && this.tls?.ca.length > 0) {
                const tlsOptions = {
                    key: Buffer.from(this.tls.key || ''),
                    cert: Buffer.from(this.tls.cert || ''),
                    ca: this.tls.ca || []
                };

                const client = TLS.connect(this.port, tlsOptions, () => {
                    const message = JSON.stringify({
                        uuid: shortUUID.generate(),
                        trigger,
                        type: ALLOW_MESSAGE.RPC,
                        payload,
                        credentials: this.credentials
                    });

                    client.write(message);

                })

                client.on('data', (data) => this.incomingData(data, resolve, reject, client));
                client.on('error', (err) => reject(err));
                client.on('end', () => this.handleDisconnect(client));
                client.on('close', () => this.handleDisconnect(client));

            } else {
                const client = new net.Socket();
                client.connect(this.port, this.host, () => {
                    const message = JSON.stringify({
                        uuid: shortUUID.generate(),
                        trigger,
                        type: ALLOW_MESSAGE.RPC,
                        payload,
                        credentials: this.credentials
                    });

                    client.write(message);
                });

                client.on('data', (data) => this.incomingData(data, resolve, reject, client));
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


    private incomingData(data: any, resolve: (data: any) => void, reject: (error: any) => void, client: net.Socket | TLS.TLSSocket) {
        try {
            switch (this.decoder) {
                case "json":
                    resolve(JSON.parse(data.toString()));
                    break;
                case "base64":
                    resolve(data.toString("base64"));
                    break;
                case "utf8":
                    resolve(data.toString("utf-8"));
                    break;
                case "hex":
                    resolve(data.toString("hex"));
                    break;
                default:
                    resolve(data);
                    break;
            }

        } catch (err: any) {
            reject(err);
        } finally {
            client.end();
        }
    }



    private createFlexibleServer() {
        if (this.tls?.cert && this.tls?.key && this.tls?.ca && this.tls?.ca.length > 0) {
            const tlsOptions = {
                key: Buffer.from(this.tls.key || ''),
                cert: Buffer.from(this.tls.cert || ''),
                ca: this.tls.ca || []
            };

            this.client = TLS.connect(this.port, tlsOptions, () => {
                console.log("🔐 Client connected using a secure TLS connection.");
            })

        } else {
            this.client = new net.Socket();
            this.client.connect(this.port, this.host, () => {
                console.log("🌐 Client connected using a TCP connection.");
            });
        }
    }

    private subscribe(event: string, callback: (data: any) => void): void {
        if (this.eventSockets.has(event)) {
            console.log(`⚠️ Already subscribed to event: '${event}'`);
            return;
        }

        const socket = new net.Socket();

        socket.connect(this.port, this.host, () => {
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


