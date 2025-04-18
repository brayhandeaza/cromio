import { TriggerCallback, TriggerDefinitionType, TriggerType } from "../types";

export class TriggerDefinition {
    triggers: TriggerDefinitionType = new Map();
    constructor(triggers: TriggerType[] = []) {
        this.triggers = this.triggerDefinition(triggers);
    }

    public addTrigger(name: string, callback: TriggerCallback): void {
        this.triggers.set(name, callback);
    }

    private triggerDefinition = (triggers: TriggerType[]): Map<string, TriggerCallback> => {
        const triggerMap = new Map<string, TriggerCallback>();

        for (const trigger of triggers) {
            triggerMap.set(trigger.name, trigger.callback);
        }

        return triggerMap;
    }
}
