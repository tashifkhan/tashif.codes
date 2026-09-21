import re
import sys
import unittest
from datetime import date, datetime, timezone
from pathlib import Path
from unittest.mock import AsyncMock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from core.config import settings
from services import posthog_history, snapshots
from services.posthog import PH_FIELDS
from services.posthog_history import (
    BREAKDOWN_LIMIT,
    fetch_history,
    next_quarter,
    quarter_start,
    windows,
)

_START = re.compile(r"timestamp >= toDateTime\('(\d{4}-\d{2}-\d{2})")


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
            if "toStartOfDay" in hogql:
                start = _START.search(hogql).group(1)
                return [[datetime.fromisoformat(start), 1, 1]]
            return [[f"/page-{i}", 100 - i, 50 - i] for i in range(BREAKDOWN_LIMIT + 5)]

        with patch("services.posthog_history.query_posthog", AsyncMock(side_effect=fake_query)):
            timeseries, breakdowns = await fetch_history("1", 912, align=True)

        expected_windows = len(windows(912, datetime.now(timezone.utc).date(), align=True))
        self.assertEqual(len(timeseries), expected_windows)
        self.assertEqual([entry.pageviews for entry in timeseries], [1] * expected_windows)
        self.assertEqual([entry.date for entry in timeseries], sorted(entry.date for entry in timeseries))
        self.assertEqual(set(breakdowns), set(PH_FIELDS))
        self.assertEqual(len(breakdowns["path"]), BREAKDOWN_LIMIT)
        self.assertEqual(breakdowns["path"][0].key, "/page-0")
        self.assertEqual(len(calls), expected_windows * (1 + len(PH_FIELDS)))

    async def test_final_quarters_come_from_the_redis_cache(self):
        async def fake_query(project_id, hogql):
            if "toStartOfDay" in hogql:
                start = _START.search(hogql).group(1)
                return [[datetime.fromisoformat(start), 1, 1]]
            return [[f"/page-{i}", 100 - i, 50 - i] for i in range(BREAKDOWN_LIMIT + 5)]

        query = AsyncMock(side_effect=fake_query)
        with patch("services.posthog_history.query_posthog", query):
            await fetch_history("1", 912, align=True)
            first_pass = query.await_count
            await fetch_history("1", 912, align=True)
            second_pass = query.await_count - first_pass

        # Only the current, still-changing quarter is queried again.
        self.assertEqual(second_pass, 1 + len(PH_FIELDS))


if __name__ == "__main__":
    unittest.main()
