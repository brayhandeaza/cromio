import zlib from 'zlib';
import { Buffer } from 'buffer';
import { ip } from 'address';
import { ClientFromServerType, TriggerCallback, ServerContructorType, TriggerDefinitionType, MiddlewareType, TriggerHandler, MiddlewareCallback, LogsType, ServerExtension } from '../../types';
import { Extensions } from './Extensions';
import Fastify from 'fastify';
import { ClientMessageDataType } from '../../auth/server';
import { z } from 'zod';

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
                if (!auth.passed) return reply.send({
                    error: {
                        message: auth.message
                    }
                }).status(500);


                const handler = this.triggers.get(trigger);
                if (!handler) {
                    const msg = `Trigger '${trigger}' not found on server side.`;
                    throw new Error(msg);
                }

                await handler(payload, credentials, (data: any, code: number = 200) => {
                    const message = zlib.gzipSync(JSON.stringify(data)) 
                    reply.send(message).status(code);
                });

            } catch (error: any) {
                const { message } = JSON.parse(error.message)[0]
                reply.send({
                    error: {
                        message
                    }
                }).status(500);
            }
        });

        fastify.listen({ port: this.port }, (err, address) => {
            if (err) throw err;

            if (callback) callback(address.replaceAll("[::1]", `${ip()}`));
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
            const context: MiddlewareType = {
                server: this,
                trigger: name,
                credentials,
                body: payload,
                reply: (data: any) => reply(data)
            };

            await this.runMiddlewareChain([...this.globalMiddlewares, ...callbacks], context);
        });
    }


    // ###### PRIVATE METHODS ######
    // #############################

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

    private async runMiddlewareChain(callbacks: MiddlewareCallback[], context: MiddlewareType): Promise<void> {
        for (const callback of callbacks) {
            let responded = false;
            let responsePayload: any = null;

            try {
                await callback({
                    ...context,
                    reply: (msg: any) => {
                        responded = true;
                        responsePayload = msg;
                    },
                });
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

            if (responded) {
                if (this.logs) this.Logs.trigger({
                    trigger: context.trigger,
                    language: context.credentials.language,
                    ip: context.credentials.ip,
                });
                context.reply(responsePayload);
                return;
            }
        }
    }

    private verifyClient(credentials: ClientFromServerType): { passed: boolean, message: string } {
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
                    message: ""
                }
        }
    }
}
