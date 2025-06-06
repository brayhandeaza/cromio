import { RateLimitOptionsType, requestRateLimiter } from "./rateLimit"


export class Extensions {
    static requestRateLimiter = (option?: RateLimitOptionsType) => {
        return requestRateLimiter(option || {});
    };
}