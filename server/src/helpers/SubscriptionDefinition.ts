import { SubscriptionCallback, SubscriptionDefinitionType, SubscriptionType } from "../types";

export class SubscriptionDefinition {
    public subscriptions: SubscriptionDefinitionType = new Map();

    constructor(subscriptions: SubscriptionType[] = []) {
        this.subscriptions = this.subscriptionDefinition(subscriptions);
    }

    public subscribe = (event: string, callback: (data: any) => void): void => {
        this.subscriptions.set(event, callback);
    }

    private subscriptionDefinition = (subscriptions: SubscriptionType[]): SubscriptionDefinitionType => {
        const subscriptionMap = new Map<string, SubscriptionCallback>();

        for (const { name, callback } of subscriptions) {
            subscriptionMap.set(name, callback);
        }

        return subscriptionMap;
    };
};

