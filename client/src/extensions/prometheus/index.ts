import Fastify from 'fastify';
import { ClientExtension, OnErrorType, OnRequestBeginType, OnRequestEndType, OnRequestRetryType } from "../../types"
import { collectDefaultMetrics } from 'prom-client';
import { PrometheusMetricsOptions, shouldTrackTrigger } from "./utils";
export { type PrometheusMetricsOptions } from "./utils"
import { Gauge, Histogram, register } from "prom-client";


collectDefaultMetrics({ register });

export function prometheusMetrics(options: PrometheusMetricsOptions): ClientExtension<{ timer: (_: { trigger: string; server: string; status: number }) => void }> {
    const { showLogs = true, port = 7001, name = 'jrpc_client' } = options;
    const server = Fastify();

    const retryCounter = new Gauge({
        name: `${name}_retries_request_total`,
        help: 'Total number of request retries',
        labelNames: ['trigger', 'client', 'server'],
        registers: [register],
    });

    const droppedRequestsCounter = new Gauge({
        name: `${name}_dropped_requests_total`,
        help: 'Total number of dropped (cancelled/timed-out) requests',
        labelNames: ['trigger', 'client', 'server', 'reason'],
        registers: [register],
    });

    const responseCounter = new Gauge({
        name: `${name}_total_responses`,
        help: 'Total number of responses by trigger, status, server, and data',
        labelNames: ["trigger", "server", "status"],
        registers: [register]
    });

    const pendingRequests = new Gauge({
        name: `${name}_pending_requests`,
        help: 'Current number of pending requests',
        labelNames: ['trigger', 'server'],
        registers: [register]
    });

    const errorCounter = new Gauge({
        name: `${name}_errors_total`,
        help: 'Total number of failed requests',
        labelNames: ['trigger', 'server', "status"],
        registers: [register]
    });

    const requestDurationHistogram = new Histogram({
        name: `${name}_request_duration_seconds`,
        help: 'Requests duration in seconds',
        labelNames: ["trigger", "server", "status"],
        buckets: [0.005, 0.01, 0.025, 0.05, 0.075, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
        registers: [register]
    });

    const responseSizeHistogram = new Histogram({
        name: `${name}_response_size_bytes`,
        help: 'Size of the responses sent back',
        labelNames: ['trigger', 'server'],
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
        onRequestRetry({ request, retryCount }: OnRequestRetryType) {
            const { trigger, server } = request;
            if (!shouldTrackTrigger(trigger, options)) return;

            retryCounter.set({
                trigger,
                server: server.url
            }, retryCount)
        },
        onRequestBegin({ request, client }: OnRequestBeginType<{ timer: () => void }>) {
            const { trigger, server, } = request;
            if (!shouldTrackTrigger(trigger, options)) return;

            pendingRequests.inc({
                trigger,
                server: server.url
            })

            const timer = requestDurationHistogram.startTimer();
            client.timer = timer
        },
        onRequestEnd({ request, response, client }: OnRequestEndType<{ timer: (_: { trigger: string; server: string; status: number }) => void }>) {
            const { trigger, server } = request;
            if (!shouldTrackTrigger(trigger, options)) return;

            client.timer({
                trigger,
                server: server.url,
                status: response.status
            })

            responseCounter.inc({
                trigger,
                server: server.url,
                status: response.status
            });

            responseSizeHistogram.observe({
                trigger,
                server: server.url
            }, response.info?.performance.size ?? 0);

            pendingRequests.dec({
                trigger,
                server: server.url
            })
        },
        onError({ client, error }: OnErrorType) {
            const { trigger, server } = client;
            if (!shouldTrackTrigger(trigger, options)) return;

            droppedRequestsCounter.inc({ trigger, client, server, reason: error.message });
        },
    };
}
