import { Server, triggerDefinition } from "./src";


const tcpServer: Server = new Server({
    port: 1000,
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


tcpServer.registerTriggerDefinition(userTriggers);

tcpServer.start();


