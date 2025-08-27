import json
from cromio.extensions.utils import BaseExtension
from cromio.typing import OnRequestEndType
from typing import Dict
import threading
import time


class RateLimitBucket:
    def __init__(self, tokens: int, last_refill: float):
        self.tokens = tokens
        self.last_refill = last_refill


class RequestRateLimiter(BaseExtension):
    def __init__(self, limit: int = 100, interval: int = 60000):
        super().__init__()
        self.limit = limit
        self.interval = interval  # in milliseconds
        self.buckets: Dict[str, RateLimitBucket] = {}

        # Start the cleanup cron job
        self._start_cron_cleanup()

    def _start_cron_cleanup(self):
        def cleanup():
            now = time.time() * 1000  # milliseconds
            expired = []
            for ip, bucket in list(self.buckets.items()):
                if now - bucket.last_refill > self.interval * 1.5:
                    expired.append(ip)
            for ip in expired:
                del self.buckets[ip]

            # Schedule next run in 60 seconds
            threading.Timer(60.0, cleanup).start()

        # First run
        cleanup()

    def _refill_bucket(self, bucket: RateLimitBucket):
        now = time.time() * 1000  # milliseconds
        elapsed = now - bucket.last_refill
        tokens_to_add = (elapsed / self.interval) * self.limit
        if tokens_to_add >= 1:
            bucket.tokens = min(self.limit, bucket.tokens + int(tokens_to_add))
            bucket.last_refill = now

    def _check_ip(self, ip: str) -> bool:
        bucket = self.buckets.get(ip)
        if not bucket:
            bucket = RateLimitBucket(
                tokens=self.limit, last_refill=time.time() * 1000)
            self.buckets[ip] = bucket

        self._refill_bucket(bucket)
        if bucket.tokens >= 1:
            bucket.tokens -= 1
            return True
        return False

    def on_request_end(self, context: OnRequestEndType):
        request = context.get("request", {})
        client = request.get("client", {})
        ip = client.get("ip", "*")

        allowed = self._check_ip(ip)
        if not allowed:
            raise BaseException("Rate limit exceeded")
