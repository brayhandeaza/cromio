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
    credentials?: {
        secretKey: string;
    };
};

export type ServersType = & ServerOptions

export type ClientConfig = {
    servers: ServerOptions[];
    loadBalancerStrategy?: LOAD_BALANCER
    showRequestInfo?: boolean
};