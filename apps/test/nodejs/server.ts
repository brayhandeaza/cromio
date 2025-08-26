import { Server, ServerExtensions } from "tls-rpc-test";
import fs from 'fs';


const server = new Server({
    port: 2000,
    // tls: { // Enable TLS
    //     // key: fs.readFileSync('./certs/key.pem'), // Load the private key
    //     // cert: fs.readFileSync('./certs/cert.pem') // Load the certificate
    // },
    clients: [
        { secretKey: "*", language: "nodejs", ip: "*", },
        { secretKey: "secretKey", language: "python", ip: "192.168.1.93" }
    ]
});



server.onTrigger("div", async ({ body }: any) => {
    return body.num1 / body.num2;
});



server.addExtension(ServerExtensions.prometheusMetrics({ port: 2001 }));


server.start((url: string) => {
    console.log(`Server running at ${url}`);
});