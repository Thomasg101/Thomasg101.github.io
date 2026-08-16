#!/usr/bin/env python3
"""Generate favicon.ico at the site root, matching assets/favicon.svg.

Modern browsers use the declared SVG icon, but every browser still probes
/favicon.ico unprompted, which otherwise logs a 404 on each first visit.
Same trick as the OG card: emit a minimal PDF, let sips rasterise it.

    python3 tools/make-favicon-ico.py
"""
import os
import subprocess
import tempfile

S = 64  # icon is square, drawn at 64pt then rasterised
ACCENT = (0.082, 0.267, 0.784)  # #1544c8
PAPER = (0.957, 0.949, 0.929)   # #f4f2ed


def rgb(c):
    return f"{c[0]:.3f} {c[1]:.3f} {c[2]:.3f}"


def content():
    p = [f"{rgb(ACCENT)} rg 0 0 {S} {S} re f"]
    # Rising skyline. PDF origin is bottom-left, so these are the SVG bars
    # flipped: bottoms all sit on y=10, with the rule just beneath.
    for x, h in ((12, 20), (26, 32), (40, 26)):
        p.append(f"{rgb(PAPER)} rg {x} 10 9 {h} re f")
    p.append(f"{rgb(PAPER)} rg 10 5 44 3 re f")
    return "\n".join(p)


def build_pdf():
    stream = content().encode("latin-1")
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {S} {S}] /Contents 4 0 R >>".encode("latin-1"),
        b"<< /Length " + str(len(stream)).encode() + b" >>\nstream\n" + stream + b"\nendstream",
    ]
    out = bytearray(b"%PDF-1.4\n")
    offsets = []
    for i, body in enumerate(objects, start=1):
        offsets.append(len(out))
        out += f"{i} 0 obj\n".encode() + body + b"\nendobj\n"
    xref_at = len(out)
    n = len(objects) + 1
    out += f"xref\n0 {n}\n".encode() + b"0000000000 65535 f \n"
    for off in offsets:
        out += f"{off:010d} 00000 n \n".encode()
    out += f"trailer\n<< /Size {n} /Root 1 0 R >>\nstartxref\n{xref_at}\n%%EOF\n".encode()
    return bytes(out)


def main():
    os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as fh:
        fh.write(build_pdf())
        pdf = fh.name
    png = pdf.replace(".pdf", ".png")
    try:
        subprocess.run(["sips", "-s", "format", "png", "-Z", "64", pdf, "--out", png],
                       check=True, capture_output=True)
        subprocess.run(["sips", "-s", "format", "ico", png, "--out", "favicon.ico"],
                       check=True, capture_output=True)
    finally:
        for f in (pdf, png):
            if os.path.exists(f):
                os.unlink(f)
    print(f"wrote favicon.ico ({os.path.getsize('favicon.ico')} bytes)")


if __name__ == "__main__":
    main()
