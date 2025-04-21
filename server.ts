import { MiddlewareContextType, Server, triggerDefinition } from "./src"
import fs from "fs";
import users from "./data.json"


const server: Server = new Server({
    logs: false,
    tls: {
        key: fs.readFileSync(`./tls/key.pem`).toString(),
        cert: fs.readFileSync(`./tls/cert.pem`).toString(),
        ca: [fs.readFileSync(`./client-tls/cert.pem`).toString()]
    }
});

const userTriggers = triggerDefinition()

server.addTrigger("getUsers", async (ctx: MiddlewareContextType) => {    
    ctx.response(users)
})


server.registerTriggerDefinition(userTriggers)
server.start();
