import { Client, ENCODER } from "./src"
import http, { IncomingMessage, ServerResponse } from "http"
import fs from "fs"
import http2 from 'http2';
import https from 'https';
import cluster from "cluster";
import os from "os";



const tls = {
    key: fs.readFileSync(`./client-tls/key.pem`).toString(),
    cert: fs.readFileSync(`./client-tls/cert.pem`).toString(),
    ca: [fs.readFileSync(`./tls/cert.pem`).toString()]
}

const client = new Client({
    decoder: ENCODER.JSON,
    servers: [
        {
            url: 'http://localhost:2001',
            credentials: {
                secretKey: '5d8c957c754136994cf790daa351f5df28c7fac6d89f4f59f46c259177e1c6be'
            }
        }
    ]
})




if (cluster.isMaster) {
    for (let i = 0; i < os.cpus().length; i++)
        cluster.fork();

} else {
    const httpServer = http.createServer(async (req, res) => {
        try {
            const users = await client.send('getUsers', { name: 'John Doe' });

            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ users }));

        } catch (error) {
            console.error(error);
        }
    });

    httpServer.listen(2002, () => {
        console.log('Server started on port 2000');
    });
}



