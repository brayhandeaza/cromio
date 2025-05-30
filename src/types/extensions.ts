import { ClientFromServerType, CredentialsType, ServerExtension, TriggerDefinitionType } from ".";
import { Server } from "../core/server";
import { MiddlewareCallback } from "./middleware";

export type RateLimitBucket = {
    tokens: number;
    lastRefill: number;
};

export type RateLimiter = {
    limit: number;
    interval: number;
    check: (ip: string) => boolean;
};


type ServerExtensionsType<TInjected extends object = any> = TInjected & {
    client: ClientFromServerType
    clients: Map<string, ClientFromServerType>
    registerTriggerDefinition: (triggers: TriggerDefinitionType) => void
    addTrigger(name: string, ...callbacks: MiddlewareCallback[]): void
    addMiddleware(callback: MiddlewareCallback): void
    addGlobalMiddleware(...callbacks: MiddlewareCallback[]): void
    addExtension<TNew extends {}>(...exts: ServerExtension<TNew>[]): asserts this is Server<TInjected & TNew> & TNew
}



export type OnRequestType<TInjected extends object = any> = {
    request: {
        trigger: string;
        credentials: CredentialsType;
        payload: any
    }
    server: ServerExtensionsType<TInjected> & TInjected
}

export type OnStartType<TInjected extends object = any> = TInjected & ServerExtensionsType

export type OnErrorType<TInjected extends object = any> = {
    server: ServerExtensionsType<TInjected> & TInjected
    error: Error
}
