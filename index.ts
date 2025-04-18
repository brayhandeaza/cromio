import { Server, subscriptionDefinition } from "./src";
import { ClientFromServerType,  MiddlewareContextType, TriggerCallback } from "./src/types";

const clients: ClientFromServerType[] = [
    {
        secretKey: '5d8c957c754136994cf790daa351f5df28c7fac6d89f4f59f46c259177e1c6be',
        language: 'nodejs',
        ip: '192.168.1.93',
        roles: ['admin', 'user']
    },
    {
        secretKey: '5d8c7fac6d89f4f59c957c754136994cf7c957c754136994cf790daa351f5df28',
        language: 'python',
        ip: '192.168.1.93',
        roles: ['admin', 'user']
    }
]

const server: Server = new Server({
    clients
});


// Per-trigger auth middleware
const authMiddleware: TriggerCallback = (context: MiddlewareContextType) => {    
    if (!context.body.token) {
        throw 'Missing token';
    }
};
const authMiddleware2: TriggerCallback = (context: MiddlewareContextType) => {    
    if (context.body.name !== 'John Doe') {
        throw 'Invalid name';
    }

    context.response("Hello world!! 2");
};

server.addTrigger('doSomething', authMiddleware, authMiddleware2, async (context: MiddlewareContextType) => {
    console.log(context.credentials);
    context.response({ name: 'fianl middleware' });
});



// Emitimos un evento cada 5 segundos como ejemplo
const userSubscriptions = subscriptionDefinition()
userSubscriptions.subscribe('greetings', (payload: any) => {
    console.log({ payload });
    return payload;
})


server.registerSubscriptionDefinition(userSubscriptions);
server.start();

