#!/usr/bin/env python3
"""Regenerate sitemap.xml from the pages actually on disk.

Skips anything marked noindex (the two redirect stubs). Run after adding or
removing a case study:

    python3 tools/build-sitemap.py
"""
import datetime
import glob
import os
import re

SITE = "https://thomasg101.github.io"


def main():
    os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
    today = datetime.date.today().isoformat()

    urls = [("/", "1.0")]
    for path in sorted(glob.glob("projects/*.html")):
        html = open(path).read()
        if re.search(r'name="robots"[^>]*noindex', html):
            print(f"  skipping noindex: {path}")
            continue
        urls.append(("/" + path, "0.8"))

    lines = ['<?xml version="1.0" encoding="UTF-8"?>',
             '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for loc, priority in urls:
        lines += ["  <url>",
                  f"    <loc>{SITE}{loc}</loc>",
                  f"    <lastmod>{today}</lastmod>",
                  f"    <priority>{priority}</priority>",
                  "  </url>"]
    lines.append("</urlset>")

    with open("sitemap.xml", "w") as fh:
        fh.write("\n".join(lines) + "\n")
    print(f"\nwrote sitemap.xml with {len(urls)} URLs")


if __name__ == "__main__":
    main()
