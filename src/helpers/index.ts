import { SubscriptionType, TriggerType } from "../types";
import { SubscriptionDefinition } from "./SubscriptionDefinition";
import { TriggerDefinition } from "./TriggerDefinition";
import zlib from 'zlib';
import { promisify } from 'util';


export const triggerDefinition = (triggers?: TriggerType[]): TriggerDefinition => {
	const trigger = new TriggerDefinition(triggers)

	return trigger;
}



export const subscriptionDefinition = (subscriptions?: SubscriptionType[]): SubscriptionDefinition => {
	const definition = new SubscriptionDefinition(subscriptions)

	return definition
}

export const safeStringify = (input: any): string => {
	try {
		return JSON.stringify(input).replaceAll(/{}\s*/g, '').trim();
	} catch (err) {
		return String(input);
	}
}


export const calculateConcurrency = (memoryUsedMB: number): number => {
	if (memoryUsedMB < 100) return 10;
	if (memoryUsedMB < 200) return 7;
	if (memoryUsedMB < 300) return 5;
	if (memoryUsedMB < 400) return 3;
	return 1;
}



export const gzip = promisify(zlib.gzip);
export const unzip = promisify(zlib.unzip);