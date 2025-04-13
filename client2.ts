import { Client, ENCODER } from "./src"
import http, { IncomingMessage, ServerResponse } from "http"

const client = new Client({
    host: 'localhost',
    port: 1000,
    decoder: ENCODER.JSON,
    credentials: {
        secretKey: '5d8c957c754136994cf790daa351f5df28c7fac6d89f4f59f46c259177e1c6be'
    }
})


// 👂 2. Nos suscribimos a un evento emitido por el servidor
// client.subscribe('greetings', (data) => {
//     console.log('🎧 Received "greetings" event from server:', data);
// });


const httpServer = http.createServer(async (req: IncomingMessage, res: ServerResponse) => {
    try {
        if (req.method === 'POST') {
            const user = await client.call('ping', { name: 'John Doe' });

            console.log(user);


            res.setHeader('Content-Type', 'application/json');
            res.writeHead(200);
            res.end(JSON.stringify(user));
        }

    } catch (error) {
        console.error(error);
    }
});

httpServer.listen(2001, () => {
    console.log('Server started on port 2001');
});
