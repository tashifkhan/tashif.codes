import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from models import StatEntry, Stats
from services.cloudflare import CF_DIMENSIONS
from services.filters import cloudflare_filters, parse_filters, posthog_where, raw_values
from services.merger import merge_stats
from services.posthog import PH_FIELDS


class FilterTests(unittest.TestCase):
    def test_parse_keeps_one_filter_per_field_in_stable_order(self):
        filters = parse_filters(["os_name:mac", "country:🇮🇳 India", "os_name:linux"])
        self.assertEqual(filters, [("country", "🇮🇳 India"), ("os_name", "linux")])

    def test_parse_rejects_unknown_fields_and_empty_values(self):
        for raw in ("browser:chrome", "country:", "country"):
            with self.assertRaises(ValueError):
                parse_filters([raw])

    def test_every_merged_key_expands_back_to_its_raw_values(self):
        stats = merge_stats(Stats(), {
            "os_name": [StatEntry(key="GNU/Linux", pageviews=1, visitors=1), StatEntry(key="Mac OS X", pageviews=1, visitors=1)],
            "referrer": [StatEntry(key="www.google.com", pageviews=1, visitors=1), StatEntry(key="com.linkedin.android", pageviews=1, visitors=1)],
            "country": [StatEntry(key="IN", pageviews=1, visitors=1)],
        })
        self.assertIn("gnu/linux", raw_values("os_name", stats.os_name[0].key))
        self.assertIn("mac os x", raw_values("os_name", stats.os_name[1].key))
        self.assertIn("www.google.com", raw_values("referrer", stats.referrer[0].key))
        self.assertIn("com.linkedin.android", raw_values("referrer", stats.referrer[1].key))
        self.assertEqual(raw_values("country", stats.country[0].key), {"in"})

    def test_posthog_values_are_quoted(self):
        where = posthog_where([("path", "/it's")], PH_FIELDS)
        self.assertEqual(where, " AND lower(toString(properties.$pathname)) IN ('/it\\'s')")

    def test_cloudflare_matches_provider_casing(self):
        [country, os] = cloudflare_filters([("country", "🇮🇳 India"), ("os_name", "mac")], CF_DIMENSIONS)
        self.assertEqual(country, {"countryName_in": ["IN"]})
        self.assertIn("MacOSX", os["userAgentOS_in"])


if __name__ == "__main__":
    unittest.main()
