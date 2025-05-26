import net from 'net';
import TLS from 'tls';
import shortUUID from 'short-uuid';
import zlib from 'zlib';
import { ip } from 'address';
import { CredentialsType, EncodingType, MessageDataType, ClientPluginsType, SubscriptionDefinitionType, ServerOptions, ClientConfig, ServersType } from '../../types';
import { ALLOW_MESSAGE, DECODER, LOCALHOST, PLATFORM } from '../../constants';
import { Buffer } from 'buffer';
import http2 from 'http2';


export class Client {
    private clientId: string = shortUUID.generate();
    private decoder: EncodingType;
    private credentials: CredentialsType | undefined;
    private eventSockets: Map<string, net.Socket> = new Map();
    private plugins: Map<string, ClientPluginsType> = new Map();
    private servers: ServersType[] = [];
    private currentServerIndex: number = 0;


    // public event: {
    //     emit: (event: string, data: any) => void,
    //     subscribe: (event: string, callback: (data: any) => void) => void,
    //     unsubscribe: (event: string) => void,
    //     registerSubscriptionDefinition: ({ subscriptions, subscribe }: { subscriptions: SubscriptionDefinitionType, subscribe?: Function }) => void
    // }


    constructor({ decoder = DECODER.BUFFER, servers }: ClientConfig) {
        this.decoder = decoder;
        servers.forEach((server) => {
            this.servers.push({
                server: this.startFlexibleServer(server),
                tls: server.tls,
                url: server.url,
                credentials: server.credentials
            });
        });

        // this.event = {
        //     emit: (event: string, data: any) => this.emit(event, data),
        //     subscribe: (event: string, callback: (data: any) => void) => this.subscribe(event, callback),
        //     unsubscribe: (event: string) => this.unsubscribe(event),
        //     registerSubscriptionDefinition: ({ subscriptions: subscriptionDefinition, subscribe }: { subscriptions: SubscriptionDefinitionType, subscribe?: Function }) => this.registerSubscriptionDefinition(subscriptionDefinition)
        // }
    }

    private startFlexibleServer({ tls, url }: ServerOptions): http2.ClientHttp2Session {
        if (tls?.cert && tls?.key && tls?.ca && tls?.ca.length > 0) {


            const server = http2.connect(url, {
                rejectUnauthorized: false,
                key: Buffer.from(tls.key || ''),
                cert: Buffer.from(tls.cert || ''),
                ca: tls.ca || [],

            });

            return server;

        } else {
            const server = http2.connect(url);
            return server;
        }
    }

    private getNextServer(): ServersType {
        const server = this.servers[this.currentServerIndex];
        this.currentServerIndex = (this.currentServerIndex + 1) % this.servers.length;
        return server;
    }

    public addPlugin(callback: ClientPluginsType[]): void {
        callback.forEach((plugin) => {
            this.plugins.set(shortUUID.generate(), plugin);
        });
    }

    public send(trigger: string, payload: any): Promise<any> {
        return new Promise((resolve, reject) => {
            const { tls, server, credentials } = this.getNextServer();

            const req = server.request({
                ':method': 'POST',
                ':path': '/',
                'content-type': 'application/json',
                'secretKey': credentials?.secretKey
            });

            const message = JSON.stringify({
                uuid: shortUUID.generate(),
                trigger,
                type: ALLOW_MESSAGE.RPC,
                payload,
                credentials: credentials ? { ...credentials, language: PLATFORM, ip: ip() || LOCALHOST } : undefined
            });

            req.write(message);
            req.end();

            let buffer = Buffer.alloc(0);

            req.on('response', (headers) => {
                
            });

            req.on('data', (chunk: Buffer) => {
                buffer = Buffer.concat([buffer, chunk]);
            });

            req.on('end', () => {
                try {
                    if (buffer.length < 4) {
                        throw new Error("Incomplete buffer received");
                    }

                    console.log(buffer.toString("utf8"));
                    

                    // const compressedLength = buffer.readUInt32BE(0);
                    // const compressedData = buffer.subarray(4, 4 + compressedLength);

                    // const decompressed = zlib.unzipSync(compressedData);

                    // const messageLength = decompressed.readUInt32BE(0);
                    // const messageBuffer = decompressed.subarray(4, 4 + messageLength);

                    // if (this.decoder === DECODER.JSON) {
                    //     resolve(JSON.parse(messageBuffer.toString("utf8")));
                    // } else if (this.decoder === DECODER.BUFFER) {
                    //     resolve(messageBuffer);
                    // } else {
                    //     resolve(messageBuffer.toString(this.decoder));
                    // }
                } catch (err) {
                    reject(err);
                }
            });

            req.on('error', reject);
        });
    }

    private handleDisconnect(client: net.Socket | TLS.TLSSocket) {

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

        // this.servers.forEach(({ port, host }) => {
        //     const socket = new net.Socket();

        //     socket.connect(port, host, () => {
        //         const message = JSON.stringify({
        //             uuid: shortUUID.generate(),
        //             type: ALLOW_MESSAGE.SUBSCRIBE,
        //             trigger: event,
        //             credentials: this.credentials,
        //         });

        //         socket.write(message);
        //     });

        //     socket.on('data', (data) => {
        //         const parsed: MessageDataType = JSON.parse(data.toString());
        //         try {
        //             this.plugins.forEach((plugin) => {
        //                 if (plugin.requestReceived)
        //                     plugin.requestReceived(parsed, this)
        //             });

        //             if (parsed.type === ALLOW_MESSAGE.EVENT && parsed.trigger === event)
        //                 callback(parsed.payload);

        //         } catch (err) {
        //             this.plugins.forEach((plugin) => {
        //                 if (plugin.requestFailed) {
        //                     plugin.requestFailed({ error: { message: `❌ Failed to parse event '${event}' data:` } }, parsed)
        //                 }
        //             });

        //             console.error(`❌ Failed to parse event '${event}' data:`, err);
        //         }
        //     });

        //     socket.on('error', (err) => {
        //         console.error(`❌ Error in subscription to '${event}':`, err);
        //     });

        //     socket.on('end', () => {
        //         // process.kill(0)           
        //     });
        // })
    }

    private registerSubscriptionDefinition(subscriptionDefinition: SubscriptionDefinitionType): void {
        subscriptionDefinition.forEach((callback, event) => this.subscribe(event, callback));
    }

    // private emit(event: string, data: any): void {
    //     this.client.on('error', (err) => {
    //         console.error(`❌ Error in event emitter socket:`, err);
    //         this.client.destroy();
    //     });

    //     this.client.on('end', () => {
    //         console.log(`🛑 Event emitter socket ended`);
    //     });

    //     const message = JSON.stringify({
    //         uuid: this.clientId,
    //         type: ALLOW_MESSAGE.EVENT,
    //         trigger: event,
    //         payload: data,
    //         credentials: this.credentials,
    //     });

    // }

    private unsubscribe(event: string) {
        const socket = this.eventSockets.get(event);
        if (socket) {
            socket.end();
            this.eventSockets.delete(event);
            console.log(`🔕 Unsubscribed from event '${event}'`);
        }
    }
}


