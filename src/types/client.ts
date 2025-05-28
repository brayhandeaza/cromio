import { EncodingType } from '.';
import { LOAD_BALANCER } from '../constants';
import { Client } from '../core/client';
import { MessageDataType, RequestErrorType, TSLOptions } from './server';
import http2 from 'http2';

export interface ClientType {
    secretKey: string;
}

export type ClientPluginsType = {
    requestReceived?: (payload: MessageDataType, socket: Client) => Promise<MessageDataType> | MessageDataType;
    requestFailed?: (error: RequestErrorType, data: MessageDataType) => void;
};


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

export type ClientInstanceType = Client

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

export type ServersType = & ServerOptions & {
    // server: http2.ClientHttp2Session
};

export type ClientConfig = {
    servers: ServerOptions[];
    loadBalancerStrategy?: LOAD_BALANCER
};