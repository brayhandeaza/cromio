import { SubscriptionCallback, SubscriptionDefinitionType, SubscriptionType, TriggerCallback, TriggerType } from "../types";



export const triggerDefinition = (triggers: TriggerType[]): Map<string, TriggerCallback> => {
    const triggerMap = new Map<string, TriggerCallback>();

    for (const trigger of triggers) {
        triggerMap.set(trigger.name, trigger.callback);
    }

    return triggerMap;
}


export const subscriptionDefinition = (subscriptions: SubscriptionType[]): SubscriptionDefinitionType => {
    const subscriptionMap = new Map<string, SubscriptionCallback>();

    for (const { name, callback } of subscriptions) {
        subscriptionMap.set(name, callback);
    }

    return subscriptionMap;
};
