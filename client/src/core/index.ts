import shortUUID from 'short-uuid';
import zlib, { createGunzip } from 'zlib';
import got, { Got, ExtendOptions } from 'got';
import { ip } from 'address';
import { ClientOptionsType, ServersType, TriggerResponseType, ClientExtension, TriggerStreamResponseType, TriggerStreamResolvedResponseType } from '../types';
import { ALLOW_MESSAGE, LOAD_BALANCER, LOCALHOST, PLATFORM, } from '../constants';
import { performance } from "perf_hooks"
import { Extensions } from './extensions';
import { parser } from 'stream-json';
import { streamArray } from 'stream-json/streamers/StreamArray';
import { streamObject } from 'stream-json/streamers/StreamObject';
import { chain, Readable } from 'stream-chain';
import { EventEmitter } from 'events';
import https from 'https';
import { TlsOptions } from 'tls';

export class Client<TInjected extends object = {}> {
    private servers: ServersType[] = [];
    private server: ServersType & { index: number };
    private activeRequests: Map<number, number> = new Map();
    private latencies: Map<number, number[]> = new Map();
    private TIMEOUT = 5000;
    private HISTORY_LIMIT = 10;
    private readonly loadBalancerStrategy: LOAD_BALANCER
    private extensions: Extensions<TInjected>
    public showRequestInfo: boolean
    private client: (_: { server: ServersType, request: any }) => Got<ExtendOptions>

    constructor({ servers, showRequestInfo = false, loadBalancerStrategy = LOAD_BALANCER.BEST_BIASED }: ClientOptionsType) {
        this.loadBalancerStrategy = loadBalancerStrategy
        this.showRequestInfo = showRequestInfo
        this.extensions = new Extensions();
        this.server = Object.assign(servers[0], {
            credentials: servers[0].credentials?.secretKey ? servers[0].credentials : { secretKey: "" },
            index: 0
        })

        servers.forEach((server, index) => {
            this.servers.push(Object.assign(server, {
                credentials: server.credentials?.secretKey ? server.credentials : { secretKey: "" },
            }));
            this.latencies.set(index, []);
            this.activeRequests.set(index, 0);
        })

        this.client = ({ server, request }: { server: any, request: any }) => {
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
                            request,
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

    public async trigger(trigger: string, payload: any): Promise<TriggerResponseType> {
        const { server, index } = this.getNextClient();
        try {
            const start = performance.now();
            const credentials = server.credentials || {};

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
                    : {
                        language: PLATFORM,
                        ip: ip() || LOCALHOST,
                    },
            };



            const request = { server, trigger, payload }
            this.extensions.triggerHook('onRequestBegin', {
                client: this,
                request
            })

            const secureHttps = server.tls ? {
                agent: {
                    https: new https.Agent({
                        ca: server.tls?.ca ? [server.tls?.ca] : [],
                        rejectUnauthorized: true
                    })
                }
            } : {}


            const message = zlib.gzipSync(JSON.stringify(data))
            const { body, statusCode } = await this.client({ server, request }).post(server.url, {
                json: { message: message.toString('base64') },
                responseType: 'buffer',
                ...secureHttps
            })

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
            switch (true) {
                case err.code === 'DEPTH_ZERO_SELF_SIGNED_CERT': {
                    const friendlyMessage = `🚫 Secure connection to '${server.url}' failed — possibly due to an untrusted TLS certificate.`;

                    this.extensions.triggerHook('onError', {
                        client: this,
                        error: new Error(friendlyMessage),
                    })

                    return {
                        data: null,
                        error: {
                            message: friendlyMessage,
                        },
                    };
                }
                case err.name === 'RequestError' || err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND' || err.code === 'ETIMEDOUT': {
                    const friendlyMessage = `🚫 Unable to reach server at '${server.url}'. Make sure the server is running and reachable.`;

                    this.extensions.triggerHook('onError', {
                        client: this,
                        error: new Error(friendlyMessage),
                    });

                    return {
                        data: null,
                        error: {
                            message: friendlyMessage,
                        },
                    };
                }
                default:
                    // 👇 Fallback generic error
                    this.extensions.triggerHook('onError', {
                        client: this,
                        error: new Error(err.message),
                    });

                    return {
                        data: null,
                        error: {
                            message: err.message ?? 'Unknown error',
                        }
                    };
            }

        }
    }


    public async triggerStream(trigger: string, payload: any, onData?: (data: any | null, error: Error | null, done: boolean) => void): Promise<TriggerStreamResponseType> {
        const { server, index } = this.getNextClient();
        const start = performance.now();
        const request = { server, trigger, payload };

        this.server = { ...server, index };
        this.extensions.triggerHook('onRequestBegin', {
            request,
            client: this,
        });

        const message = zlib.gzipSync(
            JSON.stringify({
                uuid: shortUUID.generate(),
                trigger,
                type: ALLOW_MESSAGE.STREAM,
                payload,
                credentials: server.credentials
                    ? {
                        ...server.credentials,
                        language: PLATFORM,
                        ip: ip() || LOCALHOST,
                    }
                    : {
                        language: PLATFORM,
                        ip: ip() || LOCALHOST,
                    },
            })
        );

        let hasError = false;
        let isDoneEmitted = false;
        let allData: any[] = [];
        let bytes = 0;

        const emitter = new EventEmitter();

        const emitDone = (finalData: any) => {
            if (isDoneEmitted) return;
            isDoneEmitted = true;

            if (onData) onData(null, null, true);
            emitter.emit('stream', null, null, true);

            fireOnRequestEnd(finalData);
        };

        const handleError = (err: Error) => {
            if (hasError) return;
            hasError = true;

            this.extensions.triggerHook('onError', {
                client: this,
                error: err,
            });

            if (onData) onData(null, err, false);
            emitter.emit('stream', null, err, false);

            emitDone(null);
        };

        const fireOnRequestEnd = (finalData: any) => {
            const end = performance.now();
            const fullResponse = { data: finalData };
            bytes = Buffer.byteLength(JSON.stringify(fullResponse));

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
                        },
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
        };

        try {
            const stream = this.client({ server, request }).stream.post(server.url, {
                json: { message: message.toString('base64') },
            });

            const gunzip = createGunzip();
            const jsonParser = parser();
            const streamObj = streamObject();

            stream
                .on('error', handleError)
                .pipe(gunzip)
                .on('error', handleError)
                .pipe(jsonParser)
                .on('error', handleError)
                .pipe(streamObj)
                .on('error', handleError);

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
                            emitter.emit('stream', value, null, false);
                        });

                        arraySource.on('end', () => {
                            emitDone(allData);
                        });

                        arraySource.on('error', handleError);
                    } else {
                        allData.push(value);
                        if (onData) onData(value, null, false);
                        emitter.emit('stream', value, null, false);
                        emitDone(value);
                    }
                }
            });

            streamObj.on('end', () => {
                if (hasError) return;

                if (allData.length === 0) {
                    emitDone(null);
                }
            });
        } catch (err: any) {
            const friendlyMessage = err.code
                ? `Server ${server.url} is not available (${err.code})`
                : err.message ?? 'Unknown error';

            this.extensions.triggerHook('onError', {
                client: this,
                error: new Error(friendlyMessage),
            });

            if (onData) onData(null, new Error(friendlyMessage), false);
            emitter.emit('stream', null, new Error(friendlyMessage), false);

            if (!isDoneEmitted) emitDone(null);
        }

        // Prepare controller and return it wrapped in Promise.resolve
        const controller = {
            on: (cb: (data: any | null, error: Error | null, done: boolean) => void) => {
                emitter.on('stream', cb);
                return controller;
            },
        };

        return Promise.resolve(controller);
    }


    public async triggerStreamResolved(trigger: string, payload: any): Promise<TriggerStreamResolvedResponseType> {
        let allData: any[] = [];
        let receivedSingleObject: any = undefined;
        const start = performance.now();

        try {
            await new Promise<void>((resolve, reject) => {
                this.triggerStream(trigger, payload, (data, error, done) => {
                    if (error) {
                        this.extensions.triggerHook('onError', {
                            client: this,
                            error,
                        });
                        reject(error);
                        return;
                    }

                    if (data !== null && data !== undefined) {
                        if (Array.isArray(data)) {
                            // This case happens if your server streams a whole array in 1 message
                            allData.push(...data);
                        } else {
                            // Could be object OR single stream item
                            if (typeof data === 'object' && allData.length === 0 && receivedSingleObject === undefined) {
                                receivedSingleObject = data;
                            } else {
                                allData.push(data);
                            }
                        }
                    }

                    if (done) {
                        resolve();
                    }
                });
            });
        } catch (error) {
            this.extensions.triggerHook('onError', {
                client: this,
                error: error instanceof Error ? error : new Error(String(error)),
            });
            throw error;
        }

        const end = performance.now();
        if (allData.length > 0) {
            return {
                info: {
                    loadBalancerStrategy: this.loadBalancerStrategy,
                    server: {
                        url: this.server.url,
                        requests: this.activeRequests.get(this.server.index)!
                    },
                    performance: {
                        size: Buffer.byteLength(JSON.stringify(allData)),
                        time: +Number(end - start).toFixed(0),
                    },

                },
                data: allData,
            };
        } else if (receivedSingleObject !== undefined) {
            return {
                info: {
                    loadBalancerStrategy: this.loadBalancerStrategy,
                    server: {
                        url: this.server.url,
                        requests: this.activeRequests.get(this.server.index)!
                    },
                    performance: {
                        size: Buffer.byteLength(JSON.stringify(receivedSingleObject)),
                        time: +Number(end - start).toFixed(0),
                    },

                },
                data: receivedSingleObject,
            };
        } else {
            return {
                info: {
                    loadBalancerStrategy: this.loadBalancerStrategy,
                    server: {
                        url: this.server.url,
                        requests: this.activeRequests.get(this.server.index)!
                    },
                    performance: {
                        size: 0,
                        time: +Number(end - start).toFixed(0),
                    },
                },
                data: null
            };
        }
    };
}
