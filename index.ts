import { Server } from "./src";
import { MiddlewareContextType, ServerExtension } from "./src/types";


const server: Server = new Server({
    logs: false    
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

const timestampExt2: ServerExtension<{getTime: () => string, age: number }> = {
    injectProperties: (server) => ({
        age: 20,
    }),
    onRequest: (ctx) => {
        console.log('Request Time: timestampExt2', ctx.server.getTime());
    }
};


server.addTrigger('doSomething', async (context: MiddlewareContextType<{age: number}>) => {
    console.log('Request doSomething Time: ', context.server.age);
    context.response({ name: 'fianl middleware' });
});


server.addExtension(timestampExt, timestampExt2);
server.start();

