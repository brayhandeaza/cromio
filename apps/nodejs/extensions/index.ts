import {register, collectDefaultMetrics } from "prom-client";


import * as serverPrometheusMetrics from "../server/src/extensions/prometheus";
import * as serverRequestRateLimiter from "../server/src/extensions/rateLimit"

import * as clientJaegerTracing from "../client/src/extensions/jaeger";
import * as clientLoggerExtension from "../client/src/extensions/logger";
import * as clientPrometheusMetrics from "../client/src/extensions/prometheus";


collectDefaultMetrics({ register });

export class Extensions {
    static serverRequestRateLimiter = (option?: serverRequestRateLimiter.RateLimitOptionsType) => {
        return serverRequestRateLimiter.requestRateLimiter(option || {})
    }

    static serverPrometheusMetrics = (options?: serverPrometheusMetrics.PrometheusMetricsOptions) => {
        return serverPrometheusMetrics.prometheusMetrics(options || {}, register)
    }

    static prometheusMetrics(options: clientPrometheusMetrics.PrometheusMetricsOptions = { port: 7000, includeTriggers: [] }) {
        return clientPrometheusMetrics.prometheusMetrics(options, register);
    }

    static loggerExtension(options: clientLoggerExtension.LoggerOptionsType = { showOnRequestBegin: true, showOnRequestEnd: true }) {
        return clientLoggerExtension.loggerExtension(options);
    }

    static jaegerTracing(options?: clientJaegerTracing.JaegerTracingOptions) {
        return clientJaegerTracing.jaegerTracing(options);
    }
}

