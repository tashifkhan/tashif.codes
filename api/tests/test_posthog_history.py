import re
import sys
import unittest
from datetime import date, datetime, timezone
from pathlib import Path
from unittest.mock import AsyncMock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from core.config import settings
from services import posthog_history, snapshots
from services.posthog import PH_FIELDS, query_window
from services.posthog_history import (
    BREAKDOWN_LIMIT,
    fetch_history,
    next_quarter,
    quarter_start,
    windows,
)

_START = re.compile(r"timestamp >= toDateTime\('(\d{4}-\d{2}-\d{2})")


def fake_window(hogql):
    """Rows shaped like query_window's: one day, then a long path breakdown."""
    start = _START.search(hogql).group(1)
    rows = [["day", f"{start}T00:00:00+0530", 1, 1]]
    rows += [["path", f"/page-{i}", 100 - i, 50 - i] for i in range(BREAKDOWN_LIMIT + 5)]
    return rows


class QuarterTests(unittest.TestCase):
    def test_quarter_start_snaps_to_calendar_quarter(self):
        self.assertEqual(quarter_start(date(2026, 9, 21)), date(2026, 7, 1))
        self.assertEqual(quarter_start(date(2026, 1, 1)), date(2026, 1, 1))
        self.assertEqual(quarter_start(date(2026, 12, 31)), date(2026, 10, 1))

    def test_next_quarter_rolls_into_next_year(self):
        self.assertEqual(next_quarter(date(2026, 10, 1)), date(2027, 1, 1))
        self.assertEqual(next_quarter(date(2026, 7, 1)), date(2026, 10, 1))

    def test_windows_split_at_quarter_boundaries(self):
        self.assertEqual(
            windows(46, date(2026, 2, 15)),
            [
                (date(2025, 12, 31), date(2026, 1, 1)),
                (date(2026, 1, 1), date(2026, 2, 16)),
            ],
        )

    def test_aligned_windows_start_at_a_quarter_boundary(self):
        result = windows(100, date(2026, 2, 15), align=True)
        self.assertEqual(result[0][0], date(2025, 10, 1))
        self.assertEqual(result[-1][1], date(2026, 2, 16))


class HistoryFetchTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        snapshots._memory.clear()
        posthog_history._memory.clear()
        self.config = patch.object(settings, "upstash_redis_rest_url", "")
        self.config.start()
        self.addCleanup(self.config.stop)

    async def test_one_day_per_window_and_breakdowns_capped(self):
        calls = []

        async def fake_query(project_id, hogql):
            calls.append(hogql)
            return fake_window(hogql)

        with patch("services.posthog.query_posthog", AsyncMock(side_effect=fake_query)):
            timeseries, breakdowns = await fetch_history("1", 912, align=True)

        expected_windows = len(windows(912, datetime.now(timezone.utc).date(), align=True))
        self.assertEqual(len(timeseries), expected_windows)
        self.assertEqual([entry.pageviews for entry in timeseries], [1] * expected_windows)
        self.assertEqual([entry.date for entry in timeseries], sorted(entry.date for entry in timeseries))
        self.assertEqual(set(breakdowns), set(PH_FIELDS))
        self.assertEqual(len(breakdowns["path"]), BREAKDOWN_LIMIT)
        self.assertEqual(breakdowns["path"][0].key, "/page-0")
        self.assertEqual(len(calls), expected_windows)

    async def test_final_quarters_come_from_the_redis_cache(self):
        query = AsyncMock(side_effect=lambda project_id, hogql: fake_window(hogql))
        with patch("services.posthog.query_posthog", query):
            await fetch_history("1", 912, align=True)
            first_pass = query.await_count
            await fetch_history("1", 912, align=True)
            second_pass = query.await_count - first_pass

        # Only the current, still-changing quarter is queried again.
        self.assertEqual(second_pass, 1)

    async def test_filters_skip_quarters_that_had_no_events(self):
        today = datetime.now(timezone.utc).date()
        busy = windows(912, today, align=True)[-3][0].isoformat()

        def sparse_window(hogql):
            if _START.search(hogql).group(1) >= busy:
                return fake_window(hogql)
            return []

        query = AsyncMock(side_effect=lambda project_id, hogql: sparse_window(hogql))
        with patch("services.posthog.query_posthog", query):
            await fetch_history("1", 912, align=True)
            before = query.await_count
            await fetch_history("1", 912, align=True, where=" AND x = 1")
            filtered = query.await_count - before

        # The empty quarters are known from the unfiltered cache.
        self.assertEqual(filtered, 3)


class QueryWindowTests(unittest.IsolatedAsyncioTestCase):
    async def test_one_query_splits_rows_by_field(self):
        rows = [
            ["path", "/", 5, 2],
            ["day", "2026-09-02T00:00:00+0530", 3, 1],
            ["day", "2026-09-01T00:00:00+0530", 2, 1],
            ["country", "IN", 5, 2],
        ]
        query = AsyncMock(return_value=rows)
        with patch("services.posthog.query_posthog", query):
            window = await query_window("1", "timestamp >= now()", limit=100)

        query.assert_awaited_once()
        hogql = query.await_args.args[1]
        # Without an outer LIMIT, HogQL returns only the first 100 rows.
        self.assertIn("LIMIT 100 BY field", hogql)
        self.assertIn("LIMIT 600", hogql)
        self.assertEqual([row["date"][:10] for row in window["timeseries"]], ["2026-09-01", "2026-09-02"])
        self.assertEqual(window["breakdowns"]["path"], [{"key": "/", "pageviews": 5, "visitors": 2}])
        self.assertEqual(window["breakdowns"]["country"][0]["key"], "IN")
        self.assertEqual(window["breakdowns"]["referrer"], [])


if __name__ == "__main__":
    unittest.main()
