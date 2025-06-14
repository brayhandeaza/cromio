export { register } from "prom-client";


export interface PrometheusMetricsOptions {
    name?: string;
    showLogs?: boolean;
    port?: number;
    includeTriggers?: string[];
    excludeTriggers?: string[];
}

export function shouldTrackTrigger(trigger: string, opts: PrometheusMetricsOptions): boolean {
    if (opts.includeTriggers?.length === 0) return true;
    if (opts.includeTriggers && !opts.includeTriggers.includes(trigger)) return false;
    if (opts.excludeTriggers && opts.excludeTriggers.includes(trigger)) return false;
    return true;
}


export function safeStringify(obj: any) {
    return JSON.stringify(obj, (key, value) =>
        key === "credentials" ? undefined : value
    );
}
