import { register, collectDefaultMetrics } from "prom-client";


import * as serverPrometheusMetrics from "../core/server/src/extensions/prometheus";
import * as serverRequestRateLimiter from "../core/server/src/extensions/rateLimit"

import * as clientJaegerTracing from "../core/client/src/extensions/jaeger";
import * as clientLoggerExtension from "../core/client/src/extensions/logger";
import * as clientPrometheusMetrics from "../core/client/src/extensions/prometheus";


export class Extensions {
    static serverRequestRateLimiter = (option?: serverRequestRateLimiter.RateLimitOptionsType) => {
        return serverRequestRateLimiter.requestRateLimiter(option || {})
    }

    static serverPrometheusMetrics = (options?: serverPrometheusMetrics.PrometheusMetricsOptions) => {
        if (options?.defaultMetrics)
            collectDefaultMetrics({ register });

        return serverPrometheusMetrics.prometheusMetrics(options || {}, register)
    }

    static prometheusMetrics(options: clientPrometheusMetrics.PrometheusMetricsOptions = { port: 7000, includeTriggers: [] }) {
        if (options?.defaultMetrics)
            collectDefaultMetrics({ register });
        
        return clientPrometheusMetrics.prometheusMetrics(options, register);
    }

    static loggerExtension(options: clientLoggerExtension.LoggerOptionsType = { showOnRequestBegin: true, showOnRequestEnd: true }) {
        return clientLoggerExtension.loggerExtension(options);
    }

    static jaegerTracing(options?: clientJaegerTracing.JaegerTracingOptions) {
        return clientJaegerTracing.jaegerTracing(options);
    }
}

