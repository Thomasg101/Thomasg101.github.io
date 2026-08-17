#!/usr/bin/env python3
"""One-off migration for the nine project case-study pages and two redirect stubs.

Applies, per page:
  * home/back links pointed at index.html instead of the old spaced filename
  * Google Fonts swapped for the self-hosted faces (no third-party requests)
  * the auto/light/dark switch and its script removed (site is light-only)
  * canonical, Open Graph, Twitter card, and favicon links added
  * <img> upgraded to <picture> with AVIF sources and responsive srcset

Idempotent: re-running detects work already done and skips it.
"""
import glob
import os
import re

SITE = "https://thomasg101.github.io"
SIZES = "(max-width: 900px) 92vw, 640px"
OLD_HOME = "../Thomas%20Gao%20-%20Portfolio.dc.html"

FONT_OLD = re.compile(
    r'[ \t]*<link rel="preconnect" href="https://fonts\.googleapis\.com">\n'
    r'[ \t]*<link rel="preconnect" href="https://fonts\.gstatic\.com" crossorigin>\n'
    r'[ \t]*<link href="https://fonts\.googleapis\.com/css2\?[^"]*" rel="stylesheet">\n'
)
FONT_NEW = (
    '  <link rel="preload" href="../assets/fonts/IBMPlexSans-600.woff2" as="font" type="font/woff2" crossorigin>\n'
    '  <link rel="preload" href="../assets/fonts/IBMPlexMono-400.woff2" as="font" type="font/woff2" crossorigin>\n'
    '  <link rel="stylesheet" href="../assets/css/fonts.css">\n'
)

# Two markup variants exist across the pages: with and without role="group",
# and the script tag appears with defer both before and after src.
THEME_SWITCH = re.compile(
    r'\n[ \t]*<div class="theme-switch"[^>]*>.*?</div>\n(?=[ \t]*</div>)',
    re.S,
)
THEME_SCRIPT = re.compile(
    r'[ \t]*<script\s+(?:src="\./project-detail\.js"\s+defer|defer\s+src="\./project-detail\.js")\s*></script>\n'
)

IMG_RE = re.compile(r'<img\s+([^>]*?)/?>', re.S)
ATTR_RE = re.compile(r'(\w[\w-]*)\s*=\s*"([^"]*)"')


def derivatives(name):
    """Available widths for assets/projects/<name>.jpg, smallest first."""
    found = []
    for path in glob.glob(f"assets/projects/{name}-*.avif"):
        m = re.search(rf"{re.escape(name)}-(\d+)\.avif$", path)
        if m:
            found.append(int(m.group(1)))
    return sorted(found)


def upgrade_images(html):
    def repl(match):
        raw = match.group(1)
        attrs = dict(ATTR_RE.findall(raw))
        src = attrs.get("src", "")
        m = re.match(r"\.\./assets/projects/([\w-]+)\.jpg$", src)
        if not m:
            return match.group(0)  # SVGs and anything unexpected: leave alone
        name = m.group(1)
        widths = derivatives(name)
        if not widths:
            return match.group(0)

        avif = ", ".join(f"../assets/projects/{name}-{w}.avif {w}w" for w in widths)
        jpg = ", ".join(f"../assets/projects/{name}-{w}.jpg {w}w" for w in widths)
        attrs["src"] = f"../assets/projects/{name}-{widths[-1]}.jpg"
        attrs["srcset"] = jpg
        attrs["sizes"] = SIZES
        attrs.setdefault("decoding", "async")
        if "fetchpriority" not in attrs:
            attrs.setdefault("loading", "lazy")

        order = ["src", "srcset", "sizes", "width", "height", "alt",
                 "fetchpriority", "loading", "decoding"]
        parts = [f'{k}="{attrs[k]}"' for k in order if k in attrs]
        parts += [f'{k}="{v}"' for k, v in attrs.items() if k not in order]
        return (
            "<picture>\n"
            f'        <source type="image/avif" srcset="{avif}" sizes="{SIZES}">\n'
            f'        <img {" ".join(parts)}>\n'
            "      </picture>"
        )

    return IMG_RE.sub(repl, html)


def meta_block(path, html):
    slug = os.path.basename(path)
    url = f"{SITE}/projects/{slug}"

    title = re.search(r"<title>(.*?)</title>", html, re.S).group(1).strip()
    social_title = re.sub(r"\s*&mdash;\s*Thomas Gao$|\s*—\s*Thomas Gao$", "", title)
    desc_m = re.search(r'<meta name="description" content="([^"]*)"', html)
    desc = desc_m.group(1) if desc_m else ""

    return (
        f'  <link rel="canonical" href="{url}">\n'
        f'  <link rel="icon" href="../assets/favicon.svg" type="image/svg+xml">\n'
        f'  <link rel="apple-touch-icon" href="../assets/favicon.svg">\n'
        f'  <meta property="og:type" content="article">\n'
        f'  <meta property="og:site_name" content="Thomas Gao">\n'
        f'  <meta property="og:url" content="{url}">\n'
        f'  <meta property="og:title" content="{social_title}">\n'
        f'  <meta property="og:description" content="{desc}">\n'
        f'  <meta property="og:image" content="{SITE}/assets/og-image.jpg">\n'
        f'  <meta property="og:image:width" content="1200">\n'
        f'  <meta property="og:image:height" content="630">\n'
        f'  <meta name="twitter:card" content="summary_large_image">\n'
        f'  <meta name="twitter:title" content="{social_title}">\n'
        f'  <meta name="twitter:description" content="{desc}">\n'
        f'  <meta name="twitter:image" content="{SITE}/assets/og-image.jpg">\n'
    )


def process(path):
    html = open(path).read()
    original = html
    is_stub = 'name="robots" content="noindex"' in html

    # Links back to the homepage.
    html = html.replace(f'href="{OLD_HOME}#', 'href="../#')
    html = html.replace(f'href="{OLD_HOME}"', 'href="../"')

    # Self-hosted fonts.
    html = FONT_OLD.sub(FONT_NEW, html)

    # Light-only: drop the theme switch and its controller.
    html = THEME_SWITCH.sub("\n", html)
    html = THEME_SCRIPT.sub("", html)

    # Social/canonical metadata. Stubs are noindex and already carry a
    # canonical pointing at their replacement, so they only need the favicon.
    if "og:title" not in html:
        if is_stub:
            block = ('  <link rel="icon" href="../assets/favicon.svg" type="image/svg+xml">\n')
        else:
            block = meta_block(path, html)
        html = html.replace(
            '  <link rel="stylesheet" href="./project-detail.css">',
            block + '  <link rel="stylesheet" href="./project-detail.css">',
            1,
        )

    if not is_stub:
        html = upgrade_images(html)

    if html != original:
        open(path, "w").write(html)
        return True
    return False


def main():
    os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
    changed = 0
    for path in sorted(glob.glob("projects/*.html")):
        if process(path):
            changed += 1
            print(f"  updated {path}")
    print(f"\n{changed} page(s) updated")


if __name__ == "__main__":
    main()
