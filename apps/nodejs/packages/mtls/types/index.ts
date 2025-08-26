export interface CertificateGeneratorOptions {
    certsDir?: string;
    days?: number;
    serverIP?: string;
    organization?: string;
    country?: string;
    state?: string;
}

export interface CertificatePaths {
    key: string;
    cert: string;
    ca: string;
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

export interface CertificateBuffers {
    key: Buffer;
    cert: Buffer;
    ca: Buffer;
}

export interface CertificateSet {
    server: CertificateBuffers;
    client: CertificateBuffers;
}

export interface CertificateStrings {
    key: string;
    cert: string;
    ca: string;
}

export interface CertificateStringSet {
    server: CertificateStrings;
    client: CertificateStrings;
}
