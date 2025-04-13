import net from 'net';
import { Buffer } from 'buffer';
import { ip } from 'address';
import { ClientFromServerType, TriggerCallback, ServerContructorType } from '../../types';


export class Server {
    private port: number;
    private triggers: Map<string, TriggerCallback> = new Map();
    private clients: Map<string, ClientFromServerType> = new Map();
    private logs: boolean;

    constructor({ port = 1000, clients = [], logs = true }: ServerContructorType) {
        this.port = port;
        this.logs = logs;

        this.clients = new Map();
        clients.forEach((client) => {
            this.clients.set(client.secretKey, client);
        });
    }

    public addTrigger(name: string, callback: TriggerCallback): void {
        this.triggers.set(name, callback);
    }

    public registerTriggerDefinition(triggerDefinition: Map<string, TriggerCallback>): void {
        this.triggers = new Map([...this.triggers, ...triggerDefinition]);
    }

    public start(): void {
        const server = net.createServer(socket => {
            socket.on('data', (data) => {
                try {
                    const { schema, payload, credentials }: { schema: string, payload: any, credentials: ClientFromServerType } = JSON.parse(data.toString());
                    const clientAuthorized = this.verifyClient(credentials);

                    if (!clientAuthorized) {
                        console.log(`🚫 Request faild: schema=${schema} language=${credentials.language} ip=${credentials.ip} message=Client not authorized`);

                        const buffer = Buffer.from(JSON.stringify({
                            error: "Client not authorized to access this server",
                            client: credentials,
                        }));

                        return socket.write(buffer);
                    }

                    const callback = this.getCallback(schema);
                    if (!callback) {
                        console.log(`🚫 Request faild: schema=${schema} language=${credentials.language} ip=${credentials.ip} message="Schema '${schema}' not found on server side. Please check the schema name."`);
                        
                        const buffer = Buffer.from(JSON.stringify({
                            error: `Schema '${schema}' not found on server side. Please check the schema name.`,                           
                        }));

                        return socket.write(buffer);
                    }

                    if (this.logs)
                        this.showLogs({ schema, credentials });

                    const result = callback(payload);
                    const buffer = Buffer.from(JSON.stringify(result));
                    socket.write(buffer);
                } catch (err: any) {
                    socket.write(`Error: ${err.message}`);
                }
            });
        });

        server.listen(this.port, () => {
            console.log(`🔋 Server listening loacally on: host=localhost port=${this.port}`);
            console.log(`🔋 Server listening on: host=${ip()} port=${this.port}\n`);
        });
    }

    private showLogs({ schema, credentials }: { schema: string, credentials: ClientFromServerType }): void {
        console.log(`✅ Request received: schema=${schema} language=${credentials.language} ip=${credentials.ip}`);
    }

    private getCallback(name: string): TriggerCallback | undefined {
        return this.triggers.get(name);
    }

    private verifyClient(credentials: ClientFromServerType): boolean {
        if (!credentials.secretKey)
            return false;

        const client = this.clients.get(credentials.secretKey);
        if (!client && this.clients.size! > 0)
            return false;

        if (client) {
            if (client.language !== credentials.language)
                return false;

            if (client.ip !== credentials.ip && client.ip !== undefined)
                return false;
        }


        return true;
    }
}