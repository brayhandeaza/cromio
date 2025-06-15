import { LOAD_BALANCER } from '../constants';
import { Client } from '../core';

export interface ClientType {
    secretKey: string;
}


export interface CredentialsType extends ClientType {
    ip: string;
    language: 'nodejs' | 'python';
}

export type ClientInstanceType = Client

export type ClientFromServerType = {
    secretKey: string;
    language: 'nodejs' | 'python';
    roles?: string[];
    ip: string;
}


export type ServerOptions = {
    url: string;
    tls?: TSLOptions
    credentials?: {
        secretKey: string;
    };
};

export type TSLOptions = {  
    ca?: Buffer<ArrayBufferLike>,
}

export type ServersType = & ServerOptions

export type ClientOptionsType = {
    servers: ServerOptions[];
    loadBalancerStrategy?: LOAD_BALANCER
    showRequestInfo?: boolean
    // tls?: TSLOptions
};