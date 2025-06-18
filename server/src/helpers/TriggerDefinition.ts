import { MiddlewareCallback, TriggerCallback, OnTriggerType, TriggerDefinitionType } from "../types";



export class TriggerDefinition {
    triggers: Map<string, TriggerCallback> = new Map();

    constructor(triggers: TriggerDefinitionType = {}) {
        this.setTriggers(triggers);
    }

    public onTrigger(name: string, ...callbacks: MiddlewareCallback[]): void {
        this.triggers.set(name, async (context: OnTriggerType) => {
            return await this.runMiddlewareChain(callbacks, context);
        });
    }

    private setTriggers(triggers: TriggerDefinitionType): void {
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
