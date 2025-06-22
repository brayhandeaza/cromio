from viper.extensions.builtin.PrometheusExtension import PrometheusExtension

class Extensions:
    @staticmethod
    def prometheusMetrics(name: str = "viper_rpc_server", show_logs: bool = True, port: int = 2048) -> PrometheusExtension:
        return PrometheusExtension(name, show_logs, port)