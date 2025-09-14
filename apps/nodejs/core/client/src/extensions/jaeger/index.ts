import { ClientExtension, OnErrorType, OnRequestBeginType, OnRequestEndType, OnRequestRetryType } from '../../types';
import { Span, SpanKind, SpanStatusCode, context, trace, propagation } from '@opentelemetry/api';
import { JaegerTracingOptions, safeStringify, sdk, shouldTraceTrigger } from './utils';
import { PLATFORM } from '../../constants';
import { formatBytes } from '../../helpers';
export { type JaegerTracingOptions } from './utils'



export function jaegerTracing(options?: JaegerTracingOptions): ClientExtension<{ span: Span | null }> {
    const serviceName = options?.name || `@jrpc/client(${PLATFORM})`;
    const showLogs = options?.showLogs === undefined ? true : options.showLogs
    const tracer = trace.getTracer(serviceName);

    return {
        name: serviceName,
        injectProperties() {
            sdk(serviceName, options?.OTLPEndpoint)

            if (showLogs)
                console.log('🚀 [TRACE]: Jeager Tracing initialized');

            return {
                span: null
            }
        },
        onRequestBegin({ request, client }: OnRequestBeginType<{ span: Span }>) {
            if (!shouldTraceTrigger(request.trigger, options)) return;

            const span = tracer.startSpan(`${request.trigger}`, {
                kind: SpanKind.CLIENT,
                attributes: {
                    'jrpc.platform': PLATFORM,
                    'jrpc.trigger': request.trigger,
                    'jrpc.payload.size': formatBytes(Buffer.byteLength(JSON.stringify(request.payload))),
                    'jrpc.server.address': request.server.url
                }
            });

            span.setStatus({ code: SpanStatusCode.UNSET });

            const ctx = trace.setSpan(context.active(), span);
            propagation.inject(ctx, request.payload || {});

            context.with(ctx, () => {
                span.addEvent('onRequestBegin', {
                    'jrpc.server': safeStringify(request.server),
                    'jrpc.payload': safeStringify(request.payload),
                    'jrpc.trigger': request.trigger,
                    'jrpc.event.time': new Date().toISOString(),
                });
            });


            span.setStatus({
                code: SpanStatusCode.UNSET,
                message: "Request in progress",
            });

            if (showLogs)
                console.log(`[TRACE] ➜ Begin ${request.trigger} | Trace ID: ${span.spanContext().traceId}`);

            client.span = span;
        },
        onRequestEnd({ request, client, response }: OnRequestEndType<{ span: Span }>) {
            if (!shouldTraceTrigger(request.trigger, options)) return;

            const span = client.span;
            if (!span) return;

            span.setAttributes({
                'jrpc.response.size': formatBytes(Buffer.byteLength(JSON.stringify(response.data))),
                'http.status_code': response.status
            });

            span.addEvent('onRequestEnd', {
                'jrpc.status': response.status,
                'jrpc.body,size': formatBytes(Buffer.byteLength(safeStringify(response.data))),
                'jrpc.info': safeStringify(response.info),
                'jrpc.event.time': new Date().toISOString(),
            });

            span.setStatus({ code: SpanStatusCode.OK, message: 'Request completed' });
            span.end();

            if (showLogs)
                console.log(`[TRACE] ✔ Completed ${request.trigger} | Trace ID: ${span.spanContext().traceId}`);
        },
        onRequestRetry({ retryCount, request, client, error }: OnRequestRetryType<{ span: Span }>) {
            const span = client.span;
            if (!span) return;

            span.setAttributes({
                'jrpc.retry.count': retryCount,
                'jrpc.retry.active': true,
            });

            span.addEvent('onRequestRetry', {
                "jrpc.retry.count": retryCount,
                "jrpc.trigger": request.trigger,
                "jrpc.error": error?.message ?? 'unknown error',
                "jrpc.server": safeStringify(request.server),
                'jrpc.event.time': new Date().toISOString(),
            });

            if (error) {
                span.recordException(error);
                span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
            }

            if (showLogs)
                console.warn(`[TRACE] 🔁 Retry ${retryCount} on ${request.trigger} | Trace ID: ${span.spanContext().traceId}`);
        },
        onError({ error, request, client }: OnErrorType<{ span: Span }>) {
            const span = client.span;
            if (!span) return;

            span.setStatus({
                code: SpanStatusCode.ERROR,
                message: error.message,
            });

            span.recordException(error);
            span.setAttribute('jrpc.phase', 'error');

            span.addEvent('onError', {
                "jrpc.message": error.message,
                "jrpc.name": error.name,
                "jrpc.stack": error.stack,
                'jrpc.event.time': new Date().toISOString()
            });

            span.end();

            if (showLogs)
                console.error(`[TRACE] ✖ Error on ${request.trigger} | Trace ID: ${span.spanContext().traceId}`);
        }
    };
}
