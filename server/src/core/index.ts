import zlib from 'zlib';
import { Buffer } from 'buffer';
import { ip } from 'address';
import { ClientFromServerType, TriggerCallback, ServerContructorType, TriggerDefinitionType, OnTriggerType, TriggerHandler, MiddlewareCallback, LogsType, ServerExtension } from '../types';
import { Extensions } from './Extensions';
import Fastify from 'fastify';
import { ClientMessageDataType } from '../auth/server';
import { z } from 'zod';
import stringify from 'streaming-json-stringify';
import { createGzip } from 'zlib';

export class Server<TInjected extends object = {}> {
    private extensions: Extensions<TInjected>;
    private port: number;
    private logs: boolean;
    private triggers = new Map<string, TriggerHandler>();
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

    constructor({ port = 1000, clients = [], logs = true, tls }: ServerContructorType) {
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
                const bodySchema = z.object({ message: z.string() });
                const { message } = await bodySchema.parseAsync(request.body);

                const data = zlib.gunzipSync(Buffer.from(message, 'base64')).toString('utf8');
                const { trigger, payload, credentials } = await ClientMessageDataType.parseAsync(JSON.parse(data));

                const auth = this.verifyClient(credentials);
                if (!auth.passed) {
                    return reply
                        .status(500)
                        .send(zlib.gzipSync(JSON.stringify({ error: { message: auth.message } })));
                }

                const handler = this.triggers.get(trigger);
                if (!handler) {
                    const message = `🚫 Trigger '${trigger}' is not registered on the server`;
                    this.extensions.triggerHook("onError", { server: this, error: new Error(message) });
                    return reply
                        .status(500)
                        .send(zlib.gzipSync(JSON.stringify({ error: { message } })));
                }

                await new Promise((resolve, reject) => {
                    handler(payload, credentials, (data: any, code: number = 200) => {
                        try {
                            const safeData = data === undefined ? null : { data };
                            this.extensions.triggerHook("onRequest", {
                                server: this,
                                request: { trigger, payload, credentials: auth.client },
                            });
                            const message = zlib.gzipSync(JSON.stringify(safeData));
                            reply.status(code).send(message);
                            resolve(null);
                        } catch (err) {
                            reject(err);
                        }
                    });
                });

            } catch (error: any) {
                let errMessage = "Internal server error";
                try {
                    errMessage = JSON.parse(error.message)[0]?.message ?? errMessage;
                } catch {
                    errMessage = error.message ?? errMessage;
                }

                this.extensions.triggerHook("onError", {
                    server: this,
                    error: new Error(errMessage),
                });

                reply.status(500).send(zlib.gzipSync(JSON.stringify({ error: { message: errMessage } })));
            }
        });

        fastify.post('/stream', async (request, reply) => {
            try {
                const bodySchema = z.object({ message: z.string() });
                const { message } = await bodySchema.parseAsync(request.body);

                const data = zlib.gunzipSync(Buffer.from(message, 'base64')).toString('utf8');
                const { trigger, payload, credentials } = await ClientMessageDataType.parseAsync(JSON.parse(data));

                const auth = this.verifyClient(credentials);
                if (!auth.passed) {
                    reply
                        .status(500)
                        .header('Content-Encoding', 'gzip')
                        .header('Content-Type', 'application/json');
                    return reply.send(zlib.gzipSync(JSON.stringify({ error: { message: auth.message } })));
                }

                const handler = this.triggers.get(trigger);
                if (!handler) {
                    const message = `🚫 Trigger '${trigger}' is not registered on the server`;
                    this.extensions.triggerHook("onError", { server: this, error: new Error(message) });
                    reply
                        .status(500)
                        .header('Content-Encoding', 'gzip')
                        .header('Content-Type', 'application/json');
                    return reply.send(zlib.gzipSync(JSON.stringify({ error: { message } })));
                }

                // Use a Promise wrapper so we can await the callback pattern
                const dataToStream: { safeData: any; code: number } = await new Promise((resolve, reject) => {
                    handler(payload, credentials, (data: any, code: number = 200) => {
                        try {
                            const safeData = data === undefined ? null : { data };
                            this.extensions.triggerHook("onRequest", {
                                server: this,
                                request: { trigger, payload, credentials: auth.client },
                            });
                            resolve({ safeData, code });
                        } catch (err) {
                            reject(err);
                        }
                    });
                });

                const { safeData, code } = dataToStream;

                // Set headers for streaming gzip + JSON
                reply.status(code);
                reply.header('Content-Encoding', 'gzip');
                reply.header('Content-Type', 'application/json');

                // Create JSON stringify stream for the data
                const jsonStream = stringify(safeData);

                // Create gzip stream
                const gzip = createGzip();

                // Pipe JSON string stream through gzip into reply raw response
                jsonStream.pipe(gzip).pipe(reply.raw);

                // Return a promise that resolves once the streaming is done
                await new Promise((resolve, reject) => {
                    reply.raw.on('finish', resolve);
                    reply.raw.on('error', reject);
                });

            } catch (error: any) {
                let errMessage = "Internal server error";
                try {
                    errMessage = JSON.parse(error.message)[0]?.message ?? errMessage;
                } catch {
                    errMessage = error.message ?? errMessage;
                }

                this.extensions.triggerHook("onError", {
                    server: this,
                    error: new Error(errMessage),
                });

                reply.status(500).header('Content-Encoding', 'gzip').header('Content-Type', 'application/json');
                reply.send(zlib.gzipSync(JSON.stringify({ error: { message: errMessage } })));
            }
        });

        fastify.listen({ port: this.port }, (err, address) => {
            if (err) {
                this.extensions.triggerHook("onError", {
                    server: this,
                    error: new Error(err.message),
                });

                throw err
            };

            if (callback) callback(address.replaceAll("[::1]", `${ip()}`));
            this.extensions.triggerHook("onStart", {
                server: this,
            });
        });
    }

    public addExtension<TNew extends {}>(...exts: ServerExtension<TNew>[]): asserts this is Server<TInjected & TNew> & TNew {
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
            this.onTrigger(name, callback);
        })
    }

    public onTrigger(name: string, ...callbacks: MiddlewareCallback[]) {
        this.triggers.set(name, async (payload, credentials, reply) => {
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

            default:
                return {
                    passed: true,
                    message: "",
                    client
                }
        }
    }
}
