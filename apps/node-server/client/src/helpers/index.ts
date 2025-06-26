import zlib from 'zlib';
import { promisify } from 'util';


export const safeStringify = (input: any): string => {
	try {
		return JSON.stringify(input).replaceAll(/{}\s*/g, '').trim();
	} catch (err) {
		return String(input);
	}
}

export const calculateConcurrency = (memoryUsedMB: number): number => {
	if (memoryUsedMB < 100) return 10;
	if (memoryUsedMB < 200) return 7;
	if (memoryUsedMB < 300) return 5;
	if (memoryUsedMB < 400) return 3;
	return 1;
}

export const gzip = promisify(zlib.gzip);
export const unzip = promisify(zlib.unzip);


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