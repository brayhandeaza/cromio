import { SubscriptionType, TriggerCallback, TriggerType } from "../types";
import { SubscriptionDefinition } from "./SubscriptionDefinition";
import { TriggerDefinition } from "./TriggerDefinition";




export const triggerDefinition = (triggers?: TriggerType[]): TriggerDefinition => {
    const trigger = new TriggerDefinition(triggers)

    return trigger;
}



export const subscriptionDefinition = (subscriptions?: SubscriptionType[]): SubscriptionDefinition => {
    const definition = new SubscriptionDefinition(subscriptions)

    return definition
}
