import net from 'net';
import { Client } from '../core/client';
import { Server } from '../core/server';

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

// export type MiddlewareTools = {
//     response: (data: any) => void;
// };

export type MiddlewareContextType = {
    trigger: string;
    credentials: CredentialsType;
    body: any;
    socket: net.Socket;
    response: (data: any) => void
}
export type MiddlewareCallback = (payload: MiddlewareContextType) => any;
export type TriggerHandler = (payload: any, client: any) => Promise<any>;
export type TriggerDefinitionType = Map<string, TriggerCallback>
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


export type ClientInstanceType = Client

export type RequestErrorType = {
    error: {
        message: string
    }
}

export type ServerPluginsType = {
    requestReceived?: (payload: MessageDataType, socket: Server) => Promise<MessageDataType> | MessageDataType;
    requestFailed?: (error: RequestErrorType, data: MessageDataType) => void;
};
export type ClientPluginsType = {
    requestReceived?: (payload: MessageDataType, socket: Client) => Promise<MessageDataType> | MessageDataType;
    requestFailed?: (error: RequestErrorType, data: MessageDataType) => void;
};


export type LogsType = {
    trigger: string,
    language: string,
    ip: string,
    message?: string
}