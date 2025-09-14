import { EncodingType } from '.';
import { LOAD_BALANCER } from '../constants';
import { TSLOptions } from './server';

export type SecretKeyType = {
    secretKey?: string;
}

export type CredentialsType = SecretKeyType & {
    ip?: string;
    language?: 'nodejs' | 'python' | '*';
}

export type ClientContructorType = {
    tls?: TSLOptions
    port: number;
    host: string;
    decoder?: EncodingType;
    credentials?: SecretKeyType;
}

export type ClientType = CredentialsType & {
    name?: string;
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