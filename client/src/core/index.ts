import shortUUID from 'short-uuid';
import zlib, { createGunzip } from 'zlib';
import got, { Got, ExtendOptions } from 'got';
import { ip } from 'address';
import { ClientConfig, ServersType, ResponseType, ClientExtension } from '../types';
import { ALLOW_MESSAGE, LOAD_BALANCER, LOCALHOST, PLATFORM, } from '../constants';
import { performance } from "perf_hooks"
import { Extensions } from './Extensions';
import { parser } from 'stream-json';
import { streamArray } from 'stream-json/streamers/StreamArray';
import { streamObject } from 'stream-json/streamers/StreamObject';
import { chain, Readable } from 'stream-chain';

export class Client<TInjected extends object = {}> {
    private servers: ServersType[] = [];
    private activeRequests: Map<number, number> = new Map();
    private latencies: Map<number, number[]> = new Map();
    private TIMEOUT = 5000;
    private HISTORY_LIMIT = 10;
    private readonly loadBalancerStrategy: LOAD_BALANCER
    private extensions: Extensions<TInjected>
    public showRequestInfo: boolean
    private client: (_: { server: ServersType }) => Got<ExtendOptions>

    constructor({ servers, showRequestInfo = false, loadBalancerStrategy = LOAD_BALANCER.BEST_BIASED }: ClientConfig) {
        this.loadBalancerStrategy = loadBalancerStrategy
        this.showRequestInfo = showRequestInfo
        this.extensions = new Extensions();

        servers.forEach((server, index) => {
            this.servers.push(server);
            this.latencies.set(index, []);
            this.activeRequests.set(index, 0);
        })

        this.client = ({ server }: { server: any }) => {
            return got.extend({
                timeout: {
                    request: this.TIMEOUT
                },
                hooks: {
                    beforeRetry: [(error, retryCount) => {
                        this.extensions.triggerHook('onRequestRetry', {
                            error,
                            retryCount,
                            server,
                            client: this,
                        });
                    }],
                    beforeError: [(error) => {
                        this.extensions.triggerHook('onError', {
                            client: this,
                            error,
                        })
                        return error;
                    }]
                },
                retry: {
                    limit: 5, // Customize retry behavior as needed
                    methods: ['POST'], // Ensure POST is retried
                    statusCodes: [408, 413, 429, 500, 502, 503, 504],
                    errorCodes: ['ETIMEDOUT', 'ECONNRESET', 'EAI_AGAIN']
                }
            })
        }
    }

    private getEpsilonGreedyClient(epsilon = 0.1): { server: ServersType; index: number } {
        if (Math.random() < epsilon) {
            const index = Math.floor(Math.random() * this.servers.length);
            return { server: this.servers[index], index };
        } else {
            return this.getBestBiasedClient(); // Or getLeastLatencyClient
        }
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

            case LOAD_BALANCER.EPSILON_GREEDY:
                return this.getEpsilonGreedyClient()

            default:
                return this.getLeastConnectionClient();
        }
    }

    public addExtension<TNew extends {}>(...exts: ClientExtension<TNew>[]) {
        exts.forEach(ext => {
            if (ext.injectProperties) {
                const injected = ext.injectProperties(this as any); // We assert `any` here internally
                Object.assign(this, injected);
            }

            this.extensions.useExtension(ext)
        });
    }


    public async trigger(trigger: string, payload: any): Promise<ResponseType> {
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

            this.extensions.triggerHook('onRequestBegin', {
                client: this,
                request: {
                    server,
                    trigger,
                    payload
                }
            })
            const message = zlib.gzipSync(JSON.stringify(data))
            const { body, statusCode, headers } = await this.client({ server }).post(server.url, {
                json: { message: message.toString('base64') },
                responseType: 'buffer',
            });

            const response = zlib.gunzipSync(body).toString('utf8');
            const end = performance.now();
            const bytes = body.length;

            this.activeRequests.set(index, this.activeRequests.get(index)! + 1);

            const latencies = this.latencies.get(index)!;
            latencies.push(+Number(end - start).toFixed(0));

            if (latencies.length > this.HISTORY_LIMIT) latencies.shift();

            const info = this.showRequestInfo ? {
                loadBalancerStrategy: this.loadBalancerStrategy,
                server: {
                    url: server.url,
                    requests: this.activeRequests.get(index)!
                },
                performance: {
                    size: bytes,
                    time: +Number(end - start).toFixed(0),
                }
            } : undefined

            this.extensions.triggerHook('onRequestEnd', {
                request: {
                    server,
                    trigger,
                    payload
                },
                response: {
                    info: {
                        status: statusCode,
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
                },
                client: {
                    ...this,
                    servers: this.servers,
                    activeRequests: this.activeRequests,
                    latencies: this.latencies,
                    extensions: this.extensions,
                    showRequestInfo: this.showRequestInfo,
                    loadBalancerStrategy: this.loadBalancerStrategy
                },
            })

            return {
                info,
                ...JSON.parse(response),
            };

        } catch (err: any) {
            console.log({ err: err.message });

            this.extensions.triggerHook('onError', {
                client: this,
                error: new Error(err.message),
            })
            throw err.message
        }
    }

    public triggerStream(trigger: string, payload: any, onData?: (data: any | null, error: Error | null, done: boolean) => void): void {
        const { server, index } = this.getNextClient();
        const start = performance.now();

        // Fire onRequestBegin hook
        this.extensions.triggerHook('onRequestBegin', {
            request: {
                server,
                trigger,
                payload
            },
            client: this,
        });

        const message = zlib.gzipSync(
            JSON.stringify({
                uuid: shortUUID.generate(),
                trigger,
                type: ALLOW_MESSAGE.RPC,
                payload,
                credentials: server.credentials
                    ? {
                        ...server.credentials,
                        language: PLATFORM,
                        ip: ip() || LOCALHOST,
                    }
                    : undefined,
            })
        );

        const stream = this.client({ server }).stream.post(server.url, {
            json: { message: message.toString('base64') },
        });

        const gunzip = createGunzip();
        const jsonParser = parser();
        const streamObj = streamObject();

        let allData: any[] = [];
        let bytes = 0;

        const handleError = (err: Error) => {
            this.extensions.triggerHook('onError', {
                client: this,
                error: err,
            })

            if (onData) onData(null, err, false);
        };

        stream.on('error', handleError);
        gunzip.on('error', handleError);
        jsonParser.on('error', handleError);
        streamObj.on('error', handleError);


        stream.pipe(gunzip).pipe(jsonParser).pipe(streamObj);

        streamObj.on('data', ({ key, value }) => {
            if (key === 'data') {
                if (Array.isArray(value)) {
                    const arraySource = chain([
                        Readable.from(JSON.stringify(value)),
                        parser(),
                        streamArray(),
                    ]);

                    arraySource.on('data', ({ value }) => {
                        allData.push(value);
                        if (onData) onData(value, null, false);
                    });

                    arraySource.on('end', () => {
                        const end = performance.now();
                        const fullResponse = { data: allData };
                        const serialized = JSON.stringify(fullResponse);

                        bytes = Buffer.byteLength(serialized);
                        if (onData) onData(allData[allData.length - 1], null, true);

                        // Fire onRequestEnd
                        this.extensions.triggerHook('onRequestEnd', {
                            request: {
                                server,
                                trigger,
                                payload,
                            },
                            response: {
                                status: 200,
                                info: {
                                    loadBalancerStrategy: this.loadBalancerStrategy,
                                    server: {
                                        url: server.url,
                                        requests: this.activeRequests.get(index)!,
                                    },
                                    performance: {
                                        size: bytes,
                                        time: +Number(end - start).toFixed(0),
                                    }
                                },
                                ...fullResponse,
                            },
                            client: {
                                ...this,
                                servers: this.servers,
                                activeRequests: this.activeRequests,
                                latencies: this.latencies,
                                extensions: this.extensions,
                                showRequestInfo: this.showRequestInfo,
                                loadBalancerStrategy: this.loadBalancerStrategy,
                            },
                        });
                    });

                    arraySource.on('error', handleError);
                } else {
                    allData.push(value);
                    const end = performance.now();
                    const fullResponse = { data: value };

                    bytes = Buffer.byteLength(JSON.stringify(fullResponse));
                    if (onData) onData(value, null, true);

                    // Fire onRequestEnd
                    this.extensions.triggerHook('onRequestEnd', {
                        request: {
                            server,
                            trigger,
                            payload,
                        },
                        response: {
                            status: 200,
                            info: {
                                loadBalancerStrategy: this.loadBalancerStrategy,
                                server: {
                                    url: server.url,
                                    requests: this.activeRequests.get(index)!,
                                },
                                performance: {
                                    size: bytes,
                                    time: +Number(end - start).toFixed(0),
                                }
                            },
                            ...fullResponse,
                        },
                        client: {
                            ...this,
                            servers: this.servers,
                            activeRequests: this.activeRequests,
                            latencies: this.latencies,
                            extensions: this.extensions,
                            showRequestInfo: this.showRequestInfo,
                            loadBalancerStrategy: this.loadBalancerStrategy,
                        },
                    });
                }
            }
        });

        streamObj.on('end', () => {
            // If nothing was streamed and we never reached `on('data')`
            if (allData.length === 0 && onData) {
                const fullResponse = {
                    data: null,
                    error: null,
                };

                bytes = Buffer.byteLength(JSON.stringify(fullResponse));
                onData(null, null, true);
            }
        });
    }
}
