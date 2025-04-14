import { Server, subscriptionDefinition, triggerDefinition } from "./src";
import { SubscriptionDefinitionType } from "./src/types";


const tcpServer: Server = new Server({
    clients: [
        {
            secretKey: '5d8c957c754136994cf790daa351f5df28c7fac6d89f4f59f46c259177e1c6be',
            language: 'nodejs',
            ip: '192.168.1.93',
            roles: ['admin', 'user']
        }
    ]
});


const userTriggers = triggerDefinition([
    {
        name: 'test',
        roles: ['admin'],
        callback: (payload: any) => {
            return payload;
        }
    },
    {
        name: 'ping',
        callback: (payload: any) => {
            return payload;
        }
    }
])

const userSubscriptions: SubscriptionDefinitionType = subscriptionDefinition([
    {
        name: 'greetings',
        callback: (payload: any) => {
            console.log({ payload });
            return payload;
        }
    }
])


// tcpServer.registerSubscriptionDefinition(userSubscriptions);
tcpServer.registerTriggerDefinition(userTriggers);

// // Emitimos un evento cada 5 segundos como ejemplo
setInterval(() => {
    tcpServer.event.emit('greetings', { message: '🛰️ Hello from greetings'});
    tcpServer.event.emit('getUser', { message: '🛰️ Hello from getUser'});
}, 5000);

tcpServer.start();


