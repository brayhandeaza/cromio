import { ClientFromServerType, ExtensionType, OnErrorType, OnRequestType, OnStartType } from '.';
import { Server } from '../core/server';

export type RequestErrorType = {
    error: {
        message: string
    }
}

export type ServerExtension<TInjected extends object = any> = {
    injectProperties?(server: Server<TInjected> & TInjected): Partial<TInjected>;
    onStart?(ctx: OnStartType): void;
    onRequest?(ctx: OnRequestType): void;
    onError?(ctx: OnErrorType): void;

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

export type TSLOptions = {
    key?: Buffer<ArrayBufferLike>;
    cert?: Buffer<ArrayBufferLike>;
    ca?: Buffer<ArrayBufferLike>[]
}

export type ServerContructorType = {
    tls?: TSLOptions;
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

export type OnRequestDataType = {
    trigger: string,
    payload: any,
    client: ClientFromServerType
}


export type TriggerCallback = (payload: any) => any;
export type SubscriptionCallback = (payload: any) => any;
export type TriggerHandler = (payload: any, credentials: ClientFromServerType, reply: (data: any) => void) => Promise<any>;
export type TriggerDefinitionType = Map<string, TriggerCallback>
export type SubscriptionDefinitionType = Map<string, SubscriptionCallback>


export type LogsType = {
    trigger: string,
    language: string,
    ip: string,
    message?: string
}
