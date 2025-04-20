import { Server, tlsLoader } from "./src";
import { MiddlewareContextType, ServerExtension } from "./src/types";
import fs from "fs";



const server: Server = new Server({
    logs: false,
    tls: {
        key: fs.readFileSync(`./tls/key.pem`).toString(),
        cert: fs.readFileSync(`./tls/cert.pem`).toString(),
        ca: [fs.readFileSync(`./client-tls/cert.pem`).toString()]
    }
});

const timestampExt: ServerExtension<{ getTime: () => string, age: number }> = {
    injectProperties: (server) => ({
        getTime() {
            return new Date().toISOString();
        }
    }),
    onStart: ({ server }) => {
        server.age += 100;
        console.log('Start Time:', server.age);
    }
};

const timestampExt2: ServerExtension<{ getTime: () => string, age: number }> = {
    injectProperties: (server) => ({
        age: 20,
    }),
    onRequest: (ctx) => {
        console.log('Request Time: timestampExt2', ctx.server.getTime());
    }
};


server.addTrigger('doSomething', async (context: MiddlewareContextType<{ age: number }>) => {
    console.log('Request doSomething Time: ', context.server.age);
    context.response({ name: 'fianl middleware' });
});


server.addExtension(timestampExt, timestampExt2);
server.start();

