import { ServerOptions, ServersType } from ".";
import { LOAD_BALANCER } from "../constants";
import { Client } from "../core";
import { Extensions } from "../core/Extensions";


export type ClientExtension<TInjected extends object = any> = {
    injectProperties?(server: Client<TInjected> & TInjected): Partial<TInjected>;
    onRequestBegin?(ctx: OnRequestBeginType): void;
    onRequestEnd?(ctx: OnRequestEndType): void;
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


const a = {
    b: 0
}

type ClientExtensionsType<TInjected extends object = any> = TInjected & Client & ClientType<TInjected>

export type OnRequestBeginType<TInjected extends object = any> = {
    request: {
        server: ServerOptions
        trigger: string;
        payload: any
    }
    client: ClientExtensionsType<TInjected> & TInjected
}

export type OnRequestEndType<TInjected extends object = any> = TInjected & {
    request: {
        server: ServerOptions
        trigger: string;
        payload: any
    }
    client: ClientType<TInjected>
    response: {
        info: [key: string, value: any]
        data: [key: string, value: any] | null
    }
}

export type OnErrorType<TInjected extends object = any> = {
    server: ClientExtensionsType<TInjected> & TInjected
    error: Error
}
