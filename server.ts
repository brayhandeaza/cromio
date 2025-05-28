import { MiddlewareType, Server, ServerExtension, triggerDefinition } from "./src"
import users from "./data.json"

const port = Number(process.argv[2])
const server: Server = new Server({
    logs: false,
    port,
    clients: [
        {
            language: "nodejs",
            secretKey: "5d8c957c754136994cf790daa351f5df28c7fac6d89f4f59f46c259177e1c6be",
            ip: "192.168.1.93"
        }
    ]
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
        console.log('Request Time:', ctx.server.getTime());
    }
};

server.addExtension(timestampExt);




server.addTrigger("getUsers", async (ctx: MiddlewareType<{ age: number }>) => {
    ctx.reply(users)
})


server.start((url) => {
    console.log(`🚀 Server Listening On: address=${url}`)
})

