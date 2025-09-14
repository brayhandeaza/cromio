import { Client, LOAD_BALANCER } from "cromio";
import fs from 'fs';
import http from 'http';
import { collectDefaultMetrics, register } from 'prom-client';


const client: Client = new Client({
    loadBalancerStrategy: LOAD_BALANCER.BEST_BIASED,
    servers: [
        {
            url: "https://localhosts:2006",
            secretKey: "1234",
            tls: {
                key: fs.readFileSync('./certs/client/key.pem'),
                cert: fs.readFileSync('./certs/client/cert.pem'),
                ca: fs.readFileSync('./certs/ca.pem')
            }
        }
    ]
});


const server = http.createServer(async (req, res) => {
    const response = await client.trigger("div", { num1: 10, num2: 11 })

    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(JSON.stringify(response));
});

server.listen(2002, () => {
    console.log('Server listening on port 2002');
});




