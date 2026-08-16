#!/usr/bin/env python3
"""Generate the 1200x630 Open Graph card at assets/og-image.jpg.

There is no image compositor on this machine (no ImageMagick, no Node), but
`sips` can rasterise PDF — so the card is emitted as a minimal hand-written
PDF using the base-14 Helvetica faces, then converted to JPEG.

    python3 tools/make-og-image.py
"""
import os
import subprocess
import tempfile

W, H = 1200, 630

BG = (0.957, 0.949, 0.929)      # #f4f2ed paper
INK = (0.078, 0.090, 0.102)     # #14171a
ACCENT = (0.082, 0.267, 0.784)  # #1544c8
MUTED = (0.388, 0.384, 0.353)   # #63625a

DOT = r"\267"  # middle dot, WinAnsiEncoding


def rgb(c):
    return f"{c[0]:.3f} {c[1]:.3f} {c[2]:.3f}"


def build_content():
    """Draw the card bottom-up; PDF's origin is the bottom-left corner."""
    p = []
    p.append(f"{rgb(BG)} rg 0 0 {W} {H} re f")

    # Accent rule across the foot, and a small accent square as the eyebrow mark.
    p.append(f"{rgb(ACCENT)} rg 0 0 {W} 10 re f")
    p.append(f"{rgb(ACCENT)} rg 80 508 14 14 re f")

    # Eyebrow
    p.append(f"BT {rgb(MUTED)} rg /F2 20 Tf 108 511 Td (T. GAO {DOT} CIVIL / CODE) Tj ET")

    # Name
    p.append(f"BT {rgb(INK)} rg /F1 96 Tf 80 350 Td (Thomas Gao) Tj ET")

    # Hairline under the name
    p.append(f"{rgb(MUTED)} RG 1 w 80 318 m 700 318 l S")

    # Descriptor + affiliation
    p.append(
        f"BT {rgb(INK)} rg /F2 34 Tf 80 258 Td "
        f"(Civil Engineering {DOT} Building Science {DOT} Software) Tj ET"
    )
    p.append(
        f"BT {rgb(MUTED)} rg /F2 25 Tf 80 206 Td "
        f"(BASc Civil, University of Waterloo {DOT} Waterloo, ON) Tj ET"
    )
    p.append(
        f"BT {rgb(ACCENT)} rg /F2 22 Tf 80 150 Td "
        f"(Envelope thermal modelling {DOT} Deep foundations {DOT} Pavement QC) Tj ET"
    )

    # Skyline mark, mirroring the favicon, anchored to the right edge.
    bars = [(880, 120, 44, 150), (946, 120, 44, 250), (1012, 120, 44, 196)]
    for x, y, w, h in bars:
        p.append(f"{rgb(ACCENT)} rg {x} {y} {w} {h} re f")
    p.append(f"{rgb(ACCENT)} rg 866 100 224 6 re f")

    return "\n".join(p)


def build_pdf():
    content = build_content().encode("latin-1")

    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        (
            f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {W} {H}] "
            f"/Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> "
            f"/Contents 4 0 R >>"
        ).encode("latin-1"),
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
    out += f"xref\n0 {n}\n".encode()
    out += b"0000000000 65535 f \n"
    for off in offsets[1:]:
        out += f"{off:010d} 00000 n \n".encode()
    out += (
        f"trailer\n<< /Size {n} /Root 1 0 R >>\nstartxref\n{xref_at}\n%%EOF\n"
    ).encode()
    return bytes(out)


def main():
    os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as fh:
        fh.write(build_pdf())
        pdf_path = fh.name

    os.makedirs("assets", exist_ok=True)
    subprocess.run(
        ["sips", "-s", "format", "jpeg", "-s", "formatOptions", "86",
         pdf_path, "--out", "assets/og-image.jpg"],
        check=True, capture_output=True,
    )
    subprocess.run(
        ["sips", "--resampleWidth", str(W), "assets/og-image.jpg"],
        check=True, capture_output=True,
    )
    os.unlink(pdf_path)
    size = os.path.getsize("assets/og-image.jpg")
    dims = subprocess.run(
        ["sips", "-g", "pixelWidth", "-g", "pixelHeight", "assets/og-image.jpg"],
        capture_output=True, text=True,
    ).stdout
    print(f"wrote assets/og-image.jpg ({size} bytes)")
    print(dims.strip())


if __name__ == "__main__":
    main()
