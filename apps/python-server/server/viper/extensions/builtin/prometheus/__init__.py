from viper.extensions.utils import BaseExtension
from viper.typing import OnRequestBeginType, OnRequestEndType, OnRequestErrorType
import viper.extensions.builtin.prometheus.utils as Utils


class PrometheusExtension(BaseExtension):
    def __init__(self, name="viper_rpc_server", show_logs=True, port=2048, callbacks: Utils.ExtraCallbacksType = {}):
        super().__init__()

        self.show_logs = show_logs
        self.callbacks = callbacks

        # Start custom HTTP server for pretty metrics
        Utils.start_metrics_server(port, show_logs)

        # Initialize Prometheus metrics
        self.dropped_requests_total = Utils.dropped_requests_total(name)
        self.total_responses = Utils.total_responses(name)
        self.pending_requests = Utils.pending_requests(name)
        self.request_duration_seconds = Utils.request_duration_seconds(name)
        self.response_size_bytes = Utils.response_size_bytes(name)

    def on_request_begin(self, context: OnRequestBeginType):
        request = context.get("request", {})
        trigger = request.get("trigger", "")
        client = request.get("client", {})
        self.pending_requests.labels(trigger=trigger, client=client).inc()

        on_request_begin_callback = self.callbacks.get("on_request_begin")
        if on_request_begin_callback:
            on_request_begin_callback(context)

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

        on_request_end_callback = self.callbacks.get("on_request_end")
        if on_request_end_callback:
            on_request_end_callback(context)

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

        on_error_callback = self.callbacks.get("on_error")
        if on_error_callback:
            on_error_callback(context)
