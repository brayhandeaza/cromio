from viper.extensions.builtin.prometheus import PrometheusExtension
from viper.extensions.builtin.prometheus.utils import ExtraCallbacksType

class Extensions:
    @staticmethod
    def prometheusMetrics(name: str = "viper_rpc_server", show_logs: bool = True, port: int = 2048, callbacks: ExtraCallbacksType = {}) -> PrometheusExtension:
        return PrometheusExtension(name, show_logs, port, callbacks)