import { Client } from "tls-rpc-test";
import fs from 'fs';

const client = new Client({
    servers: [
        {
            url: "https://192.168.1.93:2000",
            secretKey: "secretKey",
            tls: {
                key: fs.readFileSync('./certs/client/key.pem'),
                cert: fs.readFileSync('./certs/client/cert.pem'),
                ca: fs.readFileSync('./certs/ca.pem'),

            }
        }
    ],
});

setTimeout(() => {
    client.trigger("div", { num1: 10, num2: 11 }).then((response) => {
        console.log(response);
    });

}, 3000);


