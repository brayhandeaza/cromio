import { loggerExtension, LoggerOptionsType } from "./logger";
import { prometheusMetrics, PrometheusMetricsOptions } from "./prometheus";

export class Extensions {
    static prometheusMetrics(options: PrometheusMetricsOptions = { port: 7000, includeTriggers: [] }) {
        return prometheusMetrics(options);
    }

    static loggerExtension(options: LoggerOptionsType = { showOnRequestBegin: true, showOnRequestEnd: true }) {
        return loggerExtension(options);
    }
}


