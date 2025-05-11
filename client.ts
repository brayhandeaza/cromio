import { Client, ENCODER } from "./src"
import http, { IncomingMessage, ServerResponse } from "http"
import fs from "fs"

const tls = {
    key: fs.readFileSync(`./client-tls/key.pem`).toString(),
    cert: fs.readFileSync(`./client-tls/cert.pem`).toString(),
    ca: [fs.readFileSync(`./tls/cert.pem`).toString()]
}

const client = new Client({
    decoder: ENCODER.JSON,
    servers: [
        {
            host: 'localhost',
            port: 1000,
            tls,
            credentials: {
                secretKey: '5d8c957c754136994cf790daa351f5df28c7fac6d89f4f59f46c259177e1c6be'
            }
        },
        {
            host: 'localhost',
            port: 1001,
            tls,
            credentials: {
                secretKey: '5d8c957c754136994cf790daa351f5df28c7fac6d89f4f59f46c259177e1c6be'
            }
        }
    ]
})



const httpServer = http.createServer(async (req: IncomingMessage, res: ServerResponse) => {
    try {
        const users = await client.call('getUsers', { name: 'John Doe' });

        res.setHeader('Content-Type', 'application/json');
        res.writeHead(200);
        res.end(JSON.stringify(users));

    } catch (error) {
        console.error(error);
    }
});

httpServer.listen(2000, () => {
    console.log('Server started on port 2000');
});
