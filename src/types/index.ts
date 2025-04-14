export interface ClientType {
    secretKey: string;
}

export type EncodingType = "utf8" | "buffer" | "json" | "base64" | "hex" | "ascii";

export interface CredentialsType extends ClientType {
    ip: string;
    language: 'nodejs' | 'python';
}

export type ClientContructorType = {
    port: number;
    host: string;
    decoder?: EncodingType;
    credentials?: ClientType;
}


export type TriggerCallback = (payload: any) => any;
export type SubscriptionCallback = (payload: any) => any;

export type SubscriptionDefinitionType = Map<string, SubscriptionCallback> 

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

export type ClientFromServerType = {
    secretKey: string;
    language: 'nodejs' | 'python';
    roles?: string[];
    ip: string;
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