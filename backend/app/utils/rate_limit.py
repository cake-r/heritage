"""Simple in-memory rate limiter for sensitive endpoints (login, etc.).

Uses a sliding-window approach. Not distributed — suitable for single-process deployments.
"""

import time
from collections import defaultdict


class RateLimiter:
    """Sliding-window rate limiter keyed by IP or username."""

    def __init__(self, max_requests: int = 5, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._attempts: defaultdict[str, list[float]] = defaultdict(list)

    def _prune(self, key: str, now: float) -> None:
        cutoff = now - self.window_seconds
        self._attempts[key] = [t for t in self._attempts[key] if t > cutoff]

    def is_allowed(self, key: str) -> bool:
        now = time.time()
        self._prune(key, now)
        return len(self._attempts[key]) < self.max_requests

    def record_attempt(self, key: str) -> None:
        now = time.time()
        self._prune(key, now)
        self._attempts[key].append(now)

    def reset(self, key: str) -> None:
        self._attempts.pop(key, None)


# Global instance for login rate limiting
login_limiter = RateLimiter(max_requests=5, window_seconds=60)
