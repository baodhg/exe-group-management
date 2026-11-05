"""Render every fig*.svg in a folder to a PNG at exactly 3x with Playwright (headless Chromium).

Usage: python render_png.py <folder>
Each SVG is opened in a fresh browser page whose viewport is the SVG's own size, with device scale factor 3,
so PNG = 3 x SVG size. A fresh browser has no saved zoom levels and is independent of any running browser.
Needs the Python package "playwright" and its Chromium (python -m playwright install chromium).
"""
import glob
import os
import pathlib
import re
import sys

from PIL import Image
from playwright.sync_api import sync_playwright

SCALE = 3


def svg_size(path):
    with open(path, encoding="utf-8") as f:
        head = f.read(400)
    w, h = re.search(r'width="([\d.]+)" height="([\d.]+)"', head).groups()
    return round(float(w)), round(float(h))


def main(folder):
    folder = os.path.abspath(folder)
    ok = True
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for svg in sorted(glob.glob(os.path.join(folder, "fig*.svg"))):
            w, h = svg_size(svg)
            png = svg[:-4] + ".png"
            page = browser.new_page(viewport={"width": w, "height": h}, device_scale_factor=SCALE)
            page.goto(pathlib.Path(svg).as_uri())
            page.screenshot(path=png, clip={"x": 0, "y": 0, "width": w, "height": h})
            page.close()
            size = Image.open(png).size
            good = size == (w * SCALE, h * SCALE)
            ok &= good
            print(f"{os.path.basename(png):38s} {size[0]}x{size[1]}  {'ok' if good else 'SIZE MISMATCH'}")
        browser.close()
    if not ok:
        sys.exit("some PNGs do not have the expected size")


if __name__ == "__main__":
    main(sys.argv[1])
