import { Server, ServerExtensions } from "tls-rpc-test";
import fs from 'fs';


const server = new Server({
    port: 2000,
    tls: {
        key: fs.readFileSync('./certs/server/key.pem'),
        cert: fs.readFileSync('./certs/server/cert.pem'),
        ca: fs.readFileSync('./certs/ca.pem'),
        requestCert: true,
        rejectUnauthorized: true
    }
});



server.onTrigger("div", async ({ body }: any) => {
    return body.num1 / body.num2;
});



server.addExtension(ServerExtensions.prometheusMetrics({ port: 2001 }));


server.start((url: string) => {
    console.log(`Server running at ${url}`);
});