import Fastify from 'fastify';
import fs from 'fs';
import path from 'path';

// TLS options
const options = {
    http2: true,
    https: {
        allowHTTP1: true,
        cert: fs.readFileSync("./tls/cert.pem"),
        key: fs.readFileSync("./tls/key.pem"),
    },
};

const server = Fastify({});

server.post('/', async (request, reply) => {
    console.log(request.body);

    reply.code(400).send({ error: "Invalid request." });
});

server.listen({ port: 2000 }, (err, address) => {
    if (err) throw err;
    console.log(`🚀 Fastify listening at ${address}`);
});
