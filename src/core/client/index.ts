import net from 'net';
import { ip } from 'address';
import { ClientContructorType, CredentialsType, EncodingType } from '../../types';
import { Encoding } from '../../constants';


export class Client {
    private host: string;
    private port: number;
    private decoder: EncodingType;
    private credentials: CredentialsType | undefined;

    constructor({ host, port, decoder = Encoding.BUFFER, credentials }: ClientContructorType) {
        this.host = host;
        this.port = port;
        this.decoder = decoder;
        this.credentials = credentials ? { ...credentials, language: 'nodejs', ip: ip() || "127.0.0.1" } : undefined;
    }

    public call(schema: string, payload: any): Promise<any> {
        return new Promise((resolve, reject) => {
            const client = new net.Socket();

            client.connect(this.port, this.host, () => {
                const message = JSON.stringify({ schema, payload, credentials: this.credentials });
                client.write(message);
            });

            client.on('data', (data) => {
                try {
                    switch (this.decoder) {
                        case "json":
                            resolve(JSON.parse(data.toString()));
                            break;
                        case "base64":
                            resolve(data.toString("base64"));
                            break;
                        case "utf8":
                            resolve(data.toString("utf-8"));
                            break;
                        case "hex":
                            resolve(data.toString("hex"));
                            break;
                        default:
                            resolve(data);
                            break;
                    }

                } catch (err) {
                    reject(new Error('Failed to parse server response'));
                } finally {
                    client.end();
                }
            });

            client.on('error', (err) => {
                reject(err);
            });
        });
    }
}


