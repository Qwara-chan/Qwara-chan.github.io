#!/usr/bin/env python3
"""
Regenerate the self-hosted display-font subsets in public/fonts/.

The site self-hosts:
  - ArchivoBlack_Latin.woff2        (Latin display body)
  - NotoSansSC_Heavy_Latin.woff2    (思源黑体 Heavy, Latin range)
  - NotoSansSC_Heavy_CJK.woff2      (思源黑体 Heavy, CJK subset → repo-used glyphs)

Run after adding new CJK content (blog posts, UI copy, components) so the Heavy
CJK subset covers the new characters. Missing glyphs otherwise fall back to
HarmonyOS Sans SC / system fonts.

Requires: python3 + fonttools + brotli (venv):
    python3 -m venv .venv && .venv/bin/pip install fonttools brotli

Source fonts (download once):
    curl -L -o /tmp/ArchivoBlack.ttf \
      https://github.com/google/fonts/raw/main/ofl/archivoblack/ArchivoBlack-Regular.ttf
    curl -L -o /tmp/NotoSansCJKsc-Black.otf \
      https://cdn.jsdelivr.net/gh/googlefonts/noto-cjk@main/Sans/OTF/SimplifiedChinese/NotoSansCJKsc-Black.otf

Usage:
    .venv/bin/python scripts/subset-fonts.py \
      --archivo /tmp/ArchivoBlack.ttf --noto /tmp/NotoSansCJKsc-Black.otf
"""
import argparse
import glob
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "public", "fonts")

LATIN_RANGE = (
    "U+0020-007E,U+00A0-00FF,U+2000-206F,U+2070-209F,U+20A0-20CF,"
    "U+2100-214F,U+2190-21FF,U+2200-22FF,U+2500-257F,U+25A0-25FF,"
    "U+2600-26FF,U+3000-303F,U+FF00-FFEF"
)
SUBSET_OPTS = [
    "--flavor=woff2",
    "--layout-features=kern,liga,ccmp,locl,mark,mkmk",
    "--no-hinting",
    "--name-IDs=*",
]
# 常用中文标点，防止标题里的标点缺字
CJK_EXTRA = "，。、；：？！“”‘’（）【】《》〈〉—…·℃—×÷／＃＆＊＋－＝＠［］｛｝｜＼＾　·"


def collect_cjk(verbose=False):
    """Collect every CJK character currently referenced by the repo."""
    seen = set()
    exts = ("astro", "ts", "tsx", "mjs", "md", "mdx", "css", "html", "json", "svg")
    for ext in exts:
        for p in glob.glob(os.path.join(ROOT, "src", "**", f"*.{ext}"), recursive=True):
            if "_github.json" in p or "fonts" in p:
                continue
            try:
                text = open(p, encoding="utf-8").read()
            except OSError:
                continue
            seen |= set(re.findall(r"[一-鿿]", text))
    for p in glob.glob(os.path.join(ROOT, "public", "**", "*.html"), recursive=True):
        try:
            seen |= set(re.findall(r"[一-鿿]", open(p, encoding="utf-8").read()))
        except OSError:
            pass
    for doc in ("CLAUDE.md", "README.md"):
        try:
            seen |= set(re.findall(r"[一-鿿]", open(os.path.join(ROOT, doc), encoding="utf-8").read()))
        except OSError:
            pass
    if verbose:
        print(f"collected {len(seen)} unique CJK chars")
    return "".join(dict.fromkeys("".join(sorted(seen)) + CJK_EXTRA))


def run(cmd):
    print("+", " ".join(cmd))
    subprocess.run(cmd, check=True)


def main():
    ap = argparse.ArgumentParser(description="Regenerate display-font woff2 subsets")
    ap.add_argument("--archivo", required=True, help="path to ArchivoBlack-Regular.ttf")
    ap.add_argument("--noto", required=True, help="path to NotoSansCJKsc-Black.otf")
    args = ap.parse_args()

    os.makedirs(OUT, exist_ok=True)
    cjk = collect_cjk(verbose=True)

    run(["pyftsubset", args.archivo, f"--unicodes={LATIN_RANGE}",
         f"--output-file={os.path.join(OUT, 'ArchivoBlack_Latin.woff2')}", *SUBSET_OPTS])
    run(["pyftsubset", args.noto, f"--unicodes={LATIN_RANGE}",
         f"--output-file={os.path.join(OUT, 'NotoSansSC_Heavy_Latin.woff2')}", *SUBSET_OPTS])

    cjk_file = os.path.join(ROOT, ".astro", "cjk_used.txt")
    os.makedirs(os.path.dirname(cjk_file), exist_ok=True)
    with open(cjk_file, "w", encoding="utf-8") as f:
        f.write(cjk)
    run(["pyftsubset", args.noto, f"--text-file={cjk_file}",
         f"--output-file={os.path.join(OUT, 'NotoSansSC_Heavy_CJK.woff2')}", *SUBSET_OPTS])

    print("done — subsets written to", OUT)


if __name__ == "__main__":
    sys.exit(main())
