"""Simple async-safe in-process TTL cache for serverless environments."""

import time
import asyncio
from typing import Any, Awaitable, Callable

_cache: dict[str, tuple[float, Any]] = {}
_locks: dict[str, asyncio.Lock] = {}
_global_lock = asyncio.Lock()


async def cached(
    key: str, ttl_seconds: int, factory: Callable[[], Awaitable[Any]]
) -> Any:
    """
    Return cached value if fresh, otherwise call factory() and cache the result.
    Uses per-key locks to prevent thundering herd on concurrent requests.
    """
    now = time.monotonic()
    entry = _cache.get(key)
    if entry and (now - entry[0]) < ttl_seconds:
        return entry[1]

    # Get or create a per-key lock
    async with _global_lock:
        if key not in _locks:
            _locks[key] = asyncio.Lock()
        lock = _locks[key]

    async with lock:
        # Double-check after acquiring lock
        entry = _cache.get(key)
        now = time.monotonic()
        if entry and (now - entry[0]) < ttl_seconds:
            return entry[1]

        result = await factory()
        _cache[key] = (time.monotonic(), result)

        # Evict expired entries if cache grows large
        if len(_cache) > 100:
            cutoff = time.monotonic()
            _cache.update(
                {k: v for k, v in _cache.items() if (cutoff - v[0]) < ttl_seconds}
            )

        return result
