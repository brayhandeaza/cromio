import { Server, subscriptionDefinition } from "./src";
import { ServerExtension } from "./src/core/server/Extensions";
import { ClientFromServerType, MiddlewareContextType, TriggerCallback } from "./src/types";

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
    clients,
    logs: false
});



server.addTrigger('doSomething', async (context: MiddlewareContextType) => {
    context
    context.response({ name: 'fianl middleware' });
});


const timestampExt: ServerExtension<{ getTime: () => string, age: number }> = {
    injectProperties: (server) => ({
        age: 30,
        getTime() {
            return new Date().toISOString();
        }
    }),
    onStart: ({ server }) => {
        console.log('Start Time:', server.getTime());
    },
    onStop: ({ server }) => {
        console.log('Stop Time:', server.getTime());
    },
    onRequest: (ctx) => {
        console.log('Request Time:', ctx.server);
    }
};

const loggingExt: ServerExtension<{
    log: (message: string, level: 'info' | 'warn' | 'error' | 'debug') => void;
    uptime: () => string;
    requestCount: number;
    lastRequestTime: Date | null;
    logStats: () => void;
}> = {
    injectProperties: (server) => ({
        // Basic logging method to output messages with different log levels
        log(message, level) {
            const timestamp = new Date().toISOString();
            console.log(`[${timestamp}] [${level.toUpperCase()}] - ${message}`);
        },

        // Method to track and return server uptime
        uptime() {
            const uptimeMs = process.uptime() * 1000; // Get uptime in milliseconds
            const hours = Math.floor(uptimeMs / (1000 * 60 * 60));
            const minutes = Math.floor((uptimeMs % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((uptimeMs % (1000 * 60)) / 1000);
            return `${hours}h ${minutes}m ${seconds}s`;
        },

        // Count of incoming requests handled by the server
        requestCount: 0,

        // Track the time of the last incoming request
        lastRequestTime: null,

        // Log server statistics (requests handled, uptime, etc.)
        logStats() {
            const uptimeStr = server.uptime();
            console.log(`Server Uptime: ${uptimeStr}`);
            console.log(`Total Requests Handled: ${server.requestCount}`);
            console.log(`Last Request Time: ${server.lastRequestTime ? server.lastRequestTime.toISOString() : 'N/A'}`);
        },
    }),

    onStart: ({ server }) => {
        server.log('Logging Extension Started', 'info');
    },

    onStop: ({ server }) => {
        server.log('Logging Extension Stopped', 'info');
        server.logStats();
    },

    onRequest: ({ server, request }) => {
        server.requestCount++;
        server.lastRequestTime = new Date();
        server.log(`Received a request at ${server.lastRequestTime.toISOString()}`, 'debug');
    },
};


server.addExtension(timestampExt);
server.addExtension(loggingExt);
server.start();

