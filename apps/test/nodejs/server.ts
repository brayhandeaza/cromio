import { Server, Extensions } from "tls-rpc-test";
import fs from 'fs';


const server = new Server({
    port: 2006,
    // tls: {
    //     key: fs.readFileSync('./certs/server/key.pem'),
    //     cert: fs.readFileSync('./certs/server/cert.pem'),
    //     ca: fs.readFileSync('./certs/ca.pem'),
    //     requestCert: true,
    //     rejectUnauthorized: true
    // },
    // clients: [
    //     {
    //         secretKey: "1234",
    //         language: "python",
    //         ip: "192.168.1.93",
    //     },
    // ]
});



server.onTrigger("div", async ({ body }: any) => {
    return body.num1 / body.num2;
});



server.addExtension(Extensions.serverPrometheusMetrics({ port: 2001 }));


server.start((url: string) => {
    console.log(`Server running at ${url}`);
});