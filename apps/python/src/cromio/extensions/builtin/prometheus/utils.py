from typing import Callable, TypedDict
from cromio.extensions.utils import BaseExtension
from prometheus_client import Histogram, Gauge, generate_latest, CONTENT_TYPE_LATEST
from http.server import BaseHTTPRequestHandler, HTTPServer
from threading import Thread
from cromio.typing import OnRequestBeginType, OnRequestEndType, OnRequestErrorType

class ExtraCallbacksType(TypedDict):
    on_request_begin: Callable[[OnRequestBeginType], None]
    on_request_end: Callable[[OnRequestEndType], None]
    on_error: Callable[[OnRequestErrorType], None]


def dropped_requests_total(name: str = "viper_rpc_server"):
    return Gauge(
        name=f"{name}_dropped_requests_total",
        documentation="Total number of dropped (cancelled/timed-out) requests",
        labelnames=["trigger", "client", "reason"]
    )


def total_responses(name: str = "viper_rpc_server"):
    return Gauge(
        name=f"{name}_total_responses",
        documentation="Total number of responses by trigger, status, and data",
        labelnames=["trigger", "client", "status"]
    )


def pending_requests(name: str = "viper_rpc_server"):
    return Gauge(
        name=f"{name}_pending_requests",
        documentation="Current number of pending requests",
        labelnames=["trigger", "client"]
    )


def request_duration_seconds(name: str = "viper_rpc_server"):
    return Histogram(
        name=f"{name}_request_duration_seconds",
        documentation="Requests duration in seconds",
        labelnames=["trigger", "client", "status"],
        buckets=[0.005, 0.01, 0.025, 0.05,
                 0.075, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]
    )


def response_size_bytes(name: str = "viper_rpc_server"):
    return Histogram(
        name=f"{name}_response_size_bytes",
        documentation="Size of the responses sent back",
        labelnames=["trigger", "client"],
        buckets=[100, 500, 1000, 5000, 10000, 50000, 100000, 500000]
    )


def start_metrics_server(port=2048, show_logs=True):
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
    if show_logs:
        print(
            f"🚀 Prometheus metrics exposed at: http://localhost:{port}/metrics")

