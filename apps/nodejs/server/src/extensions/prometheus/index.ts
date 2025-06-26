import { OnErrorType, OnRequestBeginType, OnRequestEndType, ServerExtension } from "../../types"
import { collectDefaultMetrics } from 'prom-client';
import { PrometheusMetricsOptions, safeStringify, shouldTrackTrigger } from "./utils";
export { type PrometheusMetricsOptions } from "./utils"
import { Gauge, Histogram, register } from "prom-client";
import { ip } from "address"
import http from 'http';
import getPort from 'get-port';


collectDefaultMetrics({ register });

export function prometheusMetrics(options: PrometheusMetricsOptions): ServerExtension {
    const { showLogs = true, port, name = 'jrpc_server' } = options;

    const createHttpServer = async (): Promise<http.Server> => {
        const server = http.createServer();
        const PORT = port || await getPort({ port: 2048 });

        server.on('request', async (req, res) => {
            if (req.url === '/metrics' && req.method === 'GET') {
                const metrics = await register.metrics();
                res.writeHead(200, { 'Content-Type': register.contentType });
                res.end(metrics);
            } else {
                res.writeHead(404);
                res.end();
            }
        });

        server.listen(PORT, () => {
            if (showLogs)
                console.log(`🚀 Prometheus metrics exposed at: address=http://${ip()}:${PORT}/metrics`);
        });


        return Promise.resolve(server);
    }

    const droppedRequestsCounter = new Gauge({
        name: `${name}_dropped_requests_total`,
        help: 'Total number of dropped (cancelled/timed-out) requests',
        labelNames: ['trigger', 'client', 'reason'],
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

    (async () => {
        await createHttpServer();
    })();

    return {
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
            const { trigger } = request;
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
