import cron from 'node-cron';
import { OnRequestType, ServerExtension } from '../../types';
import { RateLimitBucket, RateLimiter, RateLimitOptionsType } from './utils';
export type { RateLimitOptionsType } from './utils';

export const requestRateLimiter = ({ limit = 100, interval = 60000 }: RateLimitOptionsType): ServerExtension<{ rateLimiter: RateLimiter }> => {
    return {
        
        injectProperties() {
            const buckets = new Map<string, RateLimitBucket>();
            const refill = (bucket: RateLimitBucket) => {
                const now = Date.now();
                const elapsed = now - bucket.lastRefill;
                const tokensToAdd = (elapsed / interval) * limit; // fractional tokens
                if (tokensToAdd >= 1) {
                    bucket.tokens = Math.min(limit, bucket.tokens + Math.floor(tokensToAdd));
                    bucket.lastRefill = now;
                }
            }

            // Clean inactive buckets using cron every minute
            cron.schedule('* * * * *', () => {
                const now = Date.now();
                for (const [ip, bucket] of buckets.entries())
                    if (now - bucket.lastRefill > interval * 1.5)
                        buckets.delete(ip);
            });

            return {
                rateLimiter: {
                    limit,
                    interval,
                    check(ip: string): boolean {
                        let bucket = buckets.get(ip);
                        if (!bucket) {
                            bucket = { tokens: limit, lastRefill: Date.now() };
                            buckets.set(ip, bucket);
                        }

                        refill(bucket);
                        if (bucket.tokens >= 1) {
                            bucket.tokens -= 1;
                            return true;
                        }

                        return false;
                    },
                },
            };
        },
        onRequest({ request, server }: OnRequestType<{ rateLimiter: RateLimiter }>) {
            try {
                const ip = request.credentials.ip;
                const allowed = server.rateLimiter.check(ip);
                if (!allowed)
                    throw new Error(JSON.stringify([{
                        message: `Client ${ip} has exceeded the rate limit of ${server.rateLimiter.limit} requests every ${server.rateLimiter.interval / 1000} seconds. Please try again later.`
                    }]));


            } catch (error) { throw error }
        }
    }
}
