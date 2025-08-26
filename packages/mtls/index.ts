import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { CertificateGeneratorOptions, CertificateSet, CertificateStringSet, GenerationResult } from './types';


export class MTLS {
    private readonly certsDir: string;
    private readonly serverDir: string;
    private readonly clientDir: string;
    private readonly days: number;
    private readonly serverIP: string;
    private readonly organization: string;
    private readonly country: string;
    private readonly state: string;

    constructor(options: CertificateGeneratorOptions = {}) {
        this.certsDir = options.certsDir || './certs';
        this.serverDir = path.join(this.certsDir, 'server');
        this.clientDir = path.join(this.certsDir, 'client');
        this.days = options.days || 365;
        this.serverIP = options.serverIP || '192.168.1.93';
        this.organization = options.organization || 'MyOrg, Inc.';
        this.country = options.country || 'US';
        this.state = options.state || 'CA';
    }

    private createDirectories(): void {
        fs.mkdirSync(this.serverDir, { recursive: true });
        fs.mkdirSync(this.clientDir, { recursive: true });
    }

    private createConfigFiles(): void {
        const caConfig = `
        [req]
        distinguished_name = req_distinguished_name
        x509_extensions = v3_ca
        prompt = no

        [req_distinguished_name]
        C = ${this.country}
        ST = ${this.state}
        O = ${this.organization}
        CN = MyRootCA

        [v3_ca]
        basicConstraints = critical, CA:true
        keyUsage = critical, keyCertSign, cRLSign
        subjectKeyIdentifier = hash
        authorityKeyIdentifier = keyid:always,issuer`;

                const serverConfig = `[req]
        distinguished_name = req_distinguished_name
        req_extensions = v3_req
        prompt = no

        [req_distinguished_name]
        C = ${this.country}
        ST = ${this.state}
        O = ${this.organization}
        CN = ${this.serverIP}

        [v3_req]
        basicConstraints = CA:FALSE
        keyUsage = nonRepudiation, digitalSignature, keyEncipherment
        subjectAltName = @alt_names

        [alt_names]
        DNS.1 = localhost
        IP.1 = 127.0.0.1
        IP.2 = ${this.serverIP}`;

                const clientConfig = `[req]
        distinguished_name = req_distinguished_name
        req_extensions = v3_req
        prompt = no

        [req_distinguished_name]
        C = ${this.country}
        ST = ${this.state}
        O = ${this.organization}
        CN = client

        [v3_req]
        basicConstraints = CA:FALSE
        keyUsage = nonRepudiation, digitalSignature, keyEncipherment
        extendedKeyUsage = clientAuth`;

        fs.writeFileSync(path.join(this.certsDir, 'ca.conf'), caConfig);
        fs.writeFileSync(path.join(this.serverDir, 'server.conf'), serverConfig);
        fs.writeFileSync(path.join(this.clientDir, 'client.conf'), clientConfig);
    }

    private executeCommand(command: string, description: string): void {
        console.log(`=== ${description} ===`);
        try {
            execSync(command, { stdio: 'inherit' });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to execute: ${description}\nCommand: ${command}\nError: ${errorMessage}`);
        }
    }

    private generateRootCA(): void {
        const caKeyPath = path.join(this.certsDir, 'ca.key');
        const caPemPath = path.join(this.certsDir, 'ca.pem');
        const caConfigPath = path.join(this.certsDir, 'ca.conf');

        this.executeCommand(
            `openssl genrsa -out "${caKeyPath}" 4096`,
            'Generating Root CA Private Key'
        );

        this.executeCommand(
            `openssl req -x509 -new -nodes -key "${caKeyPath}" -sha256 -days 3650 -out "${caPemPath}" -config "${caConfigPath}"`,
            'Generating Root CA Certificate'
        );
    }

    private generateServerCertificate(): void {
        const serverKeyPath = path.join(this.serverDir, 'key.pem');
        const serverCsrPath = path.join(this.serverDir, 'server.csr');
        const serverCertPath = path.join(this.serverDir, 'cert.pem');
        const serverConfigPath = path.join(this.serverDir, 'server.conf');
        const caPemPath = path.join(this.certsDir, 'ca.pem');
        const caKeyPath = path.join(this.certsDir, 'ca.key');

        this.executeCommand(
            `openssl genrsa -out "${serverKeyPath}" 2048`,
            'Generating Server Private Key'
        );

        this.executeCommand(
            `openssl req -new -key "${serverKeyPath}" -out "${serverCsrPath}" -config "${serverConfigPath}"`,
            'Generating Server Certificate Signing Request'
        );

        this.executeCommand(
            `openssl x509 -req -in "${serverCsrPath}" -CA "${caPemPath}" -CAkey "${caKeyPath}" -CAcreateserial -out "${serverCertPath}" -days ${this.days} -sha256 -extensions v3_req -extfile "${serverConfigPath}"`,
            'Generating Server Certificate'
        );

        // Copy CA to server folder
        fs.copyFileSync(caPemPath, path.join(this.serverDir, 'ca.pem'));
    }

    private generateClientCertificate(): void {
        const clientKeyPath = path.join(this.clientDir, 'key.pem');
        const clientCsrPath = path.join(this.clientDir, 'client.csr');
        const clientCertPath = path.join(this.clientDir, 'cert.pem');
        const clientConfigPath = path.join(this.clientDir, 'client.conf');
        const caPemPath = path.join(this.certsDir, 'ca.pem');
        const caKeyPath = path.join(this.certsDir, 'ca.key');

        this.executeCommand(
            `openssl genrsa -out "${clientKeyPath}" 2048`,
            'Generating Client Private Key'
        );

        this.executeCommand(
            `openssl req -new -key "${clientKeyPath}" -out "${clientCsrPath}" -config "${clientConfigPath}"`,
            'Generating Client Certificate Signing Request'
        );

        this.executeCommand(
            `openssl x509 -req -in "${clientCsrPath}" -CA "${caPemPath}" -CAkey "${caKeyPath}" -CAcreateserial -out "${clientCertPath}" -days ${this.days} -sha256 -extensions v3_req -extfile "${clientConfigPath}"`,
            'Generating Client Certificate'
        );

        // Copy CA to client folder
        fs.copyFileSync(path.join(this.certsDir, 'ca.pem'), path.join(this.clientDir, 'ca.pem'));
    }

    private verifyCertificates(): void {
        const caPemPath = path.join(this.certsDir, 'ca.pem');
        const serverCertPath = path.join(this.serverDir, 'cert.pem');
        const clientCertPath = path.join(this.clientDir, 'cert.pem');

        console.log('=== Verification ===');

        try {
            console.log('Verifying server certificate...');
            execSync(`openssl verify -CAfile "${caPemPath}" "${serverCertPath}"`, { stdio: 'inherit' });

            console.log('Verifying client certificate...');
            execSync(`openssl verify -CAfile "${caPemPath}" "${clientCertPath}"`, { stdio: 'inherit' });

            console.log('=== Certificate Details ===');
            console.log('Server certificate SAN:');
            execSync(`openssl x509 -in "${serverCertPath}" -text -noout | grep -A 3 "Subject Alternative Name"`, {
                stdio: 'inherit'             
            });
        } catch (error) {
            console.log('Verification completed (some commands may not show output on Windows)');
        }
    }

    public async generate(): Promise<GenerationResult> {
        try {
            console.log('Starting certificate generation...');

            this.createDirectories();
            this.createConfigFiles();

            this.generateRootCA();
            this.generateServerCertificate();
            this.generateClientCertificate();

            this.verifyCertificates();

            console.log('=== Done ===');
            console.log(`Server certs: ${this.serverDir}`);
            console.log(`Client certs: ${this.clientDir}`);

            return {
                success: true,
                paths: {
                    server: {
                        key: path.join(this.serverDir, 'key.pem'),
                        cert: path.join(this.serverDir, 'cert.pem'),
                        ca: path.join(this.serverDir, 'ca.pem')
                    },
                    client: {
                        key: path.join(this.clientDir, 'key.pem'),
                        cert: path.join(this.clientDir, 'cert.pem'),
                        ca: path.join(this.clientDir, 'ca.pem')
                    },
                    ca: {
                        key: path.join(this.certsDir, 'ca.key'),
                        cert: path.join(this.certsDir, 'ca.pem')
                    }
                }
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('Certificate generation failed:', errorMessage);
            return {
                success: false,
                error: errorMessage
            };
        }
    }

    /**
     * Read certificate files as Buffers
     */
    public readCertificates(): CertificateSet {
        try {
            return {
                server: {
                    key: fs.readFileSync(path.join(this.serverDir, 'key.pem')),
                    cert: fs.readFileSync(path.join(this.serverDir, 'cert.pem')),
                    ca: fs.readFileSync(path.join(this.serverDir, 'ca.pem'))
                },
                client: {
                    key: fs.readFileSync(path.join(this.clientDir, 'key.pem')),
                    cert: fs.readFileSync(path.join(this.clientDir, 'cert.pem')),
                    ca: fs.readFileSync(path.join(this.clientDir, 'ca.pem'))
                }
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to read certificates: ${errorMessage}`);
        }
    }

    /**
     * Read certificate files as strings
     */
    public readCertificatesAsStrings(): CertificateStringSet {
        try {
            return {
                server: {
                    key: fs.readFileSync(path.join(this.serverDir, 'key.pem'), 'utf8'),
                    cert: fs.readFileSync(path.join(this.serverDir, 'cert.pem'), 'utf8'),
                    ca: fs.readFileSync(path.join(this.serverDir, 'ca.pem'), 'utf8')
                },
                client: {
                    key: fs.readFileSync(path.join(this.clientDir, 'key.pem'), 'utf8'),
                    cert: fs.readFileSync(path.join(this.clientDir, 'cert.pem'), 'utf8'),
                    ca: fs.readFileSync(path.join(this.clientDir, 'ca.pem'), 'utf8')
                }
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to read certificates as strings: ${errorMessage}`);
        }
    }

    /**
     * Get certificate file paths
     */
    public getCertificatePaths(): GenerationResult['paths'] {
        return {
            server: {
                key: path.join(this.serverDir, 'key.pem'),
                cert: path.join(this.serverDir, 'cert.pem'),
                ca: path.join(this.serverDir, 'ca.pem')
            },
            client: {
                key: path.join(this.clientDir, 'key.pem'),
                cert: path.join(this.clientDir, 'cert.pem'),
                ca: path.join(this.clientDir, 'ca.pem')
            },
            ca: {
                key: path.join(this.certsDir, 'ca.key'),
                cert: path.join(this.certsDir, 'ca.pem')
            }
        };
    }

    /**
     * Check if certificates exist
     */
    public certificatesExist(): boolean {
        const paths = this.getCertificatePaths();
        if (!paths) return false;

        const requiredFiles = [
            paths.server.key,
            paths.server.cert,
            paths.server.ca,
            paths.client.key,
            paths.client.cert,
            paths.client.ca,
            paths.ca.key,
            paths.ca.cert
        ];

        return requiredFiles.every(filePath => fs.existsSync(filePath));
    }
}
