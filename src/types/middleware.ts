import { Server } from '../core/server';
import { ClientFromServerType, CredentialsType } from './client';
import { ServerExtension, TriggerDefinitionType } from '.';

type TriggerHandlerType<TInjected extends object = {}> = {
    trigger: string;
    credentials: CredentialsType;
    body: any;
    server: TInjected & {
        clients: Map<string, ClientFromServerType>
        registerTriggerDefinition: (triggers: TriggerDefinitionType) => void
        addTrigger(name: string, ...callbacks: MiddlewareCallback[]): void
        addMiddleware(callback: MiddlewareCallback): void
        addGlobalMiddleware(...callbacks: MiddlewareCallback[]): void
        addExtension<TNew extends {}>(...exts: ServerExtension<TNew>[]): asserts this is Server<TInjected & TNew> & TNew
    };
}


export type MiddlewareType<TInjected extends object = any> = TriggerHandlerType<TInjected> & {
    reply: (data: any, code?: number) => void
}

export type MiddlewareCallback = (payload: MiddlewareType) => any;
