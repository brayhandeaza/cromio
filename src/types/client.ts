import { Client } from '../core/client';
import { MessageDataType, RequestErrorType } from './server';

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
    port: number;
    host: string;
    decoder?:  "utf8" | "buffer" | "json" | "base64" | "hex" | "ascii";
    credentials?: ClientType;
}

export type ClientInstanceType = Client

export type ClientFromServerType = {
    secretKey: string;
    language: 'nodejs' | 'python';
    roles?: string[];
    ip: string;
}