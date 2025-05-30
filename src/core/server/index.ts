import zlib from 'zlib';
import { Buffer } from 'buffer';
import { ip } from 'address';
import { ClientFromServerType, TriggerCallback, ServerContructorType, TriggerDefinitionType, MiddlewareType, TriggerHandler, MiddlewareCallback, LogsType, ServerExtension } from '../../types';
import { Extensions } from './Extensions';
import Fastify from 'fastify';
import { ClientMessageDataType } from '../../auth/server';
import { z } from 'zod';
import { ALLOW_MESSAGE } from '../../constants';
import { error } from 'console';

export class Server<TInjected extends object = {}> {
    private extensions!: Extensions<TInjected>;
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
                if (!auth.passed) return reply.send(zlib.gzipSync(JSON.stringify({
                    error: {
                        message: auth.message
                    }
                }))).status(500);



                const handler = this.triggers.get(trigger);
                if (!handler) {
                    const message = `🚫 Trigger '${trigger}' is not registered on the server`;
                    this.extensions.triggerHook("onError", {
                        server: this,
                        error: new Error(message),
                    });
                    reply.send(zlib.gzipSync(JSON.stringify({
                        error: {
                            message
                        }
                    }))).status(500);
                    return;
                }

                await handler(payload, credentials, (data: any, code: number = 200) => {
                    // Replace undefined with null or {} to ensure valid JSON
                    const safeData = data === undefined ? null : { data };

                    try {
                        this.extensions.triggerHook("onRequest", {
                            server: this,
                            request: { trigger, payload, credentials: auth.client },
                        });
                    } catch (err: any) {
                        throw new Error(err?.message || String(err));
                    }

                    const message = zlib.gzipSync(JSON.stringify(safeData));
                    reply.status(code).send(message);
                });

            } catch (error: any) {
                const { message } = JSON.parse(error.message)[0]

                this.extensions.triggerHook("onError", {
                    server: this,
                    error: new Error(message),
                });

                reply.send(zlib.gzipSync(JSON.stringify({
                    error: { message }
                })));
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
            this.addTrigger(name, callback);
        })
    }

    public addTrigger(name: string, ...callbacks: MiddlewareCallback[]) {
        this.triggers.set(name, async (payload, credentials, reply) => {
            let responseSent = false;

            const context: MiddlewareType = {
                server: this,
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

    private async runMiddlewareChain(callbacks: MiddlewareCallback[], context: MiddlewareType): Promise<any> {
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
            case client?.ip !== credentials.ip:
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
