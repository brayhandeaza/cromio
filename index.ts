import fs from "fs";
import { Server } from "./src";
import { MiddlewareContextType, ServerExtension } from "./src/types";


const server: Server = new Server({
    logs: false,
    tls: {
        key: fs.readFileSync(`./tls/key.pem`).toString(),
        cert: fs.readFileSync(`./tls/cert.pem`).toString(),
        ca: [fs.readFileSync(`./client-tls/cert.pem`).toString()]
    }
});


server.addTrigger('doSomething', async (context: MiddlewareContextType) => {
    context.response({ name: 'fianl middleware' });
});


server.start();

