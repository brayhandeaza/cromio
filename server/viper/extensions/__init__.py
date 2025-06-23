from viper.extensions.builtin.prometheus import PrometheusExtension
from viper.extensions.builtin.prometheus.utils import ExtraCallbacksType
from viper.extensions.builtin.rateLimiter import RequestRateLimiter


class Extensions:
    @staticmethod
    def prometheusMetrics(name: str = "viper_rpc_server", show_logs: bool = True, port: int = 2048, callbacks: ExtraCallbacksType = {}) -> PrometheusExtension:
        return PrometheusExtension(name, show_logs, port, callbacks)

    @staticmethod
    def requestRateLimiter(limit: int = 100, interval: int = 60000) -> RequestRateLimiter:
        return RequestRateLimiter(limit=limit, interval=interval)
