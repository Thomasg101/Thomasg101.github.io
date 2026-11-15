#!/bin/sh
# Print resume/index.html to Thomas-Gao-Resume.pdf with headless Chrome.
#
#   ./tools/build-resume.sh
#
# The resume is ordinary HTML in the site's own type and palette, so the PDF is
# reproducible and its text layer is exactly the page's reading order. Set
# CHROME to another Chromium binary if Chrome is installed elsewhere.
set -eu

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
OUT="$ROOT/Thomas-Gao-Resume.pdf"

if [ ! -x "$CHROME" ]; then
  echo "Chrome not found at: $CHROME (set CHROME=/path/to/chrome)" >&2
  exit 1
fi

"$CHROME" --headless=new --disable-gpu --no-pdf-header-footer \
  --virtual-time-budget=4000 \
  --print-to-pdf="$OUT" \
  "file://$ROOT/resume/index.html" 2>/dev/null

echo "Wrote $OUT"
