import net from 'net';
import { Server } from '../core/server';
import { CredentialsType } from './client';

export type MiddlewareContextType<TInjected extends object = any> = {
    server: Server<TInjected> & TInjected;
    trigger: string;
    credentials: CredentialsType;
    body: any;
    socket: net.Socket;
    response: (data: any) => void
}

export type MiddlewareCallback = (payload: MiddlewareContextType) => any;
