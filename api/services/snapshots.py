"""Last successful analytics snapshots, shared through Upstash Redis."""

import asyncio
import json
import logging
import time
from collections import OrderedDict
from uuid import uuid4

import httpx

from core.config import settings
from models import AllStats
from .client import http_client

logger = logging.getLogger(__name__)
FRESH_SECONDS = 300
RETENTION_SECONDS = 30 * 86400
# Lifetime PostHog queries take anywhere from 10s to over 40s each. The page
# shows the saved snapshot while this runs, so a long refresh costs no one a
# blank screen. vercel.json allows the function 300s.
REFRESH_SECONDS = 240
LOCK_SECONDS = 250
RETRY_SECONDS = 60
PREFIX = "analytics:v1:"
_memory: OrderedDict[str, dict] = OrderedDict()
_leases: dict[str, tuple[str, float]] = {}


def configured() -> bool:
    return bool(settings.upstash_redis_rest_url and settings.upstash_redis_rest_token)


async def command(*args):
    # Bound the entire storage operation, including connect and read time.
    async with asyncio.timeout(2):
        response = await http_client.post(
            settings.upstash_redis_rest_url.rstrip("/"),
            headers={"Authorization": f"Bearer {settings.upstash_redis_rest_token}"},
            json=list(args),
            timeout=2,
        )
        response.raise_for_status()
        body = response.json()
        if "error" in body:
            raise RuntimeError("Snapshot storage rejected the command")
        return body["result"]


def failures(exc: BaseException) -> list[list[BaseException]]:
    """Flatten task groups into one cause chain per failed provider query."""
    if isinstance(exc, BaseExceptionGroup):
        return [chain for inner in exc.exceptions for chain in failures(inner)]
    chain = [exc]
    while chain[-1].__cause__ is not None:
        chain.append(chain[-1].__cause__)
    return [chain]


def describe_failure(exc: BaseException) -> str:
    # Provider errors carry the request URL and status, never the API key.
    return "; ".join(
        " <- ".join(f"{type(e).__name__}: {e}" for e in chain) for chain in failures(exc)
    )


def remember(key: str, snapshot: dict):
    _memory[key] = snapshot
    _memory.move_to_end(key)
    while len(_memory) > 100:
        _memory.popitem(last=False)


async def read(key: str) -> dict | None:
    snapshot = _memory.get(key)
    if configured():
        try:
            raw = await command("GET", PREFIX + key)
            if raw:
                candidate = json.loads(raw)
                candidate["data"] = AllStats.model_validate(candidate["data"]).model_dump(mode="json")
                candidate["saved_at"] = float(candidate["saved_at"])
                snapshot = candidate
                remember(key, snapshot)
        except Exception:
            logger.warning("Snapshot storage read failed; using instance cache")
    if snapshot and time.time() - snapshot["saved_at"] < RETENTION_SECONDS:
        return snapshot
    return None


async def save(key: str, snapshot: dict):
    if configured():
        # Do not claim a shared refresh succeeded if persistence failed.
        await command("SET", PREFIX + key, json.dumps(snapshot), "EX", RETENTION_SECONDS)
    remember(key, snapshot)


async def acquire(key: str) -> str | None:
    token = uuid4().hex
    if configured():
        acquired = await command("SET", PREFIX + key + ":lock", token, "NX", "EX", LOCK_SECONDS)
        return token if acquired == "OK" else None
    now = time.monotonic()
    for expired in [k for k, (_, until) in _leases.items() if until <= now]:
        _leases.pop(expired, None)
    if key in _leases:
        return None
    _leases[key] = (token, now + LOCK_SECONDS)
    return token


async def release(key: str, token: str):
    if configured():
        try:
            await command(
                "EVAL",
                "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
                1, PREFIX + key + ":lock", token,
            )
        except Exception:
            logger.warning("Snapshot lock release failed; lease will expire")
    elif _leases.get(key, (None,))[0] == token:
        _leases.pop(key, None)


def result(snapshot: dict | None, *, refreshing=False, error=None) -> dict:
    stale = not snapshot or time.time() - snapshot["saved_at"] >= FRESH_SECONDS
    return {
        "data": snapshot["data"] if snapshot else None,
        "error": error if not snapshot else None,
        "cache": {
            "stale": bool(stale),
            "refreshing": refreshing,
            "refresh_error": error or ((snapshot or {}).get("refresh_error") if time.time() < (snapshot or {}).get("retry_at", 0) else None),
            "retry_after": max(0, int((snapshot or {}).get("retry_at", 0) - time.time())),
        },
    }


async def get_snapshot(key: str, factory, *, refresh: bool = False) -> dict:
    snapshot = await read(key)
    if snapshot and (not refresh or time.time() < snapshot.get("retry_at", 0)):
        refreshing = False
        if time.time() - snapshot["saved_at"] >= FRESH_SECONDS:
            try:
                refreshing = bool(await command("GET", PREFIX + key + ":lock")) if configured() else _leases.get(key, (None, 0))[1] > time.monotonic()
            except Exception:
                pass  # The snapshot remains usable during a Redis outage.
        return result(snapshot, refreshing=refreshing)

    token = None
    try:
        token = await acquire(key)
        if not token:
            return result(snapshot, refreshing=True)
        # A concurrent invocation may have completed between our read and lock.
        latest = await read(key)
        if latest and (not snapshot or latest["saved_at"] > snapshot["saved_at"]):
            return result(latest)
        # Coalesce repeated refresh clicks for a freshly generated snapshot.
        if latest and time.time() - latest["saved_at"] < 10:
            return result(latest)
        async with asyncio.timeout(REFRESH_SECONDS):
            data = await factory()
        snapshot = {"saved_at": time.time(), "data": data.model_dump(mode="json")}
        await save(key, snapshot)
        return result(snapshot)
    except Exception as exc:
        logger.warning("Analytics refresh failed for %s: %s", key, describe_failure(exc))
        # Re-read the previous successful snapshot if the new write failed.
        previous = await read(key)
        timed_out = any(isinstance(e, (TimeoutError, httpx.TimeoutException)) for chain in failures(exc) for e in chain)
        message = "Analytics refresh timed out. Try again shortly." if timed_out else "Analytics refresh failed. Try again shortly."
        if previous:
            previous = {**previous, "refresh_error": message, "retry_at": time.time() + RETRY_SECONDS}
            try:
                await save(key, previous)
            except Exception:
                remember(key, previous)
        return result(previous, error=message)
    finally:
        if token:
            await release(key, token)
