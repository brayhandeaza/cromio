import { ClientFromServerType } from '.';

export * from "./client";
export * from "./middleware";
export * from "./extensions";

export type EncodingType = "utf-8" | "buffer" | "json" | "base64" | "hex" | "ascii";

export type ResponseType = {
    error?: {
        message: string
    }
    info?: {
        loadBalancerStrategy: string
        server: {
            url: string
            requests: number
        },
        performance: {
            size: number,
            time: number,
        }
    },
    data: any
}


export type RequestErrorType = {
    error: {
        message: string
    }
}


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

