#!/usr/bin/env python3
"""
Extract bitmap launcher icons for listings without an icon.
Uses `aapt dump badging` (available in CI) to find the icon resource path.
"""
import io
import os
import re
import subprocess
import sys
import zipfile

from PIL import Image

METADATA_BASE = "public/fdroid/metadata"


def get_apk_badging(apk_path):
    """Find the manifest package and highest-density launcher icon."""
    try:
        out = subprocess.check_output(
            ["aapt", "dump", "badging", apk_path],
            stderr=subprocess.DEVNULL, text=True, timeout=30
        )
    except (OSError, subprocess.SubprocessError):
        return None, None

    package = re.search(r"^package: name='([^']+)'", out, re.M)
    icons = re.findall(r"^application-icon-(\d+):'([^']+)'", out, re.M)
    if icons:
        _, icon_path = max(icons, key=lambda icon: int(icon[0]))
    else:
        fallback = re.search(r"^application-icon:'([^']+)'", out, re.M)
        icon_path = fallback.group(1) if fallback else None
    return package.group(1) if package else None, icon_path


def extract_png(zf, resource_path):
    """Read a PNG from the APK zip and return as RGBA PIL Image."""
    try:
        data = zf.read(resource_path)
        img = Image.open(io.BytesIO(data))
        return img.convert("RGBA") if img.mode != "RGBA" else img
    except Exception:
        return None


def process_apk(apk_path):
    print(f"--- {os.path.basename(apk_path)}")
    pkg, icon_path = get_apk_badging(apk_path)
    if not pkg:
        print("  SKIP: aapt could not determine package")
        return False

    meta_dir = os.path.join(METADATA_BASE, pkg, "en-US")
    out_path = os.path.join(meta_dir, "icon.png")
    if os.path.isfile(out_path):
        print(f"  kept: {out_path}")
        return True

    if not icon_path or icon_path.endswith(".xml"):
        print("  SKIP: no bitmap launcher icon in APK badging")
        return False

    print(f"  icon resource: {icon_path}")

    with zipfile.ZipFile(apk_path, "r") as zf:
        img = extract_png(zf, icon_path)
        if not img:
            print(f"  SKIP: could not read {icon_path}")
            return False

        print(f"  extracted: {icon_path} ({img.size[0]}x{img.size[1]})")

        # Resize to 512x512
        final = img.resize((512, 512), Image.LANCZOS)

        # Save to metadata
        os.makedirs(meta_dir, exist_ok=True)
        final.save(out_path, "PNG")
        print(f"  saved: {out_path}")
        return True


def main():
    apk_dir = sys.argv[1] if len(sys.argv) > 1 else "fdroid-input"
    if not os.path.isdir(apk_dir):
        print(f"Not found: {apk_dir}")
        sys.exit(1)

    apks = sorted(
        os.path.join(apk_dir, f)
        for f in os.listdir(apk_dir)
        if f.endswith(".apk")
    )
    if not apks:
        print(f"No APKs in {apk_dir}")
        sys.exit(1)

    print(f"Found {len(apks)} APK(s)")
    for apk in apks:
        process_apk(apk)

    sys.exit(0)


if __name__ == "__main__":
    main()
