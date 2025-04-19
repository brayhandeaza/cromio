import { ClientFromServerType } from '.';
import { Server } from '../core/server';

export type RequestErrorType = {
    error: {
        message: string
    }
}

export type ServerExtension<TInjected extends object = any> = {
    injectProperties?(server: Server<TInjected> & TInjected): Partial<TInjected>;

    onStart?(ctx: { server: Server<TInjected> & TInjected }): void;
    onRequest?(ctx: {
        server: Server<TInjected> & TInjected;
        request: MessageDataType;
    }): void;

    onError?(ctx: {
        server: Server<TInjected> & TInjected;
        error: Error;  // Handling errors with the error object
    }): void;

    onStop?(ctx: { server: Server<TInjected> & TInjected }): void;

    [key: string]: any;
};

export type TriggerType = {
    name: string;
    roles?: string[];
    callback: TriggerCallback;
}
export type SubscriptionType = {
    name: string;
    roles?: string[];
    callback: TriggerCallback;
}

export type ServerContructorType = {
    port?: number;
    logs?: boolean;
    clients?: ClientFromServerType[];
}

export type MessageDataType = {
    trigger: string,
    uuid: string,
    type: string,
    payload: any,
    credentials: ClientFromServerType
}

export type TriggerCallback = (payload: any) => any;
export type SubscriptionCallback = (payload: any) => any;
export type TriggerHandler = (payload: any, client: any) => Promise<any>;
export type TriggerDefinitionType = Map<string, TriggerCallback>
export type SubscriptionDefinitionType = Map<string, SubscriptionCallback>


export type LogsType = {
    trigger: string,
    language: string,
    ip: string,
    message?: string
}
