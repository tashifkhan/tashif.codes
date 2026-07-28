#!/usr/bin/env python3
"""
Extract launcher icons from APKs and save as 512x512 PNGs.
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


def get_icon_path(apk_path):
    """Use aapt to get the launcher icon resource path."""
    try:
        out = subprocess.check_output(
            ["aapt", "dump", "badging", apk_path],
            stderr=subprocess.DEVNULL, text=True, timeout=30
        )
        # application-icon-640:'res/mipmap-xxxhdpi-v11/ic_launcher.png'
        best = None
        best_size = 0
        for line in out.splitlines():
            m = re.match(r"application-icon-(\d+):'([^']+)'", line)
            if m:
                size = int(m.group(1))
                if size > best_size:
                    best_size = size
                    best = m.group(2)
            elif not best:
                m = re.match(r"application-icon:'([^']+)'", line)
                if m:
                    best = m.group(1)
        return best
    except Exception:
        return None


def extract_png(zf, resource_path):
    """Read a PNG from the APK zip and return as RGBA PIL Image."""
    try:
        data = zf.read(resource_path)
        img = Image.open(io.BytesIO(data))
        return img.convert("RGBA") if img.mode != "RGBA" else img
    except Exception:
        return None


def process_apk(apk_path):
    pkg = os.path.basename(apk_path).rsplit("_", 1)[0]
    print(f"--- {pkg}")

    if not os.path.exists(apk_path):
        print(f"  SKIP: not found")
        return False

    icon_path = get_icon_path(apk_path)
    if not icon_path:
        print("  SKIP: aapt could not determine icon")
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
        meta_dir = os.path.join(METADATA_BASE, pkg, "en-US")
        os.makedirs(meta_dir, exist_ok=True)
        out_path = os.path.join(meta_dir, "icon.png")
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
