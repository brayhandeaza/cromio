import { prometheusMetrics, PrometheusMetricsOptions } from "./prometheus";
import { RateLimitOptionsType, requestRateLimiter } from "./rateLimit"
import { LoggerOptionsType, loggerExtension } from "./logger"



export const Extensions = {
    requestRateLimiter: (option?: RateLimitOptionsType) => requestRateLimiter(option || {}),
    prometheusMetrics: (options?: PrometheusMetricsOptions) => prometheusMetrics(options || {}),
    loggerExtension: (options?: LoggerOptionsType) => loggerExtension(options || {})
}

