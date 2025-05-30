import { ClientFromServerType, CredentialsType } from './client';
import { TriggerCallback, TriggerHandler } from '.';
import { Extensions } from '../core/Extensions';

export type TriggerHandlerType<TInjected extends object = {}> = {
    trigger: string;
    credentials: CredentialsType;
    body: any;
    server: TInjected & {
        triggers: Map<string, TriggerHandler>;
        extensions: Extensions<TInjected>
        globalMiddlewares: TriggerCallback[]
        port: number
        logs: boolean
        clients: Map<string, ClientFromServerType>
    };
}


export type ExtensionType<TInjected extends object = any> = TriggerHandlerType<TInjected>

export type MiddlewareType<TInjected extends object = any> = TriggerHandlerType<TInjected> & {
    reply: (data: any, code?: number) => void
}

export type MiddlewareCallback = (payload: MiddlewareType) => any;
