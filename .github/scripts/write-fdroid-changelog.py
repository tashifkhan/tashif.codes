#!/usr/bin/env python3
"""
Write an F-Droid "What's new" entry from a GitHub release body.

F-Droid shows metadata/<package>/en-US/changelogs/<versionCode>.txt under each
version, capped at 500 characters. Release notes are longer and written in
Markdown, so this keeps the opening summary and as many bullets as fit.

    write-fdroid-changelog.py --package codes.tashif.paisa --version-code 14 \
        --body notes.md [--force]

With --apk it reads the package and version code from the APK through
`aapt dump badging`, which the publish workflow has installed.
"""
import argparse
import re
import subprocess
import sys
from pathlib import Path

METADATA = Path("public/fdroid/metadata")
LIMIT = 500

# Sections of the release body that describe the build, not the change.
STOP_HEADINGS = {"package", "install", "checksums", "verify", "downloads"}
NOISE = re.compile(r"^(production android apk built|full changelog)", re.I)


def plain(text: str) -> str:
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)  # links
    text = re.sub(r"[*_`]+", "", text)  # emphasis and code marks
    return re.sub(r"\s+", " ", text).strip()


def first_sentence(text: str) -> str:
    """The opening sentence. A short bold lead-in such as "Tab titles." says
    nothing alone, so it keeps the sentence after it too."""
    parts = re.split(r"(?<=[.!?])\s+", text)
    if len(parts) > 1 and len(parts[0].split()) <= 3:
        return f"{parts[0]} {parts[1]}"
    return parts[0]


def summarize(body: str) -> str:
    intro: list[str] = []
    bullets: list[str] = []
    for raw in body.replace("\r\n", "\n").split("\n"):
        line = raw.strip()
        if not line or line.startswith("|"):
            continue
        heading = re.match(r"^#{1,6}\s+(.*)$", line)
        if heading:
            if plain(heading.group(1)).lower() in STOP_HEADINGS:
                break
            continue
        if NOISE.match(line):
            continue
        bullet = re.match(r"^[-*]\s+(.*)$", line)
        if bullet:
            bullets.append(first_sentence(plain(bullet.group(1))))
        elif not bullets and not intro:
            intro.append(plain(line))

    head = intro[0] if intro else ""
    kept: list[str] = []

    def render(items: list[str]) -> str:
        listed = "\n".join(f"* {item}" for item in items)
        return "\n\n".join(part for part in (head, listed) if part)

    for item in bullets:
        if len(render(kept + [item])) > LIMIT:
            break
        kept.append(item)
    return render(kept)[:LIMIT].strip()


def from_apk(apk: str) -> tuple[str, str]:
    badging = subprocess.check_output(
        ["aapt", "dump", "badging", apk], stderr=subprocess.DEVNULL, text=True, timeout=60
    )
    match = re.search(r"package: name='([^']+)' versionCode='(\d+)'", badging)
    if not match:
        raise SystemExit(f"could not read package and versionCode from {apk}")
    return match.group(1), match.group(2)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--package")
    parser.add_argument("--version-code")
    parser.add_argument("--apk")
    parser.add_argument("--body", required=True)
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    package, code = args.package, args.version_code
    if args.apk:
        package, code = from_apk(args.apk)
    if not package or not code:
        parser.error("pass --apk, or both --package and --version-code")

    target = METADATA / package / "en-US" / "changelogs" / f"{code}.txt"
    if target.exists() and not args.force:
        print(f"kept {target} (already written)")
        return 0

    text = summarize(Path(args.body).read_text())
    if not text:
        print(f"no usable notes for {package} {code}; nothing written")
        return 0

    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(text + "\n")
    print(f"wrote {target} ({len(text)} chars)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
