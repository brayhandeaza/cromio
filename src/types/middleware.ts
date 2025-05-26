import net from 'net';
import { Server } from '../core/server';
import { CredentialsType } from './client';

export type MiddlewareContextType<TInjected extends object = any> = {
    server: Server<TInjected> & TInjected;
    trigger: string;
    credentials: CredentialsType;
    body: any;
    // socket: net.Socket;
    reply: (data: any, code?: number) => void
}

export type MiddlewareCallback = (payload: MiddlewareContextType) => any;
