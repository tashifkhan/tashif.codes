import asyncio
import json
import sys
import time
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import AsyncMock, patch

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from core.config import settings
from models import AllStats, Metadata, Stats
from services import snapshots
from services.parallel import gather_queries
from services.posthog import query_posthog
from index import app


def stats():
    return AllStats(metadata=Metadata(export_date=datetime.now(timezone.utc), source="test"), timeseries=[], stats=Stats())


def saved(age=0):
    return {"saved_at": time.time() - age, "data": stats().model_dump(mode="json")}


class SnapshotTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        snapshots._memory.clear()
        snapshots._leases.clear()
        self.config = patch.object(settings, "upstash_redis_rest_url", "")
        self.config.start()
        self.addCleanup(self.config.stop)

    async def test_stale_read_returns_immediately_without_provider(self):
        old = saved(600)
        snapshots.remember("test", old)
        factory = AsyncMock()
        result = await snapshots.get_snapshot("test", factory)
        factory.assert_not_called()
        self.assertTrue(result["cache"]["stale"])
        self.assertEqual(result["data"], old["data"])

    async def test_failed_refresh_preserves_data_and_timestamp(self):
        old = saved(600)
        snapshots.remember("test", old)
        factory = AsyncMock(side_effect=RuntimeError("private provider error"))
        result = await snapshots.get_snapshot("test", factory, refresh=True)
        self.assertEqual(result["data"], old["data"])
        self.assertIsNone(result["error"])
        self.assertIn("failed", result["cache"]["refresh_error"])
        self.assertGreater(result["cache"]["retry_after"], 0)
        await snapshots.get_snapshot("test", factory, refresh=True)
        self.assertEqual(factory.await_count, 1)

    async def test_deadline_cancels_work_and_keeps_snapshot(self):
        snapshots.remember("test", saved(600))
        cancelled = asyncio.Event()
        async def slow():
            try:
                await asyncio.sleep(5)
            finally:
                cancelled.set()
        with patch.object(snapshots, "REFRESH_SECONDS", 0.01):
            result = await snapshots.get_snapshot("test", slow, refresh=True)
        self.assertTrue(cancelled.is_set())
        self.assertIn("timed out", result["cache"]["refresh_error"])
        self.assertNotIn("test", snapshots._leases)

    async def test_concurrent_refresh_is_deduplicated_and_pollable(self):
        old = saved(600)
        snapshots.remember("test", old)
        started, finish = asyncio.Event(), asyncio.Event()
        async def fetch():
            started.set()
            await finish.wait()
            return stats()
        factory = AsyncMock(side_effect=fetch)
        first = asyncio.create_task(snapshots.get_snapshot("test", factory, refresh=True))
        await started.wait()
        second = await snapshots.get_snapshot("test", factory, refresh=True)
        poll = await snapshots.get_snapshot("test", factory)
        self.assertTrue(second["cache"]["refreshing"])
        self.assertTrue(poll["cache"]["refreshing"])
        finish.set()
        done = await first
        self.assertFalse(done["cache"]["stale"])
        self.assertEqual(factory.await_count, 1)

    async def test_cold_failure_does_not_create_empty_snapshot(self):
        result = await snapshots.get_snapshot("test", AsyncMock(side_effect=RuntimeError()))
        self.assertIsNone(result["data"])
        self.assertIsNotNone(result["error"])
        self.assertNotIn("test", snapshots._memory)

    async def test_upstash_survives_instance_cache_reset(self):
        database = {}
        def redis(request):
            command, *args = json.loads(request.content)
            if command == "GET": result = database.get(args[0])
            elif command == "SET":
                if "NX" in args and args[0] in database: result = None
                else:
                    database[args[0]] = args[1]
                    result = "OK"
            elif command == "EVAL":
                key, token = args[-2:]
                result = int(database.get(key) == token)
                if result: database.pop(key)
            else: raise AssertionError(command)
            return httpx.Response(200, json={"result": result})
        async with httpx.AsyncClient(transport=httpx.MockTransport(redis)) as client:
            with patch.object(settings, "upstash_redis_rest_url", "https://redis.test"), patch.object(settings, "upstash_redis_rest_token", "test"), patch.object(snapshots, "http_client", client):
                initial = await snapshots.get_snapshot("test", AsyncMock(return_value=stats()))
                snapshots._memory.clear()
                factory = AsyncMock()
                later = await snapshots.get_snapshot("test", factory)
                self.assertEqual(initial["data"], later["data"])
                factory.assert_not_called()
                self.assertNotIn(snapshots.PREFIX + "test:lock", database)

    async def test_storage_outage_still_serves_local_snapshot(self):
        old = saved(600)
        snapshots.remember("test", old)
        with patch.object(settings, "upstash_redis_rest_url", "https://redis.test"), patch.object(settings, "upstash_redis_rest_token", "test"), patch.object(snapshots, "command", AsyncMock(side_effect=TimeoutError())):
            result = await snapshots.get_snapshot("test", AsyncMock())
        self.assertEqual(result["data"], old["data"])

    async def test_failed_storage_write_does_not_replace_good_snapshot(self):
        old = saved(600)
        snapshots.remember("test", old)
        with patch.object(snapshots, "save", AsyncMock(side_effect=TimeoutError())):
            result = await snapshots.get_snapshot("test", AsyncMock(return_value=stats()), refresh=True)
        self.assertEqual(result["data"], old["data"])
        self.assertEqual(snapshots._memory["test"]["saved_at"], old["saved_at"])

    async def test_expired_cooldown_allows_another_refresh(self):
        old = {**saved(600), "refresh_error": "Old failure", "retry_at": time.time() - 1}
        snapshots.remember("test", old)
        read = await snapshots.get_snapshot("test", AsyncMock())
        self.assertIsNone(read["cache"]["refresh_error"])
        factory = AsyncMock(return_value=stats())
        result = await snapshots.get_snapshot("test", factory, refresh=True)
        factory.assert_awaited_once()
        self.assertFalse(result["cache"]["stale"])

    async def test_cloudflare_graphql_error_is_not_partial_success(self):
        from services import cloudflare
        async with httpx.AsyncClient(transport=httpx.MockTransport(lambda req: httpx.Response(200, json={"data": {}, "errors": [{"message": "rate limited"}]}))) as client:
            with patch.object(settings, "cloudflare_api_token", "test"), patch.object(settings, "cloudflare_account_tag", "test"), patch.object(cloudflare, "http_client", client):
                with self.assertRaises(RuntimeError):
                    await cloudflare.query_cloudflare("query {}", {})

    async def test_provider_failure_cancels_sibling_queries(self):
        started, cancelled = asyncio.Event(), asyncio.Event()
        async def slow():
            started.set()
            try: await asyncio.sleep(5)
            finally: cancelled.set()
        async def fail():
            await started.wait()
            raise RuntimeError("provider failed")
        with self.assertRaises(ExceptionGroup):
            await gather_queries(slow(), fail())
        self.assertTrue(cancelled.is_set())

    async def test_posthog_failure_is_not_empty_success(self):
        from services import posthog
        async with httpx.AsyncClient(transport=httpx.MockTransport(lambda req: httpx.Response(429))) as client:
            with patch.object(settings, "posthog_api_key", "test"), patch.object(posthog, "http_client", client):
                with self.assertRaises(RuntimeError):
                    await query_posthog("1", "SELECT 1")

    async def test_routes_share_snapshot_and_never_cache_error_response(self):
        from routers import analytics
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            with patch.object(analytics, "_get_project_stats_internal", AsyncMock(return_value=stats())) as factory:
                response = await client.get("/projects/stats/api/v1/stats?slugs=dashboard&days=0")
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.headers["cache-control"], "no-store")
                timeseries = await client.get("/projects/stats/api/v1/timeseries?slugs=dashboard&days=0")
                self.assertEqual(timeseries.json()["results"][0]["data"]["timeseries"], [])
                self.assertEqual(factory.await_count, 1)
                invalid = await client.get("/projects/stats/api/v1/stats?slugs=missing")
                self.assertEqual(invalid.status_code, 404)


if __name__ == "__main__":
    unittest.main()
