import { Tracer } from "@opentelemetry/api";
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { Resource } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';

export type JaegerTracingOptions = {
    showLogs?: boolean;
    OTLPEndpoint?: string;
    name?: string;
    tracer?: Tracer; // Optional custom tracer
    includeTriggers?: string[];
    excludeTriggers?: string[];
}

export function shouldTraceTrigger(trigger: string, opts?: JaegerTracingOptions): boolean {
    if (opts?.includeTriggers && !opts?.includeTriggers.includes(trigger)) return false;
    if (opts?.excludeTriggers && opts?.excludeTriggers.includes(trigger)) return false;
    return true;
}

export const sdk = (serviceName: string, OTLPEndpoint?: string) => new NodeSDK({
    spanProcessor: new BatchSpanProcessor(new OTLPTraceExporter({
        url: OTLPEndpoint || 'http://localhost:4318/v1/traces',
    })),
    resource: new Resource({
        [ATTR_SERVICE_NAME]: serviceName,
    }),
    instrumentations: [getNodeAutoInstrumentations()],
})

export function safeStringify(obj: any) {
    return JSON.stringify(obj, (key, value) =>
        key === "credentials" ? undefined : value
    );
}

