/**
 * Configuration and logic for a rate limiter.
 * @property limit - The maximum number of allowed actions (tokens) within the interval.
 * @property interval - The time window (in milliseconds) for refilling the token bucket.
 * @property check - Function to check whether the given IP address is currently allowed to perform an action.
 */
export type RateLimiter = {
    limit: number;
    interval: number;
    check: (ip: string) => boolean;
};

/**
 * Represents the state of a token bucket used for rate limiting.
 * @property tokens - The current number of available tokens.
 * @property lastRefill - The timestamp (in milliseconds) when the bucket was last refilled.
 */
export type RateLimitBucket = {
    tokens: number;
    lastRefill: number;
};

/**
 * Options for configuring a rate limiter instance.
 * @property limit - The maximum number of allowed actions (tokens) within the interval. If not provided, a default value will be used.
 * @property interval - The time window (in milliseconds) for refilling the token bucket. If not provided, a default value will be used.
 */
export type RateLimitOptionsType = {
    limit?: number;
    interval?: number;
};
