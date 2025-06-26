import { ServerOptions, ServersType } from ".";
import { LOAD_BALANCER } from "../constants";
import { Client } from "../core";
import { Extensions } from "../core/extensions";


export type ClientExtension<TInjected extends object = any> = {
    injectProperties?(server: Client<TInjected> & TInjected): Partial<TInjected>;
    onRequestBegin?(ctx: OnRequestBeginType): void;
    onRequestEnd?(ctx: OnRequestEndType): void;
    onRequestRetry?(ctx: OnRequestRetryType): void;
    onStart?(ctx: OnStartType<TInjected>): void;
    onError?(ctx: OnErrorType): void;
    [key: string]: any;
};

type ClientType<TInjected extends object> = {
    servers: ServersType[]
    activeRequests: Map<number, number>
    latencies: Map<number, number[]>
    extensions: Extensions<TInjected>
    showRequestInfo: boolean
    loadBalancerStrategy: LOAD_BALANCER
}

type ClientExtensionsType<TInjected extends object = any> = TInjected

export type OnStartType<TInjected extends object> = ClientType<TInjected> & TInjected

export type OnRequestBeginType<TInjected extends object = any> = {
    request: {
        server: ServerOptions
        trigger: string;
        payload: any
    }
    client: ClientExtensionsType<TInjected> & TInjected & Client
}
export type OnRequestRetryType<TInjected extends object = any> = {
    retryCount: number
    error: Error
    request: {
        server: ServerOptions
        trigger: string;
        payload: any
    }
    client: ClientExtensionsType<TInjected> & TInjected & Client
}

export type OnRequestEndType<TInjected extends object = any> = TInjected & {
    request: {
        server: ServerOptions
        trigger: string;
        payload: any
    }
    client: ClientExtensionsType<TInjected> & TInjected & Client
    response: {
        status: number
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
        }
        data: JSON | null
    }
}

export type OnErrorType<TInjected extends object = any> = {
    request: {
        server: ServerOptions
        trigger: string;
        payload: any
    }
    client: ClientExtensionsType<TInjected> & TInjected & Client
    error: Error
}
