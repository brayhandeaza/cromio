import { prometheusMetrics, PrometheusMetricsOptions } from "./prometheus";
import { RateLimitOptionsType, requestRateLimiter } from "./rateLimit"



export const Extensions = {
    requestRateLimiter: (option?: RateLimitOptionsType) => requestRateLimiter(option || {}),
    prometheusMetrics: (options?: PrometheusMetricsOptions) => prometheusMetrics(options || {}),
}

