import net from 'net';
import { ip } from 'address';
import { ClientContructorType, CredentialsType, EncodingType } from '../../types';
import { ALLOW_MESSAGE, DECODER, LOCALHOST, PLATFORM } from '../../constants';
import shortUUID, { uuid } from 'short-uuid';
import EventEmitter from 'events';


export class Client {
    private host: string;
    private port: number;
    private clientId: string = shortUUID.generate();
    private decoder: EncodingType;
    private credentials: CredentialsType | undefined;
    private eventSockets: Map<string, net.Socket> = new Map();
    private eventEmitterSocket: net.Socket = new net.Socket();
    public event: {
        emit: (event: string, data: any) => void,
        subscribe: (event: string, callback: (data: any) => void) => void,
    }



    constructor({ host, port, decoder = DECODER.BUFFER, credentials }: ClientContructorType) {
        this.host = host;
        this.port = port;
        this.decoder = decoder;
        this.credentials = credentials ? { ...credentials, language: PLATFORM, ip: ip() || LOCALHOST } : undefined;

        this.eventEmitterSocket = new net.Socket();
        this.eventEmitterSocket.connect(this.port, this.host, () => {            
            console.log(`🔌 Event emitter socket connected to ${this.host}:${this.port}`);
        });

        this.event = {
            emit: (event: string, data: any) => this.emit(event, data),
            subscribe: (event: string, callback: (data: any) => void) => this.subscribe(event, callback),
        }
    }

    public call(trigger: string, payload: any): Promise<any> {
        return new Promise((resolve, reject) => {
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

            client.on('data', (data) => {
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

                } catch (err) {
                    reject(new Error('Failed to parse server response'));
                } finally {
                    client.end();
                }
            });

            client.on('error', (err) => reject(err));
        });
    }

    public subscribe(event: string, callback: (data: any) => void): void {
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
            try {
                const parsed = JSON.parse(data.toString());
                if (parsed.type === ALLOW_MESSAGE.EVENT && parsed.event === event) {
                    callback(parsed.data);
                }
            } catch (err) {
                console.error(`❌ Failed to parse event '${event}' data:`, err);
            }
        });

        socket.on('error', (err) => {
            console.error(`❌ Error in subscription to '${event}':`, err);
        });

        socket.on('end', () => {
            console.log(`🛑 Event subscription '${event}' ended`);
        });
    }

    public emit(event: string, data: any): void {
        if (!this.eventEmitterSocket) {
            this.eventEmitterSocket = new net.Socket();

            this.eventEmitterSocket.connect(this.port, this.host, () => {
                console.log(`🔌 Event emitter socket connected to ${this.host}:${this.port}`);
            });

            this.eventEmitterSocket.on('error', (err) => {
                console.error(`❌ Error in event emitter socket:`, err);
                this.eventEmitterSocket?.destroy();
            });

            this.eventEmitterSocket.on('end', () => {
                console.log(`🛑 Event emitter socket ended`);
            });
        }

        const message = JSON.stringify({
            uuid: this.clientId,
            type: ALLOW_MESSAGE.EVENT,
            trigger: event,
            payload: data,
            credentials: this.credentials,
        });

        this.eventEmitterSocket.write(message);
    }



    public unsubscribe(event: string) {
        const socket = this.eventSockets.get(event);
        if (socket) {
            socket.end();
            this.eventSockets.delete(event);
            console.log(`🔕 Unsubscribed from event '${event}'`);
        }
    }
}


