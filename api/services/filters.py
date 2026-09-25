"""
Breakdown filters, e.g. ?filter=country:🇮🇳 India&filter=os_name:linux.

Filter values are the keys the API returns, which merger.py has already
lowercased and normalized. Each one expands back to every raw provider value
that normalizes to it, so filtering on "linux" also matches "GNU/Linux".
"""

from services.merger import _LINUX_VARIANTS, _MAC_VARIANTS, _REFERRER_ALIASES
from utils import get_country_code

FIELDS = ("path", "device_type", "referrer", "os_name", "country")
MAX_FILTERS = 5

Filter = tuple[str, str]

# Cloudflare dimension values are case-sensitive and not always title case.
_CF_CASES = {"ios": "iOS", "macosx": "MacOSX", "chromeos": "ChromeOS"}


def parse_filters(raw: list[str]) -> list[Filter]:
    """Parse 'field:value' strings, one filter per field, sorted for stable cache keys."""
    filters: dict[str, str] = {}
    for item in raw:
        field, sep, value = item.partition(":")
        if not sep or field not in FIELDS or not value.strip():
            raise ValueError(f"Invalid filter {item!r}. Use field:value with field one of {', '.join(FIELDS)}.")
        filters[field] = value.strip()
    if len(filters) > MAX_FILTERS:
        raise ValueError(f"At most {MAX_FILTERS} filters are allowed.")
    return sorted(filters.items())


def cache_suffix(filters: list[Filter]) -> str:
    return "".join(f"|{field}={value}" for field, value in filters)


def raw_values(field: str, value: str) -> set[str]:
    """Lowercase provider values that merge_stats would report under this key."""
    if field == "country":
        return {get_country_code(value)}
    value = value.lower()
    if field == "os_name":
        for variants in (_MAC_VARIANTS, _LINUX_VARIANTS):
            if value in variants:
                return set(variants)
    if field == "referrer":
        return {value, f"www.{value}"} | {raw for raw, host in _REFERRER_ALIASES.items() if host == value}
    return {value}


def _quote(value: str) -> str:
    return "'" + value.replace("\\", "\\\\").replace("'", "\\'") + "'"


def posthog_where(filters: list[Filter], fields: dict[str, str]) -> str:
    """HogQL conditions to append after an existing WHERE, each prefixed with AND."""
    return "".join(
        f" AND lower(toString({fields[field]})) IN ({', '.join(map(_quote, sorted(raw_values(field, value))))})"
        for field, value in filters
    )


def cloudflare_filters(filters: list[Filter], dimensions: dict[str, str]) -> list[dict]:
    """Cloudflare GraphQL `_in` conditions, one per filter, for an AND list."""
    conditions = []
    for field, value in filters:
        values = set()
        for raw in raw_values(field, value):
            if raw == "(unknown)":
                values |= {"", "Unknown"}
                continue
            if field == "country":
                values.add(raw.upper())
            elif field == "os_name":
                values |= {raw, raw.title(), _CF_CASES.get(raw, raw)}
            else:
                values.add(raw)
        conditions.append({f"{dimensions[field]}_in": sorted(values)})
    return conditions
