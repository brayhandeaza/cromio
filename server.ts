import { MiddlewareContextType, Server, triggerDefinition } from "./src"
import fs from "fs";
import users from "./data.json"

const tls = {
    key: fs.readFileSync(`./tls/key.pem`),
    cert: fs.readFileSync(`./tls/cert.pem`),
    ca: [fs.readFileSync(`./client-tls/cert.pem`)]
}

const port = Number(process.argv[2])
const server: Server = new Server({
    logs: false,
    tls,
    port
});


server.addTrigger("getUsers", async (ctx: MiddlewareContextType) => {
    console.log("getUsers")   
    
    ctx.reply(users)
})


server.start();
