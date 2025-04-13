import { TriggerCallback, TriggerType } from "../types";



export const triggerDefinition = (triggers: TriggerType[]): Map<string, TriggerCallback> => {
    const triggerMap = new Map<string, TriggerCallback>();

    for (const trigger of triggers) {
        triggerMap.set(trigger.name, trigger.callback);
    }

    return triggerMap;
}
