import { Client, ENCODER, subscriptionDefinition, tlsLoader } from "./src"
import http, { IncomingMessage, ServerResponse } from "http"
import fs from "fs";


const client = new Client({
    host: 'localhost',
    port: 1000,
    decoder: ENCODER.JSON,
    credentials: {
        secretKey: '5d8c957c754136994cf790daa351f5df28c7fac6d89f4f59f46c259177e1c6be'
    },
    tls: {
        key: fs.readFileSync(`./client-tls/key.pem`).toString(),
        cert: fs.readFileSync(`./client-tls/cert.pem`).toString(),
        ca: [fs.readFileSync(`./tls/cert.pem`).toString()]
    }
})


const httpServer = http.createServer(async (req: IncomingMessage, res: ServerResponse) => {
    try {

        // if (req.method === 'POST') {
        const user = client.call('doSomething', { name: 'John Doe', token: req.method === 'POST' });

        user.then((data) => {
            console.log({data});
        }).catch((error) => {
            console.error(error);
        })

        res.setHeader('Content-Type', 'application/json');
        res.writeHead(200);
        res.end(JSON.stringify("user"));
        // }

    } catch (error) {
        console.error(error);
    }
});

httpServer.listen(2000, () => {
    console.log('Server started on port 2000');
});
