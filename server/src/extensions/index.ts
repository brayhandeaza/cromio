import { prometheusMetrics, PrometheusMetricsOptions } from "./prometheus";
import { RateLimitOptionsType, requestRateLimiter } from "./rateLimit"


export class Extensions {
    static requestRateLimiter = (option?: RateLimitOptionsType) => {
        return requestRateLimiter(option || {});
    };
    static prometheusMetrics(options: PrometheusMetricsOptions) {
        return prometheusMetrics(options);
    }
}