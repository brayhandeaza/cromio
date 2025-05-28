import { Client, LOAD_BALANCER,  } from "./src"
import http from "http"
import cluster from "cluster";
import os from "os";


const client = new Client({
    loadBalancerStrategy: LOAD_BALANCER.LEAST_CONNECTION,
    servers: [
        {
            url: 'http://localhost:2001',
            credentials: {
                secretKey: '5d8c957c754136994cf790daa351f5df28c7fac6d89f4f59f46c259177e1c6be'
            }
        },
        {
            url: 'http://localhost:2003',
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
            res.statusCode = users.error ? 500 : 200
            res.end(JSON.stringify(users));

        } catch (error) {
            console.error(error);
        }
    });

    httpServer.listen(2002, () => {
        console.log('Server started on port 2000');
    });
}



