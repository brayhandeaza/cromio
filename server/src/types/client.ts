import { EncodingType } from '.';
import { LOAD_BALANCER } from '../constants';
import { TSLOptions } from './server';

export interface ClientType {
    secretKey: string;
}

export interface CredentialsType extends ClientType {
    ip: string;
    language: 'nodejs' | 'python';
}

export type ClientContructorType = {
    tls?: TSLOptions
    port: number;
    host: string;
    decoder?: EncodingType;
    credentials?: ClientType;
}

export type ClientFromServerType = {
    secretKey: string;
    language: 'nodejs' | 'python';
    roles?: string[];
    ip: string;
}


export type ServerOptions = {
    url: string;
    tls?: TSLOptions;
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