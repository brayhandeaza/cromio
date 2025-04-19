import { Server } from ".";
import { MessageDataType } from "../../types";

export type ServerExtension<TInjected extends object = any> = {
    injectProperties?(server: Server<TInjected> & TInjected): TInjected;

    onStart?(ctx: { server: Server<TInjected> & TInjected }): void;
    onRequest?(ctx: {
        server: Server<TInjected> & TInjected;
        request: MessageDataType;
    }): void;

    onError?(ctx: {
        server: Server<TInjected> & TInjected;
        error: Error;  // Handling errors with the error object
    }): void;

    onStop?(ctx: { server: Server<TInjected> & TInjected }): void;

    [key: string]: any;
};


export class Extensions<TInjected extends object> {
    private extensions: ServerExtension<any>[] = [];

    constructor(private server: Server<TInjected> & TInjected) { }

    useExtension<TNew extends object>(ext: ServerExtension<TNew>): Extensions<TInjected & TNew> {
        if (ext.injectProperties) {
            const injected = ext.injectProperties(this.server as any); // We assert `any` here internally
            Object.assign(this.server, injected);
        }

        this.extensions.push(ext);
        return this as unknown as Extensions<TInjected & TNew>;
    }

    triggerHook(name: string, context: any = {}) {
        for (const ext of this.extensions) {
            if (ext[name as keyof typeof ext]) {
                ext[name as keyof typeof ext]!({ ...context, server: this.server });
            }
        }
    }
}
