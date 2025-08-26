import { ClientType, OnErrorType, OnRequestBeginType, OnRequestEndType, OnStartType } from '.';
import { Server } from '../core';

export type RequestErrorType = {
    error: {
        message: string
    }
}

export type ServerExtension<TInjected extends object = any> = {
    // /**
    //         * The `injectProperties` method allows an extension to add arbitrary properties to the server,
    //         * which will then be available to other extension hooks (e.g. `onStart`,  `onRequest`, `onResponse`, etc.).
    //         *
    //         * This is useful for injecting reusable services, utilities, or shared state.
    //         *
    //         * @returns An object whose properties will be merged into the server instance.
    //         * @example
    //         * // Example of an extension injecting a logger property
    //         * injectProperties() {
    //         *     return {
    //         *         newProperty: 'Hello, world!'
    //         *     };
    //         * }
    //         *
    //         * // The injected property can be accessed in other hooks:
    //         * onRequest({ server }) {
    //         *     console.log(server.newProperty); // Output: 'Hello, world!'            
    //         * }
    //     */
    injectProperties?(server: Server<TInjected> & TInjected): Partial<TInjected>;
    onStart?(ctx: OnStartType<TInjected>): void;
    onRequestEnd?(ctx: OnRequestEndType): void;
    onRequestBegin?(ctx: OnRequestBeginType): void;
    onError?(ctx: OnErrorType): void;
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
    ca?: Buffer<ArrayBufferLike>;
    requestCert?: boolean;
    rejectUnauthorized?: boolean;
}

export type ServerOptionsType = {
    tls?: TSLOptions;
    port?: number;
    logs?: boolean;
    clients?: ClientType[];
}

export type MessageDataType = {
    trigger: string,
    uuid: string,
    type: string,
    payload: any,
    credentials: ClientType
}

export type OnRequestDataType = {
    trigger: string,
    payload: any,
    client: ClientType
}

export type TriggerCallback = (payload: any) => any;
export type SubscriptionCallback = (payload: any) => any;
export type TriggerHandler = (payload: any, credentials: ClientType, reply: (data: any) => void) => Promise<any>;
export type TriggerDefinitionType = Map<string, TriggerCallback>
export type SubscriptionDefinitionType = Map<string, SubscriptionCallback>


export type LogsType = {
    trigger: string,
    language: string,
    ip: string,
    message?: string
}
