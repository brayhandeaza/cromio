import { Client } from "tls-rpc-test";
import fs from 'fs';

const client = new Client({
    servers: [
        {
            url: "http://192.168.1.93:2000",
            secretKey: "secretKey",
            // tls: {
            //     ca: fs.readFileSync('./certs/ca.key'),
            //     key: fs.readFileSync('./certs/key.pem'), // Load the private key
            //     cert: fs.readFileSync('./certs/cert.pem') // Load the certificate
            // }
        },
    ],
});

setTimeout(() => {
    client.trigger("div", { num1: 10, num2: 11 }).then((response) => {
        console.log(response);
    });

}, 3000);


