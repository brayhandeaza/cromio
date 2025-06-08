export * from "./client";
export * from "./middleware";
export * from "./server";
export * from "./extensions";


export type EncodingType = "utf-8" | "buffer" | "json" | "base64" | "hex" | "ascii";

export type ResponseType = {
    error?: JSON | null,
    info: {
        loadBalancerStrategy: string
        server: {
            url: string
            requests: number
        },
        performance: {
            size: number,
            time: number,
        }
    },
    data: JSON | null
}


export type ClientTypes = {
    secretKey: string;
    language: "nodejs" | "python";
    roles?: string[] | undefined;
    ip: string;
}