import { MiddlewareCallback, TriggerDefinitionType, TriggerType, MiddlewareType } from "../types";

export class TriggerDefinition {
    triggers: TriggerDefinitionType = new Map<string, (ctx: MiddlewareType) => Promise<any>>();

    constructor(triggers: TriggerType[] = []) {
        this.triggers = this.triggerDefinition(triggers);
    }

    public addTrigger(name: string, ...callbacks: MiddlewareCallback[]): void {
        this.triggers.set(name, async (context: MiddlewareType) => {
            return await this.runMiddlewareChain(callbacks, context);
        });
    }

    private triggerDefinition = (triggers: TriggerType[]): Map<string, (ctx: MiddlewareType) => Promise<any>> => {
        const triggerMap = new Map<string, (ctx: MiddlewareType) => Promise<any>>();
        for (const trigger of triggers) {
            triggerMap.set(trigger.name, trigger.callback);
        }
        return triggerMap;
    }

    private async runMiddlewareChain(callbacks: MiddlewareCallback[], context: MiddlewareType): Promise<any> {
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

            // Break the chain if a middleware returned a value
            if (result !== undefined) {
                return result;
            }
        }

        return undefined;
    }
}
