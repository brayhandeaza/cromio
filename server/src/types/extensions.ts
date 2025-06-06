import { ClientFromServerType, CredentialsType, ServerExtension, TriggerCallback, TriggerDefinitionType } from ".";
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
    client: ClientFromServerType;
    clients: Map<string, ClientFromServerType>;
    registerTriggerDefinition: (triggers: TriggerDefinitionType) => void;
    addTrigger(name: string, ...callbacks: MiddlewareCallback[]): void;
    addMiddleware(callback: MiddlewareCallback): void;
    addGlobalMiddleware(...callbacks: MiddlewareCallback[]): void;
    addExtension<TNew extends {}>(...exts: ServerExtension<TNew>[]): asserts this is Server<TInjected & TNew> & TNew;
};

/**
    * This type includes both core methods and any injected properties from extensions (`TInjected`).
    * @template TInjected - The type of properties injected by extensions via `injectProperties()`. Defaults to `any`.    
    * @property request.trigger - The name of the trigger invoked by the client.
    * @property request.credentials - Client credentials associated with the request.
    * @property request.payload - The payload of the request.
    * @property server - The server instance, including core methods and injected properties.
    *
    * @example
    * onRequest({ request, server }) {
    *     console.log(server.newProperty); // Output: 'Hello, world!' 
    * }
 */
export type OnRequestType<TInjected extends object = any> = {
    request: {
        trigger: string;
        credentials: CredentialsType;
        payload: any;
    };
    server: ServerExtensionsType<TInjected> & TInjected;
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
export type OnStartType<TInjected extends object = any> = TInjected & ServerExtensionsType

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
    server: ServerExtensionsType<TInjected> & TInjected;
    error: Error;
};

