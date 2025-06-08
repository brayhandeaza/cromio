import zlib from 'zlib';
import { Buffer } from 'buffer';
import { ip } from 'address';
import { ClientFromServerType, TriggerCallback, ServerContructorType, TriggerDefinitionType, OnTriggerType, TriggerHandler, MiddlewareCallback, LogsType, ServerExtension } from '../types';
import { Extensions } from './extensions';
import Fastify, { FastifyReply } from 'fastify';
import { ClientMessageDataType } from '../auth/server';
import { z } from 'zod';
import { createGzip } from 'zlib';
import { performance } from 'perf_hooks';
import { PassThrough } from 'stream';


export class Server<TInjected extends object = {}> {
    private extensions: Extensions<TInjected>;
    private port: number;
    private logs: boolean;
    private triggerHandlers = new Map<string, TriggerHandler>();
    public triggers: Set<string> = new Set();
    private globalMiddlewares: TriggerCallback[] = [];
    public clients = new Map<string, ClientFromServerType>();

    private Logs = {
        trigger: ({ trigger, language, ip }: LogsType) => {
            console.log(`✅ Logs(RPC): trigger="${trigger}" language="${language}" ip="${ip}" message="Request received and processed successfully."`);
        },
        error: ({ trigger, language, ip, message }: LogsType) => {
            console.log(`❌ Logs(Error): trigger="${trigger}" language="${language}" ip="${ip}" message="${message}"`);
        }
    }

    constructor(options?: ServerContructorType) {
        const { port = 2000, clients = [], logs = true, tls } = options || {};
        this.port = port;
        this.logs = logs;

        clients.forEach(client => this.clients.set(client.secretKey, client));
        this.extensions = new Extensions();

    }


    public start(callback?: (url: string) => void) {
        const fastify = Fastify();

        // ⛔ Global hook to reject all non-POST requests
        fastify.get('*', (_, reply) => reply.code(405).send({ error: "Only POST requests are allowed." }))
        fastify.delete('*', (_, reply) => reply.code(405).send({ error: "Only POST requests are allowed." }))
        fastify.put('*', (_, reply) => reply.code(405).send({ error: "Only POST requests are allowed." }))
        fastify.patch('*', (_, reply) => reply.code(405).send({ error: "Only POST requests are allowed." }))

        fastify.post('/', async (request, reply) => {
            try {
                const start = performance.now();
                const bodySchema = z.object({ message: z.string() });

                const { message } = await bodySchema.parseAsync(request.body);
                const data = zlib.gunzipSync(Buffer.from(message, 'base64')).toString('utf8');
                const { trigger, payload, type, credentials } = await ClientMessageDataType.parseAsync(JSON.parse(data));

                const auth = this.verifyClient(credentials);
                if (auth.passed) {
                    this.extensions.triggerHook("onRequestBegin", {
                        request: { trigger, payload, credentials },
                        server: this
                    });

                    const handler = this.triggerHandlers.get(trigger);
                    if (!handler) {
                        const message = `🚫 Trigger '${trigger}' is not registered on the server`;
                        this.extensions.triggerHook("onError", {
                            server: this,
                            error: new Error(message),
                            request: { trigger, payload, client: auth.client }
                        });
                        return reply
                            .status(500)
                            .send(zlib.gzipSync(JSON.stringify({ error: { message } })));
                    }

                    await new Promise((resolve, reject) => {
                        handler(payload, credentials, async (data: any, code: number = 200) => {
                            try {
                                const time = performance.now() - start;
                                const safeData = data === undefined ? { data: null } : { data };

                                this.extensions.triggerHook("onRequestEnd", {
                                    server: this,
                                    request: { trigger, payload, client: auth.client },
                                    response: {
                                        status: code,
                                        ...safeData,
                                        performance: {
                                            size: Buffer.byteLength(JSON.stringify(safeData)),
                                            time
                                        }
                                    }
                                });

                                if (type === 'stream') {
                                    await this.streamJsonData(reply, code, safeData);
                                    resolve(null);

                                } else {
                                    const message = zlib.gzipSync(JSON.stringify(safeData));
                                    reply.status(code).send(message);
                                    resolve(null);
                                }

                            } catch (err) {
                                this.extensions.triggerHook("onError", {
                                    request: { trigger, payload, credentials },
                                    server: this,
                                    error: err,
                                });
                                reject(err);
                            }
                        });
                    });


                    // await new Promise((resolve, reject) => {
                    //     handler(payload, credentials, (data: any, code: number = 200) => {
                    //         try {
                    //             const time = performance.now() - start;
                    //             const safeData = data === undefined ? null : { data };
                    //             this.extensions.triggerHook("onRequestEnd", {
                    //                 server: this,
                    //                 request: { trigger, payload, client: auth.client },
                    //                 response: {
                    //                     status: code,
                    //                     ...safeData,
                    //                     performance: {
                    //                         size: Buffer.byteLength(JSON.stringify(safeData)),
                    //                         time
                    //                     }
                    //                 }
                    //             });
                    //             const message = zlib.gzipSync(JSON.stringify(safeData));
                    //             reply.status(code).send(message);
                    //             resolve(null);
                    //         } catch (err) {
                    //             this.extensions.triggerHook("onError", {
                    //                 request: { trigger, payload, credentials },
                    //                 server: this,
                    //                 error: err,
                    //             });
                    //             reject(err);
                    //         }
                    //     });
                    // });

                } else {
                    // 🔥 FIXED THIS PART
                    this.extensions.triggerHook("onError", {
                        server: this,
                        error: new Error(auth.message),
                        request: { trigger: null, payload: null, client: null }
                    });
                    return reply.send(zlib.gzipSync(JSON.stringify({ error: { message: auth.message } })));
                }

            } catch (error: any) {
                reply.status(500).send(zlib.gzipSync(JSON.stringify({ error: { message: error.message || 'Unknown error' } })));
            }
        });


        fastify.listen({ port: this.port }, (err, address) => {
            if (err) throw err

            if (callback) callback(address.replaceAll("[::1]", `${ip()}`));
            this.extensions.triggerHook("onStart", {
                server: this,
            });
        });
    }



    public addExtension<TNew extends {}>(...exts: ServerExtension<TNew>[]) {
        exts.forEach(ext => {
            if (ext.injectProperties) {
                const injected = ext.injectProperties(this as any); // We assert `any` here internally
                Object.assign(this, injected);
            }

            this.extensions.useExtension(ext)
        });
    }

    public addMiddleware(callback: TriggerCallback) {
        this.globalMiddlewares.push(callback);
    }

    public addGlobalMiddleware(...callbacks: TriggerCallback[]) {
        this.globalMiddlewares.push(...callbacks);
    }

    public registerTriggerDefinition({ triggers }: { triggers: TriggerDefinitionType }) {
        triggers.forEach((callback, name) => {
            this.triggers.add(name);
            this.onTrigger(name, callback);
        })
    }

    public onTrigger(name: string, ...callbacks: MiddlewareCallback[]) {
        this.triggers.add(name);
        this.triggerHandlers.set(name, async (payload, credentials, reply) => {
            let responseSent = false;

            const context: OnTriggerType = {
                server: {
                    ...this,
                    extensions: this.extensions,
                    port: this.port,
                    logs: this.logs,
                    clients: this.clients
                },
                trigger: name,
                credentials,
                body: payload,
                reply: (data: any) => {
                    responseSent = true;
                    return reply(data);
                }
            };

            // runMiddlewareChain now returns the return value of the last middleware
            const result = await this.runMiddlewareChain([...this.globalMiddlewares, ...callbacks], context);

            if (!responseSent) {
                // If nothing was returned and no reply called, send undefined explicitly
                reply(result === undefined ? undefined : result);
            }
        });
    }

    private streamJsonData(reply: FastifyReply, code: number, safeData: any) {
        reply.status(code);
        reply.header('Content-Encoding', 'gzip');
        reply.header('Content-Type', 'application/json');

        const stream = new PassThrough();
        const gzip = createGzip();

        stream.pipe(gzip).pipe(reply.raw);

        // Helper to safely write a chunk and return a promise to await drain if needed
        const writeChunk = (chunk: string) =>
            new Promise<void>((resolve, reject) => {
                if (!stream.write(chunk)) {
                    stream.once('drain', resolve);
                } else {
                    resolve();
                }
            });

        (async () => {
            if (safeData === null || typeof safeData !== 'object') {
                // Primitive or null: just write directly
                await writeChunk(JSON.stringify(safeData));
            } else if (Array.isArray(safeData)) {
                // Stream array: [item1, item2, ...]
                await writeChunk('[');
                for (let i = 0; i < safeData.length; i++) {
                    if (i > 0) await writeChunk(',');
                    await writeChunk(JSON.stringify(safeData[i]));
                }
                await writeChunk(']');
            } else {
                // Stream object: {"key1": value1, "key2": value2, ...}
                const keys = Object.keys(safeData);
                await writeChunk('{');
                for (let i = 0; i < keys.length; i++) {
                    if (i > 0) await writeChunk(',');
                    const key = keys[i];
                    const value = safeData[key];
                    await writeChunk(JSON.stringify(key) + ':' + JSON.stringify(value));
                }
                await writeChunk('}');
            }
            stream.end();
        })().catch(err => {
            stream.destroy(err);
        });

        return new Promise((resolve, reject) => {
            reply.raw.on('finish', resolve);
            reply.raw.on('error', reject);
        });
    }

    private break(err: any) {
        this.extensions.triggerHook("onError", {
            server: this,
        });
        if (err instanceof Error) {
            return err;
        } else if (typeof err === 'string') {
            return new Error(err);
        } else if (typeof err === 'object' && err !== null) {
            return new Error(JSON.stringify(err));
        } else {
            return new Error('Unknown error');
        }
    }

    private async runMiddlewareChain(callbacks: MiddlewareCallback[], context: OnTriggerType): Promise<any> {
        for (const callback of callbacks) {
            let responded = false;
            let responsePayload: any = null;

            try {
                const result = await callback({
                    ...context,
                    reply: (msg: any) => {
                        responded = true;
                        responsePayload = msg;
                    },
                });

                if (responded) {
                    if (this.logs) this.Logs.trigger({
                        trigger: context.trigger,
                        language: context.credentials.language,
                        ip: context.credentials.ip,
                    });

                    context.reply(responsePayload);
                    return;
                }

                // NEW: If middleware returned something (not undefined), treat it like an early return
                if (result !== undefined) {
                    return result;
                }

            } catch (err: any) {
                const error = this.break(err);

                if (this.logs) this.Logs.error({
                    trigger: context.trigger,
                    language: context.credentials.language,
                    ip: context.credentials.ip,
                    message: error.message
                });

                context.reply({ error: error.message }, 500);
                return;
            }
        }

        return undefined;
    }

    private verifyClient(credentials: ClientFromServerType): { passed: boolean, message: string, client?: ClientFromServerType } {
        if (this.clients.size < 1)
            return { passed: true, message: `` }

        const client = this.clients.get(credentials.secretKey);
        switch (true) {
            case !credentials.secretKey:
                return {
                    passed: false,
                    message: `🚫 Authentication Failed: Client at ip=${credentials.ip} did not provide a valid secretKey`,
                };
            case !client:
                return {
                    passed: false,
                    message: `🚫 Authentication Failed: Client at ip=${credentials.ip} provided an invalid secretKey`,
                };
            case client?.language !== credentials.language:
                return {
                    passed: false,
                    message: `🚫 Invalid Language: '${credentials.language}' not allowed for ip=${credentials.ip} — expected '${client.language}'`,
                };
            case client?.ip !== credentials.ip && client?.ip !== "*":
                return {
                    passed: false,
                    message: `🚫 Invalid IP Address: Expected '${client.ip}', but received '${credentials.ip}'`,
                };
            case client?.secretKey !== credentials.secretKey:
                return {
                    passed: false,
                    message: `🚫 Authentication Failed: Client at ip=${credentials.ip} provided an invalid secretKey`,
                };
            default:
                return {
                    passed: true,
                    message: "",
                    client
                }
        }
    }
}
