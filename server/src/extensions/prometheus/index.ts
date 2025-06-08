import Fastify from 'fastify';
import { OnErrorType, OnRequestBeginType, OnRequestEndType, ServerExtension } from "../../types"
import { collectDefaultMetrics } from 'prom-client';
import { PrometheusMetricsOptions, safeStringify, shouldTrackTrigger } from "./utils";
export { type PrometheusMetricsOptions } from "./utils"
import { Gauge, Histogram, register } from "prom-client";


collectDefaultMetrics({ register });

export function prometheusMetrics(options: PrometheusMetricsOptions): ServerExtension<{ timer: (_: { trigger: string; server: string; status: number }) => void }> {
    const { showLogs = true, port = 7001, name = 'jrpc_client' } = options;
    const server = Fastify();

    const droppedRequestsCounter = new Gauge({
        name: `${name}_dropped_requests_total`,
        help: 'Total number of dropped (cancelled/timed-out) requests',
        labelNames: ['trigger', 'client' , 'reason'],
        registers: [register],
    });

    const responseCounter = new Gauge({
        name: `${name}_total_responses`,
        help: 'Total number of responses by trigger, status, and data',
        labelNames: ["trigger", "client", "status"],
        registers: [register]
    });

    const pendingRequests = new Gauge({
        name: `${name}_pending_requests`,
        help: 'Current number of pending requests',
        labelNames: ['trigger', 'client'],
        registers: [register]
    });

    const requestDurationHistogram = new Histogram({
        name: `${name}_request_duration_seconds`,
        help: 'Requests duration in seconds',
        labelNames: ["trigger", "client", "status"],
        buckets: [0.005, 0.01, 0.025, 0.05, 0.075, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
        registers: [register]
    });

    const responseSizeHistogram = new Histogram({
        name: `${name}_response_size_bytes`,
        help: 'Size of the responses sent back',
        labelNames: ['trigger', 'client'],
        buckets: [100, 500, 1000, 5000, 10000, 50000, 100000, 500000],
        registers: [register]
    });

    server.listen({ port }, (err, address) => {
        if (err) {
            server.log.error(err);
            process.exit(1);
        };

        if (showLogs)
            console.log(`🚀 Prometheus metrics exposed at: address=${address}/metrics`);
    });

    server.get('/metrics', async (_, reply) => {
        reply.type('text/plain');
        reply.send(await register.metrics());
    });

    return {
        name,
        injectProperties() {
            return {
                timer: function (_: { trigger: string; server: string; status: number }) { },
            }
        },
        onRequestBegin({ request, server }: OnRequestBeginType<{ timer: () => void }>) {
            if (!shouldTrackTrigger(request.trigger, options)) return;

            pendingRequests.inc({
                trigger: request.trigger,
                client: safeStringify(server.client)
            })

            const timer = requestDurationHistogram.startTimer();
            server.timer = timer
        },
        onRequestEnd({ request, response, server }: OnRequestEndType<{ timer: (_: { trigger: string; client: string; status: number }) => void }>) {
            const { trigger, client } = request;
            if (!shouldTrackTrigger(trigger, options)) return;

            server.timer({
                trigger,
                client: safeStringify(server.client),
                status: response.status
            })

            responseCounter.inc({
                trigger,
                client: safeStringify(server.client),
                status: response.status
            });

            responseSizeHistogram.observe({
                trigger,
                client: safeStringify(server.client)
            }, response.performance.size ?? 0);

            pendingRequests.dec({
                trigger,
                client: safeStringify(server.client)
            })
        },
        onError({ server, error, request: { trigger, client } }: OnErrorType) {
            if (!shouldTrackTrigger(trigger, options)) return;

            droppedRequestsCounter.inc({ trigger, client: safeStringify(server.client), reason: error.message });
        },
    };
}
