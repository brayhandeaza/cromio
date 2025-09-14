// types.ts

export interface CertificateGeneratorOptions {
    certsDir?: string;
    days?: number;
    serverIP?: string;
    organization?: string;
    country?: string;
    state?: string;
}

export interface CertificateInfo {
    key: Buffer;
    cert: Buffer;
    ca: Buffer;
}

export interface CertificateStringInfo {
    key: string;
    cert: string;
    ca: string;
}

export interface CertificateBase64Info {
    key: string;
    cert: string;
    ca: string;
}

export interface CertificateSet {
    server: CertificateInfo;
    client: CertificateInfo;
}

export interface CertificateStringSet {
    server: CertificateStringInfo;
    client: CertificateStringInfo;
}

export interface CertificateBase64Set {
    server: CertificateBase64Info;
    client: CertificateBase64Info;
    ca: {
        key: string;
        cert: string;
    };
}

export interface CertificatePaths {
    key: string;
    cert: string;
    ca?: string;
}

export interface GenerationResult {
    success: boolean;
    error?: string;
    paths?: {
        server: CertificatePaths;
        client: CertificatePaths;
        ca: {
            key: string;
            cert: string;
        };
    };
}

export interface EnvVariables {
    SSL_CA_KEY_BASE64: string;
    SSL_CA_CERT_BASE64: string;
    SSL_SERVER_KEY_BASE64: string;
    SSL_SERVER_CERT_BASE64: string;
    SSL_SERVER_CA_BASE64: string;
    SSL_CLIENT_KEY_BASE64: string;
    SSL_CLIENT_CERT_BASE64: string;
    SSL_CLIENT_CA_BASE64: string;
    // Common aliases
    SSL_KEY_BASE64: string;
    SSL_CERT_BASE64: string;
    SSL_CA_BASE64: string;
}