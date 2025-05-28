import shortUUID from 'short-uuid';
import zlib from 'zlib';
import got from 'got';
import { ip } from 'address';
import { ClientPluginsType, ClientConfig, ServersType, ResponseType } from '../../types';
import { ALLOW_MESSAGE, LOAD_BALANCER, LOCALHOST, PLATFORM, } from '../../constants';
import { performance } from "perf_hooks"

export class Client {
    private plugins: Map<string, ClientPluginsType> = new Map();
    private servers: ServersType[] = [];
    private activeRequests: Map<number, number> = new Map();
    private latencies: Map<number, number[]> = new Map(); // serverIndex => array of latencies
    private readonly TIMEOUT = 5000;
    private readonly HISTORY_LIMIT = 10;
    private readonly loadBalancerStrategy: LOAD_BALANCER

    constructor({ servers, loadBalancerStrategy = LOAD_BALANCER.BEST_BIASED }: ClientConfig) {
        this.loadBalancerStrategy = loadBalancerStrategy

        servers.forEach((server, index) => {
            this.servers.push(server);
            this.latencies.set(index, []);
            this.activeRequests.set(index, 0);
        })
    }

    private getLeastConnectionClient(): { server: ServersType; index: number } {
        let min = Infinity;
        let selectedIndex = 0;

        for (const [index, count] of this.activeRequests.entries()) {
            if (count < min) {
                min = count;
                selectedIndex = index;
            }
        }

        return {
            server: this.servers[selectedIndex],
            index: selectedIndex,
        };
    }

    private getBestBiasedClient(): { server: ServersType; index: number } {
        const entries = [...this.latencies.entries()].map(([index, latencies]) => {
            const avg = latencies.length
                ? latencies.reduce((a, b) => a + b, 0) / latencies.length
                : Infinity; // Prefer untested
            return { index, avg };
        });

        entries.sort((a, b) => a.avg - b.avg);

        const candidates = entries.slice(0, Math.min(2, entries.length)); // Top 2
        const chosen = candidates[Math.floor(Math.random() * candidates.length)];

        const index = chosen.index;
        return {
            server: this.servers[index],
            index,
        };
    }

    private getLeastLatencyClient(): { server: ServersType; index: number } {
        let minAvgLatency = Infinity;
        let selectedIndex = 0;

        for (const [index, latencies] of this.latencies.entries()) {
            if (latencies.length === 0) {
                selectedIndex = index;
                break; // Prioritize untested server
            }
            const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
            if (avg < minAvgLatency) {
                minAvgLatency = avg;
                selectedIndex = index;
            }
        }

        return {
            server: this.servers[selectedIndex],
            index: selectedIndex,
        };
    }


    private getNextClient(): { server: ServersType; index: number } {
        switch (this.loadBalancerStrategy) {
            case LOAD_BALANCER.BEST_BIASED:            
                return this.getBestBiasedClient()

            case LOAD_BALANCER.LEAST_LATENCY:
                return this.getLeastLatencyClient()
               
            default:
                return this.getLeastConnectionClient();
        }      
    }

    public addPlugin(callbacks: ClientPluginsType[]): void {
        callbacks.forEach((plugin) => {
            this.plugins.set(shortUUID.generate(), plugin);
        });
    }

    public async send(trigger: string, payload: any): Promise<ResponseType> {
        try {
            const start = performance.now();
            const { server, index } = this.getNextClient();
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


            const gotClient = got.extend({
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

            this.activeRequests.set(index, this.activeRequests.get(index)! + 1);

            // Store latency
            const latencies = this.latencies.get(index)!;
            latencies.push(+Number(end - start).toFixed(0));
            if (latencies.length > this.HISTORY_LIMIT) latencies.shift();

            const bytes = body.length;

            return {
                info: {
                    loadBalancerStrategy: this.loadBalancerStrategy,
                    server: {
                        url: server.url,
                        requests: this.activeRequests.get(index)!
                    },
                    performance: {
                        size: bytes,
                        time: +Number(end - start).toFixed(0),
                    }
                },
                ...JSON.parse(response),
            };

        } catch (err: any) {
            throw new Error(`Client request failed: ${err.message}`);
        }
    }
}
