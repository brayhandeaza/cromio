
export interface LoggerOptionsType {
    includeTriggers?: string[];
    excludeTriggers?: string[];
    showPayload?: boolean;
    showOnRequestBegin?: boolean;
    showOnRequestEnd?: boolean;
    showResponse?: boolean;
    maskFields?: string[];
}

export function formatBytes(bytes: number) {
    if (bytes === 0) return '0 Bytes';

    const units = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const k = 1024;

    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const size = bytes / Math.pow(k, i);

    // Show up to 2 decimal places only if necessary
    const formatted = size % 1 === 0 ? size.toFixed(0) : size.toFixed(2);

    return `${formatted} ${units[i]}`;
}


export function shouldLogTrigger(trigger: string, opts: LoggerOptionsType = { showOnRequestBegin: true, showOnRequestEnd: true }): boolean {
    if (opts.includeTriggers && !opts.includeTriggers.includes(trigger)) return false;
    if (opts.excludeTriggers && opts.excludeTriggers.includes(trigger)) return false;
    return true;
}

export function mask(obj: any, fields: string[] = []): any {
    if (!obj || typeof obj !== 'object') return obj;

    const clone = JSON.parse(JSON.stringify(obj));
    fields.forEach(field => {
        if (clone[field] !== undefined) clone[field] = '[MASKED]';
    });

    return clone;
}
