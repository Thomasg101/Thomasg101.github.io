#!/usr/bin/env python3
"""Generate the 1200x630 Open Graph cards.

Writes the site card at assets/og-image.jpg and one card per case study under
assets/og/. Every case study used to share the site card, so a LinkedIn post of
the Travers paper and one of the pavement QC page produced identical previews.

There is no image compositor on this machine (no ImageMagick, no Node), but
`sips` can rasterise PDF — so each card is emitted as a minimal hand-written
PDF using the base-14 Helvetica faces, then converted to JPEG.

Per-page titles and kickers are read out of the case studies themselves, so
retitling a page and re-running this keeps the card in step.

    python3 tools/make-og-image.py
"""
import html
import os
import pathlib
import re
import subprocess
import shutil
import tempfile


def _have(cmd):
    return shutil.which(cmd) is not None

W, H = 1200, 630

BG = (0.890, 0.898, 0.886)      # #e3e5e2 concrete
INK = (0.071, 0.082, 0.094)     # #121518 graphite
ACCENT = (0.659, 0.212, 0.122)  # #a8361f red oxide
MUTED = (0.325, 0.353, 0.361)   # #535a5c

DOT = r"\267"  # middle dot, WinAnsiEncoding

# Rough Helvetica advance widths as a fraction of point size. Good enough to
# choose a font size and wrap a headline; these cards have generous margins.
AVG_BOLD = 0.60
AVG_REG = 0.52


def rgb(c):
    return f"{c[0]:.3f} {c[1]:.3f} {c[2]:.3f}"


def pdf_text(s):
    """Escape a Python string into a WinAnsiEncoding PDF literal."""
    s = (s.replace("—", "-").replace("–", "-")
          .replace("’", "'").replace("“", '"').replace("”", '"')
          .replace("&amp;", "&"))
    # Backslashes and parens are escaped first, so the octal that follows is
    # inserted into an already-safe literal and cannot be re-escaped.
    s = s.replace("\\", r"\\").replace("(", r"\(").replace(")", r"\)")
    return s.replace("·", DOT)


def wrap(text, size, avg, max_w):
    """Greedy wrap on estimated width."""
    words, lines, cur = text.split(), [], ""
    for word in words:
        trial = f"{cur} {word}".strip()
        if len(trial) * size * avg <= max_w or not cur:
            cur = trial
        else:
            lines.append(cur)
            cur = word
    if cur:
        lines.append(cur)
    return lines


def build_content(title, kicker, tagline):
    """Draw one card bottom-up; PDF's origin is the bottom-left corner."""
    p = []
    p.append(f"{rgb(BG)} rg 0 0 {W} {H} re f")
    p.append(f"{rgb(ACCENT)} rg 0 0 {W} 10 re f")
    p.append(f"{rgb(ACCENT)} rg 80 508 14 14 re f")
    p.append(f"BT {rgb(MUTED)} rg /F2 20 Tf 108 511 Td ({pdf_text(kicker)}) Tj ET")

    # Headline: step the size down until it fits in at most three lines.
    size = 96 if len(title) < 18 else 72 if len(title) < 34 else 58
    lines = wrap(title, size, AVG_BOLD, W - 160)
    while len(lines) > 3 and size > 36:
        size -= 6
        lines = wrap(title, size, AVG_BOLD, W - 160)

    top = 430
    for i, line in enumerate(lines):
        p.append(f"BT {rgb(INK)} rg /F1 {size} Tf 80 {top - i * int(size * 1.12)} Td "
                 f"({pdf_text(line)}) Tj ET")

    rule_y = top - (len(lines) - 1) * int(size * 1.12) - 34
    p.append(f"{rgb(MUTED)} RG 1 w 80 {rule_y} m 700 {rule_y} l S")

    # Two lines of tagline. A description longer than that is cut at the last
    # whole word and marked, rather than stopping mid-clause as if truncated.
    tag_lines = wrap(tagline, 25, AVG_REG, W - 400)
    if len(tag_lines) > 2:
        tag_lines = tag_lines[:2]
        tag_lines[1] = tag_lines[1].rstrip(" ,;:").rstrip() + "..."
    for i, line in enumerate(tag_lines):
        p.append(f"BT {rgb(MUTED)} rg /F2 25 Tf 80 {rule_y - 44 - i * 34} Td "
                 f"({pdf_text(line)}) Tj ET")

    # Wide-flange section, mirroring the favicon, anchored to the right edge.
    for x, y, w, h in [(895, 100, 150, 28), (952, 128, 36, 114), (895, 242, 150, 28)]:
        p.append(f"{rgb(ACCENT)} rg {x} {y} {w} {h} re f")
    return "\n".join(p)


def build_pdf(content_str):
    content = content_str.encode("latin-1")
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        (f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {W} {H}] "
         f"/Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> "
         f"/Contents 4 0 R >>").encode("latin-1"),
        b"<< /Length " + str(len(content)).encode() + b" >>\nstream\n" + content + b"\nendstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    ]
    out = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for i, body in enumerate(objects, start=1):
        offsets.append(len(out))
        out += f"{i} 0 obj\n".encode() + body + b"\nendobj\n"
    xref_at = len(out)
    n = len(objects) + 1
    out += f"xref\n0 {n}\n".encode() + b"0000000000 65535 f \n"
    for off in offsets[1:]:
        out += f"{off:010d} 00000 n \n".encode()
    out += (f"trailer\n<< /Size {n} /Root 1 0 R >>\nstartxref\n{xref_at}\n%%EOF\n").encode()
    return bytes(out)


def render(content_str, out_path):
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as fh:
        fh.write(build_pdf(content_str))
        pdf_path = fh.name
    os.makedirs(os.path.dirname(out_path) or ".", exist_ok=True)
    if _have("sips"):
        subprocess.run(["sips", "-s", "format", "jpeg", "-s", "formatOptions", "86",
                        pdf_path, "--out", out_path], check=True, capture_output=True)
        subprocess.run(["sips", "--resampleWidth", str(W), out_path],
                       check=True, capture_output=True)
    else:
        # Same card, rasterised with poppler where sips is not available.
        stem = out_path[:-4] if out_path.endswith(".jpg") else out_path
        subprocess.run(["pdftoppm", "-jpeg", "-jpegopt", "quality=86", "-r", "72",
                        "-scale-to-x", str(W), "-scale-to-y", str(H),
                        "-singlefile", pdf_path, stem],
                       check=True, capture_output=True)
    os.unlink(pdf_path)
    return os.path.getsize(out_path)


def strip_tags(s):
    return html.unescape(re.sub(r"<[^>]+>", "", s)).strip()


def page_card(path):
    """Pull the headline, kicker, and description out of a case study."""
    s = path.read_text()
    t = re.search(r'<meta property="og:title" content="([^"]+)"', s)
    title = html.unescape(t.group(1)) if t else path.stem.replace("-", " ").title()
    k = re.search(r'<p class="(?:kicker eyebrow|eyebrow)">(.*?)</p>', s, re.S)
    kicker = strip_tags(k.group(1)) if k else "Case study"
    d = re.search(r'<meta name="description" content="([^"]+)"', s)
    tagline = html.unescape(d.group(1)) if d else ""
    return title, kicker, tagline


def main():
    root = pathlib.Path(__file__).resolve().parent.parent
    os.chdir(root)

    size = render(build_content(
        "Structure. Envelope. Code.",
        "Thomas Gao",
        "Structural analysis, building envelope and AI software for "
        "engineering teams. Civil Engineering, University of Waterloo.",
    ), "assets/og-image.jpg")
    print(f"wrote assets/og-image.jpg ({size} bytes)")

    for page in sorted(pathlib.Path("projects").glob("*.html")):
        if 'http-equiv="refresh"' in page.read_text():
            continue  # redirect stubs are noindex; they need no card
        title, kicker, tagline = page_card(page)
        out = f"assets/og/{page.stem}.jpg"
        size = render(build_content(title, kicker, tagline), out)
        print(f"wrote {out} ({size} bytes)  <- {title}")


if __name__ == "__main__":
    main()
