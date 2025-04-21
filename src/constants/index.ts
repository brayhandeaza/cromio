export enum ENCODER {
    UTF8 = "utf-8",
    BUFFER = "buffer",
    JSON = "json",
    BASE64 = "base64",
    HEX = "hex",
    ASCII = "ascii"
}

export enum DECODER {
    UTF8 = "utf-8",
    BUFFER = "buffer",
    JSON = "json",
    BASE64 = "base64",
    HEX = "hex",
    ASCII = "ascii"
}

export const PLATFORM = "nodejs";
export const LOCALHOST = "127.0.0.1";

export enum ALLOW_MESSAGE {
    RPC = "rpc",
    EVENT = "event",
    SUBSCRIBE = "subscribe",
    UNSUBSCRIBE = "unsubscribe"
}