import { ClientType, CredentialsType, ServerExtension, ClientTypes, TriggerCallback, TriggerDefinitionType, TriggerHandler } from ".";
import { Server } from "../core";
import { MiddlewareCallback } from "./middleware";



/**
 * Represents the full shape of the server instance during runtime, including:
 * - core server properties
 * - registered triggers
 * - active clients
 * - registered middleware
 * - registered extensions (via `addExtension`)
 * - injected properties from extensions (`TInjected`)
 *
 * @template TInjected - The type of properties injected by extensions via `injectProperties()`. Defaults to `any`.
 *
 * @property client - The current client connection that triggered the event.
 * @property clients - A map of all connected clients.
 * @property registerTriggerDefinition - Registers trigger definitions.
 * @property addTrigger - Adds a trigger handler with one or more middleware callbacks.
 * @property addMiddleware - Adds a middleware callback.
 * @property addGlobalMiddleware - Adds global middleware callbacks.
 * @property addExtension - Adds one or more extensions and asserts that their injected properties become available on the server.
 *
 * @example
 * server.addExtension(myExtension);
 * server.newProperty('Hello, world!'); // server.newProperty is injected by myExtension!
 */
type ServerExtensionsType<TInjected extends object = any> = TInjected & {
    client: ClientType;
    clients: Map<string, ClientType>;
    triggers: Set<string>;
    registerTriggerDefinition: (triggers: TriggerDefinitionType) => void;
    addTrigger(name: string, ...callbacks: MiddlewareCallback[]): void;
    addMiddleware(callback: MiddlewareCallback): void;
    addGlobalMiddleware(...callbacks: MiddlewareCallback[]): void;
    addExtension<TNew extends {}>(...exts: ServerExtension<TNew>[]): asserts this is Server<TInjected & TNew> & TNew;
};

/**
 * `OnRequestType` represents the data available when the server processes an incoming request from a client.
 * It includes the request context, server instance, and response object. The server instance includes both core methods and any properties injected by extensions (`TInjected`).
 *
 * @template TInjected - The type of properties injected by extensions via `injectProperties()`. Defaults to `any`.
 *
 * @property `request.trigger` - The name of the trigger invoked by the client.
 * @property `request.client` - Client credentials associated with the request.
 * @property `request.payload` - The payload of the request.
 * @property `server` - The server instance, including core methods and any injected properties.
 * @property `response.status` - The HTTP-like status code of the response.
 * @property `response.performance.size` - The size of the response payload (in bytes).
 * @property `response.performance.time` - The time taken to process the request (in milliseconds).
 * @property `response.data` - The response payload, or `null` if no data is returned.
 *
 * @example
 * onRequest({ request, server, response }: OnRequestType<{ newProperty: string }>) {
 *     console.log(server.newProperty);
 * }
 */
export type OnRequestEndType<TInjected extends object = any> = {
    request: {
        trigger: string;
        client: CredentialsType;
        payload: any;
    };
    server: ServerExtensionsType<TInjected> & TInjected;
    response: {
        status: number;
        performance: {
            size: number;
            time: number;
        };
        data: JSON | null;
    };
};


/**
 * Context passed to `onStart` hooks.
 *
 * Represents the server instance at startup, including core methods and any injected properties from extensions (`TInjected`).
 *
 * @template TInjected - The type of properties injected by extensions via `injectProperties()`. Defaults to `any`.
 * @example
 * onStart(server) {
 *     server.newProperty('Hello, world!'); // Output: 'Hello, world!'
 * }
 */
// export type OnStartType<TInjected extends object = any> = TInjected & ServerExtensionsType
export type OnStartType<TInjected extends object> = Server<TInjected> & TInjected

/**
 * OnErrorType represents the server instance and the error that occurred.
 * This server instance includes core methods and any injected properties from extensions (`TInjected`).
 *
 * @template TInjected - The type of properties injected by extensions via `injectProperties()`. Defaults to `any`.
 * @property server - The server instance, including core methods and injected properties.
 * @property error - The error that occurred.
 * @example
 * onError({ server, error }) {
 *     console.log(error.message); // Output: 'Error message'
 * }
 */
export type OnErrorType<TInjected extends object = any> = {
    request: {
        client: ClientTypes
        trigger: string;
        payload: any
    }
    server: ServerExtensionsType<TInjected> & TInjected & Server
    error: Error
}

/**
 * `OnRequestBeginType` type represents the data available when the server begins processing an incoming request from a client.
 * It provides access to both the incoming request context and the server instance, including any properties injected by extensions (`TInjected`).
 *
 * @template TInjected - The type of properties injected by extensions via `injectProperties()`. Defaults to `any`.
 *
 * @property request.client - The client information about who sent the request.
 * @property request.trigger - The name of the trigger invoked by the client.
 * @property request.payload - The payload of the request.
 * @property server - The server instance, including core methods and any injected properties.
 *
 * @example
 * onRequestBegin({ server }: OnRequestBeginType<{ newProperty: string }>) {
 *     console.log(server.newProperty); // Output: 'Hello, world!'
 * }
 */
export type OnRequestBeginType<TInjected extends object = any> = {
    request: {
        client: ClientTypes;
        trigger: string;
        payload: any;
    };
    server: ServerExtensionsType<TInjected> & TInjected & Server;
};


