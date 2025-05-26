import got, { Got } from 'got';
import { ip } from 'address';
import shortUUID from 'short-uuid';
import zlib from 'zlib';
import { ClientPluginsType, ClientConfig, EncodingType, ServersType, ServerOptions, } from '../../types';
import { ALLOW_MESSAGE, DECODER, LOCALHOST, PLATFORM, } from '../../constants';

export class Client {
    private decoder: EncodingType;
    private plugins: Map<string, ClientPluginsType> = new Map();
    private servers: ServersType[] = [];
    private gotClients: Got[] = [];
    private currentServerIndex = 0;
    private readonly TIMEOUT = 5000;

    constructor({ decoder = DECODER.BUFFER, servers }: ClientConfig) {
        this.decoder = decoder;

        for (const server of servers) {
            // const gotClient = got.extend({
            //     prefixUrl: server.url,
            //     http2: true,
            //     timeout: { request: this.TIMEOUT },
            //     retry: { limit: 0 },
            //     https: { rejectUnauthorized: false },
            //     headers: {
            //         'content-type': 'application/json',
            //         'secretKey': server.credentials?.secretKey ?? '',
            //     },
            // });

            this.servers.push(server);
            // this.gotClients.push(gotClient);
        }
    }

    private getNextClient(): { client: Got; server: ServersType } {
        const index = this.currentServerIndex;
        this.currentServerIndex = (this.currentServerIndex + 1) % this.servers.length;
        return {
            client: this.gotClients[index],
            server: this.servers[index],
        };
    }

    public addPlugin(callbacks: ClientPluginsType[]): void {
        callbacks.forEach((plugin) => {
            this.plugins.set(shortUUID.generate(), plugin);
        });
    }

    public async send(trigger: string, payload: any): Promise<any> {
        try {
            const {  server } = this.getNextClient();
            const credentials = server.credentials;

            const message = {
                uuid: shortUUID.generate(),
                trigger,
                type: ALLOW_MESSAGE.RPC,
                payload,
                credentials: credentials
                    ? {
                        ...credentials,
                        language: PLATFORM,
                        ip: ip() || LOCALHOST,
                    }
                    : undefined,
            };


            const res = await fetch(server.url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'secretKey': server.credentials?.secretKey ?? '',
                },
                body: JSON.stringify(message),
            });

            const data = await res.json();
            return data;
            
        } catch (err: any) {
            throw new Error(`Client request failed: ${err.message}`);
        }
    }

    public destroy(): void {
        // No-op for got; connections are managed internally.
        // If persistent agents are used, you can manually close them here.
    }
}
