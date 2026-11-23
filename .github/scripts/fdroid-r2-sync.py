#!/usr/bin/env python3
"""Sync F-Droid APKs between the workspace and the tashif-codes-fdroid R2 bucket.

Usage:
  python3 .github/scripts/fdroid-r2-sync.py download
  python3 .github/scripts/fdroid-r2-sync.py upload

Never prints secret values. Requires CLOUDFLARE_API_TOKEN and
CLOUDFLARE_ACCOUNT_ID in the environment, and wrangler on PATH.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

BUCKET = os.environ.get("FDROID_R2_BUCKET", "tashif-codes-fdroid")
ACCOUNT_ID = os.environ.get("CLOUDFLARE_ACCOUNT_ID", "")
TOKEN = os.environ.get("CLOUDFLARE_API_TOKEN", "")
REPO_ROOT = Path(__file__).resolve().parents[2]
FDROID = REPO_ROOT / "public" / "fdroid"
CONTENT_TYPE = "application/vnd.android.package-archive"
CACHE_CONTROL = "public, max-age=31536000, immutable"


def die(message: str, code: int = 1) -> None:
    print(f"::error::{message}", file=sys.stderr)
    raise SystemExit(code)


def require_auth() -> None:
    missing = [
        name
        for name, value in (
            ("CLOUDFLARE_API_TOKEN", TOKEN),
            ("CLOUDFLARE_ACCOUNT_ID", ACCOUNT_ID),
        )
        if not value
    ]
    if missing:
        die("Missing required secret(s): " + ", ".join(missing))


def api_list_objects() -> list[dict]:
    objects: list[dict] = []
    cursor = None
    while True:
        qs = {"per_page": "100"}
        if cursor:
            qs["cursor"] = cursor
        url = (
            f"https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}"
            f"/r2/buckets/{urllib.parse.quote(BUCKET)}/objects?"
            + urllib.parse.urlencode(qs)
        )
        req = urllib.request.Request(
            url,
            headers={
                "Authorization": f"Bearer {TOKEN}",
                "Accept": "application/json",
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=60) as response:
                payload = json.loads(response.read().decode())
        except urllib.error.HTTPError as exc:
            body = exc.read().decode("utf-8", "replace")
            body = body.replace(TOKEN, "[redacted]") if TOKEN else body
            die(f"R2 list objects failed: HTTP {exc.code}: {body[:500]}")

        if payload.get("success") is False:
            die(f"R2 list objects unsuccessful: {payload.get('errors')}")

        result = payload.get("result")
        if isinstance(result, list):
            batch = result
            info = payload.get("result_info") or {}
        elif isinstance(result, dict):
            batch = result.get("objects") or result.get("items") or []
            info = result.get("result_info") or payload.get("result_info") or {}
        else:
            batch = []
            info = {}

        objects.extend(batch)
        cursor = None
        if isinstance(info, dict):
            cursor = info.get("cursor") or info.get("cursors", {}).get("after")
            if not info.get("is_truncated") and not info.get("continuation_token"):
                if not cursor or not batch:
                    break
        if not cursor:
            break
    return objects


def wrangler(*args: str, check: bool = True) -> subprocess.CompletedProcess[str]:
    cmd = ["wrangler", *args]
    env = os.environ.copy()
    # Token stays in the environment, not in argv.
    result = subprocess.run(cmd, text=True, capture_output=True, env=env)
    if check and result.returncode != 0:
        out = (result.stdout or "") + (result.stderr or "")
        if TOKEN:
            out = out.replace(TOKEN, "[redacted]")
        die(f"wrangler {' '.join(args)} failed (exit {result.returncode}): {out[-1500:]}")
    return result


def object_name(entry: dict) -> str:
    return str(entry.get("key") or entry.get("name") or entry.get("id") or "")


def download() -> None:
    require_auth()
    FDROID.mkdir(parents=True, exist_ok=True)
    (FDROID / "repo").mkdir(parents=True, exist_ok=True)
    entries = api_list_objects()
    apks = [object_name(item) for item in entries if object_name(item).endswith(".apk")]
    print(f"R2 objects ending in .apk: {len(apks)}")
    if not apks:
        print("No APKs in R2 yet; continuing with an empty local repo/")
        return
    for key in sorted(apks):
        if key.startswith("/") or ".." in key.split("/") or key.startswith("../"):
            print(f"skip unsafe key {key!r}")
            continue
        dest = FDROID / key
        dest.parent.mkdir(parents=True, exist_ok=True)
        print(f"GET {key} -> {dest.relative_to(REPO_ROOT)}")
        wrangler(
            "r2",
            "object",
            "get",
            f"{BUCKET}/{key}",
            "--file",
            str(dest),
            "--remote",
        )
    print("download complete")


def iter_local_uploads() -> list[tuple[str, Path]]:
    uploads: list[tuple[str, Path]] = []
    repo_dir = FDROID / "repo"
    if repo_dir.is_dir():
        for path in sorted(repo_dir.glob("*.apk")):
            if path.is_file():
                uploads.append((f"repo/{path.name}", path.resolve()))
    for path in sorted(FDROID.glob("*.apk")):
        # Follow current-version symlinks so the alias key stores real APK bytes.
        if path.is_file() or path.is_symlink():
            target = path.resolve()
            if target.is_file():
                uploads.append((path.name, target))
            else:
                print(f"skip dangling alias {path.name}")
    return uploads


def upload() -> None:
    require_auth()
    uploads = iter_local_uploads()
    print(f"Uploading {len(uploads)} APK object(s) to R2 bucket {BUCKET}")
    if not uploads:
        die("No local APKs found to upload")
    for key, path in uploads:
        size = path.stat().st_size
        print(f"PUT {key} ({size} bytes)")
        wrangler(
            "r2",
            "object",
            "put",
            f"{BUCKET}/{key}",
            "--file",
            str(path),
            "--content-type",
            CONTENT_TYPE,
            "--cache-control",
            CACHE_CONTROL,
            "--remote",
            "--force",
        )
    print("upload complete")


def main() -> None:
    if len(sys.argv) != 2 or sys.argv[1] not in {"download", "upload"}:
        die("Usage: fdroid-r2-sync.py [download|upload]")
    if sys.argv[1] == "download":
        download()
    else:
        upload()


if __name__ == "__main__":
    main()
