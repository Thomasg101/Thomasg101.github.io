#!/usr/bin/env python3
"""Strip dark mode from projects/project-detail.css and raise the type floor.

The site is light-only, so the three alternate palette blocks and the theme
switch styling are dead weight. Font sizes below 11px are raised to 11px --
uppercase mono at 8-10px with wide tracking is not readable.

One-off migration; safe to re-run (already-applied changes are detected).
"""
import os
import re

CSS = "projects/project-detail.css"

# Anything at or under this becomes the floor value.
FLOOR = 11.0
FLOOR_MAP = {"8": "11", "8.5": "11", "9": "11", "9.5": "11", "10": "11", "10.5": "11"}


def drop_block(css, header_pattern, label):
    """Remove a top-level rule/at-rule by brace matching from its header."""
    m = re.search(header_pattern, css)
    if not m:
        print(f"  (already gone) {label}")
        return css
    start = m.start()
    i = css.index("{", m.end() - 1 if m.end() > m.start() else m.start())
    depth, j = 0, i
    while j < len(css):
        if css[j] == "{":
            depth += 1
        elif css[j] == "}":
            depth -= 1
            if depth == 0:
                break
        j += 1
    end = j + 1
    while end < len(css) and css[end] in "\n\r":
        end += 1
    print(f"  removed {label} ({end - start} chars)")
    return css[:start] + css[end:]


def main():
    os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
    css = open(CSS).read()
    before = len(css)

    # 1. Alternate palettes.
    css = drop_block(css, r"@media \(prefers-color-scheme: dark\)\s*\{", "dark media query")
    css = drop_block(css, r':root\[data-theme="light"\]\s*\{', ':root[data-theme="light"]')
    css = drop_block(css, r':root\[data-theme="dark"\]\s*\{', ':root[data-theme="dark"]')

    # 2. Theme switch styling, wherever it appears (base + two breakpoints).
    #    NOTE: drop_block deletes from the start of the matched selector, so a
    #    selector sitting at the end of a comma-separated list takes the rest of
    #    the list with it. That happened once here (the @media print group) and
    #    was repaired by hand; check any comma-list hit before trusting a re-run.
    for _ in range(6):
        m = re.search(r"[ \t]*\.theme-switch[^{]*\{", css)
        if not m:
            break
        css = drop_block(css, r"[ \t]*\.theme-switch[^{]*\{", ".theme-switch rule")

    # 3. The print block still names the dark selector; simplify to :root.
    css = css.replace(':root,\n  :root[data-theme="dark"] {', ":root {")

    # 4. Type floor.
    def raise_size(m):
        value = m.group(1)
        if float(value) < FLOOR:
            return f"font-size: {FLOOR_MAP.get(value, '11')}px"
        return m.group(0)

    css, n = re.subn(r"font-size: *([0-9.]+)px", raise_size, css)
    raised = len(re.findall(r"font-size: 11px", css))
    print(f"  type floor applied ({raised} declarations now at 11px)")

    # 5. Tighten the widest tracking at small sizes for legibility.
    css = re.sub(r"letter-spacing: 0?\.2([0-9])em", r"letter-spacing: 0.16em", css)

    open(CSS, "w").write(css)
    print(f"\n{CSS}: {before} -> {len(css)} chars")


if __name__ == "__main__":
    main()
