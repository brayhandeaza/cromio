import { MTLS } from "tls-rpc-test";

async function main(): Promise<void> {
    const generator = new MTLS({
        serverIP: '192.168.1.93',
        days: 365,
        organization: 'Binomia',
        country: 'DR',
        state: 'SD'
    });

    const result = await generator.generate()

    if (result.success) {
        console.log('Certificates generated successfully!');
        console.log('Paths:', result.paths);

        // Example: Read the certificates for use in your application
        try {
            const certs = generator.readCertificates();
            const certsAsStrings = generator.readCertificatesAsStrings();
            console.log('Certificates loaded and ready to use');
            console.log('Certificate types available: Buffers and Strings');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('Failed to read certificates:', errorMessage);
        }
    } else {
        console.error('Failed to generate certificates:', result.error);
        process.exit(1);
    }
}


main()