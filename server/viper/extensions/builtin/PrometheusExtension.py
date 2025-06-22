from viper.extensions.utils import BaseExtension
from prometheus_client import Histogram, Gauge, generate_latest, CONTENT_TYPE_LATEST
from http.server import BaseHTTPRequestHandler, HTTPServer
from threading import Thread
from viper.typing import OnRequestBeginType, OnRequestEndType, OnRequestErrorType


class PrometheusExtension(BaseExtension):
    def __init__(self, name="viper_rpc_server", show_logs=True, port=2048):
        super().__init__()

        self.show_logs = show_logs

        # Start custom HTTP server for pretty metrics
        self._start_metrics_server(port)

        if show_logs:
            print(
                f"🚀 Prometheus metrics exposed at: http://localhost:{port}/metrics")

        self.dropped_requests_total = Gauge(
            name=f"{name}_dropped_requests_total",
            documentation="Total number of dropped (cancelled/timed-out) requests",
            labelnames=["trigger", "client", "reason"]
        )

        self.total_responses = Gauge(
            name=f"{name}_total_responses",
            documentation="Total number of responses by trigger, status, and data",
            labelnames=["trigger", "client", "status"]
        )

        self.pending_requests = Gauge(
            name=f"{name}_pending_requests",
            documentation="Current number of pending requests",
            labelnames=["trigger", "client"]
        )

        self.request_duration_seconds = Histogram(
            name=f"{name}_request_duration_seconds",
            documentation="Requests duration in seconds",
            labelnames=["trigger", "client", "status"],
            buckets=[0.005, 0.01, 0.025, 0.05,
                     0.075, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]
        )

        self.response_size_bytes = Histogram(
            name=f"{name}_response_size_bytes",
            documentation="Size of the responses sent back",
            labelnames=["trigger", "client"],
            buckets=[100, 500, 1000, 5000, 10000, 50000, 100000, 500000]
        )

    def _start_metrics_server(self, port):
        show_logs = self.show_logs

        class MetricsHandler(BaseHTTPRequestHandler):
            def do_GET(self):
                if self.path != "/metrics":
                    self.send_response(404)
                    self.end_headers()
                    return

                # Pretty-format metrics: insert line breaks between metric families
                raw = generate_latest().decode("utf-8")
                pretty = "\n".join(
                    ["\n" + line if line.startswith("# HELP") else line
                     for line in raw.strip().splitlines()]
                )

                self.send_response(200)
                self.send_header("Content-Type", CONTENT_TYPE_LATEST)
                self.end_headers()
                self.wfile.write(pretty.encode("utf-8"))

            # 🔇 Suppress logs completely
            def log_message(self, _, *__):
                pass

        def run():
            server = HTTPServer(("localhost", port), MetricsHandler)
            server.serve_forever()

        thread = Thread(target=run, daemon=True)
        thread.start()

    def on_request_begin(self, context: OnRequestBeginType):
        request = context.get("request", {})
        trigger = request.get("trigger", "")
        client = request.get("client", {})
        self.pending_requests.labels(trigger=trigger, client=client).inc()

    def on_request_end(self, context: OnRequestEndType):
        request = context.get("request", {})
        response = context.get("response", {})

        client = request.get("client", {})
        trigger = request.get("trigger", "")
        status = response.get("status", 200)
        performance = response.get("performance", {})
        duration = performance.get("time", 0)
        size = performance.get("size", 0)

        self.request_duration_seconds.labels(
            trigger=trigger, client=client, status=status
        ).observe(duration)

        self.total_responses.labels(
            trigger=trigger, client=client, status=status
        ).inc()

        self.response_size_bytes.labels(
            trigger=trigger, client=client
        ).observe(size)

        self.pending_requests.labels(
            trigger=trigger, client=client
        ).dec()

    def on_error(self, context: OnRequestErrorType):
        request = context.get("request", {})
        error = context.get("error")

        trigger = request.get("trigger")
        client = request.get("client", {})
        reason = str(error)

        self.dropped_requests_total.labels(
            trigger=trigger,
            client=client,
            reason=reason
        ).inc()
