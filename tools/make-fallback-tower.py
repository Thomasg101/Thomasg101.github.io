#!/usr/bin/env python3
"""Draw assets/fallback-tower.svg — the tower as a flat elevation.

Shown behind the chapters when WebGL is unavailable or three.js never arrives.
Before this existed, enableFallback() dropped the reader onto a bare background
with floating text, which reads as broken rather than as a deliberate fallback.

The dimensions below are the ones building-scene.js models, so the drawing is
the same building rather than a decorative stand-in. If the constants at the
top of that file change, re-run this.
"""

import pathlib

# Mirrors FLOORS, FH, BAY, NX from assets/js/building-scene.js.
FLOORS, FH, BAY, NX = 12, 3.4, 6, 4
WIDTH_M = BAY * NX          # 24 m across the elevation
HEIGHT_M = FLOORS * FH      # 40.8 m to the roof

VB_W, VB_H = 1200, 820
PPM = 13.5                  # pixels per metre — leaves headroom for the crane jib
GROUND_Y = VB_H - 96

BG      = '#f4f2ed'
LINE    = '#cdc8ba'
INK     = '#14171a'
MUTED   = '#63625a'
ACCENT  = '#1544c8'
CONCRETE = '#c3bdb0'
GLASS   = 'rgba(21, 68, 200, 0.14)'


def main() -> None:
    w = WIDTH_M * PPM
    h = HEIGHT_M * PPM
    x0 = (VB_W - w) / 2 - 40          # nudged left; the crane occupies the right
    y0 = GROUND_Y - h

    o = []
    a = o.append
    a(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {VB_W} {VB_H}" '
      f'role="img" aria-label="Line elevation of a twelve-storey tower, '
      f'40.8 metres to the roof, with a tower crane alongside">')
    a(f'<rect width="{VB_W}" height="{VB_H}" fill="{BG}"/>')

    # Drafting grid, quiet enough to read as paper rather than as content.
    a('<g opacity="0.5">')
    for gx in range(0, VB_W + 1, 40):
        a(f'<line x1="{gx}" y1="0" x2="{gx}" y2="{VB_H}" stroke="{LINE}" stroke-width="0.5"/>')
    for gy in range(0, VB_H + 1, 40):
        a(f'<line x1="0" y1="{gy}" x2="{VB_W}" y2="{gy}" stroke="{LINE}" stroke-width="0.5"/>')
    a('</g>')

    # City behind, so the tower has somewhere to stand.
    skyline = [(90, 120), (150, 190), (220, 96), (900, 150), (985, 210), (1060, 130)]
    a('<g opacity="0.32">')
    for sx, sh in skyline:
        a(f'<rect x="{sx}" y="{GROUND_Y - sh}" width="56" height="{sh}" '
          f'fill="none" stroke="{MUTED}" stroke-width="1"/>')
    a('</g>')

    # Ground line and hatched earth.
    a(f'<line x1="40" y1="{GROUND_Y}" x2="{VB_W - 40}" y2="{GROUND_Y}" '
      f'stroke="{INK}" stroke-width="1.5"/>')
    a('<g opacity="0.45">')
    for hx in range(48, VB_W - 40, 22):
        a(f'<line x1="{hx}" y1="{GROUND_Y}" x2="{hx - 14}" y2="{GROUND_Y + 16}" '
          f'stroke="{MUTED}" stroke-width="1"/>')
    a('</g>')

    # Tower body.
    a(f'<rect x="{x0:.1f}" y="{y0:.1f}" width="{w:.1f}" height="{h:.1f}" '
      f'fill="{GLASS}" stroke="{INK}" stroke-width="1.75"/>')

    # Floor plates.
    for i in range(1, FLOORS):
        fy = GROUND_Y - i * FH * PPM
        a(f'<line x1="{x0:.1f}" y1="{fy:.1f}" x2="{x0 + w:.1f}" y2="{fy:.1f}" '
          f'stroke="{INK}" stroke-width="0.75" opacity="0.55"/>')

    # Bay mullions, with a lighter one mid-bay.
    for b in range(1, NX):
        mx = x0 + b * BAY * PPM
        a(f'<line x1="{mx:.1f}" y1="{y0:.1f}" x2="{mx:.1f}" y2="{GROUND_Y}" '
          f'stroke="{INK}" stroke-width="0.75" opacity="0.5"/>')
    for b in range(NX):
        mx = x0 + (b + 0.5) * BAY * PPM
        a(f'<line x1="{mx:.1f}" y1="{y0:.1f}" x2="{mx:.1f}" y2="{GROUND_Y}" '
          f'stroke="{INK}" stroke-width="0.5" opacity="0.25"/>')

    # Core, dashed the way a hidden element is drawn.
    core_w = BAY * PPM * 0.9
    core_x = x0 + w / 2 - core_w / 2
    a(f'<rect x="{core_x:.1f}" y="{y0:.1f}" width="{core_w:.1f}" height="{h:.1f}" '
      f'fill="none" stroke="{ACCENT}" stroke-width="0.9" stroke-dasharray="7 5" opacity="0.6"/>')

    # Roof plant and mast.
    a(f'<rect x="{x0 + w * 0.18:.1f}" y="{y0 - 16:.1f}" width="{w * 0.3:.1f}" height="16" '
      f'fill="{CONCRETE}" stroke="{INK}" stroke-width="1"/>')
    a(f'<line x1="{x0 + w * 0.78:.1f}" y1="{y0:.1f}" x2="{x0 + w * 0.78:.1f}" y2="{y0 - 34:.1f}" '
      f'stroke="{INK}" stroke-width="1.25"/>')
    a(f'<circle cx="{x0 + w * 0.78:.1f}" cy="{y0 - 38:.1f}" r="3.5" fill="{ACCENT}"/>')

    # Tower crane: mast, jib, counter-jib, hoist line.
    cx = x0 + w + 132
    ctop = y0 - 92
    a(f'<line x1="{cx}" y1="{GROUND_Y}" x2="{cx}" y2="{ctop}" stroke="{INK}" stroke-width="2"/>')
    for ry in range(int(ctop) + 12, int(GROUND_Y), 26):
        a(f'<line x1="{cx - 7}" y1="{ry}" x2="{cx + 7}" y2="{ry - 13}" '
          f'stroke="{INK}" stroke-width="0.6" opacity="0.5"/>')
        a(f'<line x1="{cx - 7}" y1="{ry - 13}" x2="{cx + 7}" y2="{ry}" '
          f'stroke="{INK}" stroke-width="0.6" opacity="0.5"/>')
    a(f'<line x1="{cx - 7}" y1="{GROUND_Y}" x2="{cx - 7}" y2="{ctop}" stroke="{INK}" stroke-width="0.9"/>')
    a(f'<line x1="{cx + 7}" y1="{GROUND_Y}" x2="{cx + 7}" y2="{ctop}" stroke="{INK}" stroke-width="0.9"/>')

    jib_x = x0 + w * 0.34
    a(f'<line x1="{cx + 74}" y1="{ctop}" x2="{jib_x:.1f}" y2="{ctop}" stroke="{INK}" stroke-width="1.75"/>')
    a(f'<line x1="{cx}" y1="{ctop - 30}" x2="{jib_x:.1f}" y2="{ctop}" stroke="{INK}" stroke-width="0.9"/>')
    a(f'<line x1="{cx}" y1="{ctop - 30}" x2="{cx + 74}" y2="{ctop}" stroke="{INK}" stroke-width="0.9"/>')
    a(f'<line x1="{cx}" y1="{ctop}" x2="{cx}" y2="{ctop - 30}" stroke="{INK}" stroke-width="1.25"/>')
    a(f'<rect x="{cx + 46}" y="{ctop - 11}" width="30" height="11" fill="{CONCRETE}" '
      f'stroke="{INK}" stroke-width="0.9"/>')
    hook_x = jib_x + 62
    a(f'<line x1="{hook_x:.1f}" y1="{ctop}" x2="{hook_x:.1f}" y2="{ctop + h * 0.46:.1f}" '
      f'stroke="{ACCENT}" stroke-width="1"/>')
    a(f'<rect x="{hook_x - 13:.1f}" y="{ctop + h * 0.46:.1f}" width="26" height="9" '
      f'fill="{ACCENT}" opacity="0.75"/>')

    # Elevation ladder on the left, the same datums the markers call out.
    dim_x = x0 - 74
    a(f'<line x1="{dim_x}" y1="{y0:.1f}" x2="{dim_x}" y2="{GROUND_Y}" '
      f'stroke="{MUTED}" stroke-width="0.75"/>')
    for label, metres in (('+40.8', 40.8), ('+34.0', 34.0), ('+23.8', 23.8),
                          ('+10.2', 10.2), ('+0.0', 0.0)):
        ly = GROUND_Y - metres * PPM
        a(f'<line x1="{dim_x - 6}" y1="{ly:.1f}" x2="{dim_x + 6}" y2="{ly:.1f}" '
          f'stroke="{MUTED}" stroke-width="0.75"/>')
        a(f'<line x1="{dim_x + 6}" y1="{ly:.1f}" x2="{x0:.1f}" y2="{ly:.1f}" '
          f'stroke="{ACCENT}" stroke-width="0.5" stroke-dasharray="3 4" opacity="0.45"/>')
        a(f'<text x="{dim_x - 12}" y="{ly - 5:.1f}" text-anchor="end" fill="{MUTED}" '
          f'font-family="IBM Plex Mono, ui-monospace, monospace" font-size="12" '
          f'letter-spacing="1">EL {label}</text>')

    a(f'<text x="{x0:.1f}" y="{GROUND_Y + 44}" fill="{MUTED}" '
      f'font-family="IBM Plex Mono, ui-monospace, monospace" font-size="12" '
      f'letter-spacing="1.6">ELEVATION &#183; 1:200 &#183; {FLOORS} STOREYS &#183; '
      f'{HEIGHT_M:.1f} M TO ROOF</text>')
    a('</svg>')

    out = pathlib.Path(__file__).resolve().parent.parent / 'assets' / 'fallback-tower.svg'
    out.write_text('\n'.join(o) + '\n')
    print(f'wrote {out} ({out.stat().st_size} bytes)')


if __name__ == '__main__':
    main()
