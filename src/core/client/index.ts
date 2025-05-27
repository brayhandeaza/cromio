import https from 'https';
import shortUUID from 'short-uuid';
import zlib from 'zlib';
import got, { Got } from 'got';
import { ip } from 'address';
import { ClientPluginsType, ClientConfig, ServersType } from '../../types';
import { ALLOW_MESSAGE, DECODER, LOCALHOST, PLATFORM, } from '../../constants';
import { performance } from "perf_hooks"
import { time } from 'console';
import { size } from 'zod/v4';

export class Client {
    private plugins: Map<string, ClientPluginsType> = new Map();
    private servers: ServersType[] = [];
    private gotClients: Got[] = [];
    private currentServerIndex = 0;
    private readonly TIMEOUT = 5000;

    constructor({ decoder = DECODER.BUFFER, servers }: ClientConfig) {
        for (const server of servers)
            this.servers.push(server);

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
            const start = performance.now();
            const { server } = this.getNextClient();
            const credentials = server.credentials;

            const data = {
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

            const agent = new https.Agent({
                rejectUnauthorized: false,
                key: server.tls?.key,
                cert: server.tls?.cert,
                ca: server.tls?.ca || [],
            });

            const gotClient = got.extend({
                http2: true,
                agent: {
                    https: agent
                },
                timeout: {
                    request: this.TIMEOUT
                }
            })

            const message = zlib.gzipSync(JSON.stringify(data))
            const { body } = await gotClient.post(server.url, {
                json: { message: message.toString('base64') },
                responseType: 'buffer',
            });

            const response = zlib.gunzipSync(body).toString('utf8');
            const end = performance.now();
            const bytes = body.length;

            return {
                performance: {
                    size: bytes,
                    time: +Number(end - start).toFixed(0),
                },
                data: JSON.parse(response),
            };

        } catch (err: any) {
            throw new Error(`Client request failed: ${err.message}`);
        }
    }
}
