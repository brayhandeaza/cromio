import { MiddlewareCallback, TriggerCallback, OnTriggerType } from "../types";
import { ZodTypeAny, z } from "zod";


function createTriggerContext() {
    return {
        schema<T extends z.ZodObject<Record<string, z.ZodTypeAny>>>(schema: z.infer<z.ZodObject<Record<string, z.ZodTypeAny>>>) {
            return {
                onTrigger(handler: (ctx: OnTriggerType) => any): TriggerCallback {
                    return async (ctx: OnTriggerType) => {
                        const result = schema.safeParse(ctx.body);
                        if (!result.success) {
                            ctx.reply({
                                error: "Invalid payload",
                                details: result.error.format()
                            });
                            return;
                        }
                        return await handler(ctx);
                    };
                }
            };
        },

        onTrigger(handler: (ctx: OnTriggerType) => any): TriggerCallback {
            return async (ctx: OnTriggerType) => {
                return await handler(ctx);
            };
        }
    };
}

export type TriggerDefineType = ReturnType<typeof createTriggerContext>
export type TriggerDefinitionFactory = (define: TriggerDefineType) => Record<string, TriggerCallback>

export class TriggerDefinition {
    public triggers: Map<string, TriggerCallback> = new Map();
    public schemas: Map<string, z.infer<z.ZodObject<Record<string, z.ZodTypeAny>>>> = new Map();

    constructor(factory?: TriggerDefinitionFactory) {
        if (factory) {
            const context = createTriggerContext();
            const triggerMap = factory(context);
            this.setTriggers(triggerMap);
        }
    }

    public schema(schema: z.infer<z.ZodObject<Record<string, z.ZodTypeAny>>>): { onTrigger: (name: string, ...callbacks: MiddlewareCallback[]) => void } {
        return {
            onTrigger: (name: string, ...callbacks: MiddlewareCallback[]) => {
                this.schemas.set(name, schema);
                this.onTrigger(name, ...callbacks);
            }
        };
    }

    public onTrigger(name: string, ...callbacks: MiddlewareCallback[]): void {
        this.triggers.set(name, async (context: OnTriggerType) => {
            return await this.runMiddlewareChain(callbacks, context);
        });
    }

    private setTriggers(triggers: Record<string, TriggerCallback>): void {
        for (const [name, callback] of Object.entries(triggers)) {
            this.triggers.set(name, callback);
        }
    }

    private async runMiddlewareChain(callbacks: MiddlewareCallback[], context: OnTriggerType): Promise<any> {
        for (const callback of callbacks) {
            let responded = false;
            let responsePayload: any = null;

            const result = await callback({
                ...context,
                reply: (msg: any) => {
                    responded = true;
                    responsePayload = msg;
                },
            });

            if (responded) {
                context.reply(responsePayload);
                return;
            }

            if (result !== undefined) {
                return result;
            }
        }

        return undefined;
    }
}
