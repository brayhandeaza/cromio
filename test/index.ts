import cron from 'node-cron';
import { ServerExtension } from '../src';


type RateLimitBucket = {
    tokens: number;
    lastRefill: number;
};

type RateLimiter = {
    limit: number;
    interval: number;
    check: (ip: string) => boolean;
};

export const rateLimitExtension = ({ limit, interval }: { limit: number, interval: number }): ServerExtension<{ rateLimiter: RateLimiter }> => {
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
                for (const [ip, bucket] of buckets.entries()) {
                    if (now - bucket.lastRefill > interval * 1.5) {
                        buckets.delete(ip);
                        console.log(`[RateLimit] Cleaned inactive IP bucket: ${ip}`);
                    }
                }
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
        onRequest({ server, request }) {
            const ip = request.client.ip;
            const allowed = server.rateLimiter.check(ip);

            console.log({ ip, allowed });
            if (!allowed) {
                throw `Client ${ip} has exceeded the rate limit of ${server.rateLimiter.limit} requests every ${server.rateLimiter.interval / 1000} seconds. Please try again later.`
            }
        },
        onStart({ server }) {
            console.log("[RateLimit] Rate limiter initialized.");
        }
    };
};