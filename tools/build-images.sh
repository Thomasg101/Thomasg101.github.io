#!/bin/bash
# Generate responsive AVIF + JPEG derivatives for every image the site serves.
#
# Uses macOS `sips` only — no Homebrew, no Node. AVIF is writable by sips;
# WebP is not, which is why the modern format here is AVIF (it compresses
# better than WebP anyway and is supported by every current browser).
#
# Run from the project root:  ./tools/build-images.sh
# Safe to re-run: derivatives are overwritten, sources are never modified.

set -euo pipefail
cd "$(dirname "$0")/.."

AVIF_Q=55   # visually transparent for photography at these display sizes
JPEG_Q=72   # fallback for browsers without AVIF

# Emit one width in both formats. Never upscales past the source width.
emit() {
  local src="$1" base="$2" want="$3" native="$4"
  local w=$(( want < native ? want : native ))
  local out="${base}-${w}"
  [ -f "${out}.avif" ] && [ "${out}.avif" -nt "$src" ] && return 0
  sips --resampleWidth "$w" -s format avif -s formatOptions "$AVIF_Q" \
       "$src" --out "${out}.avif" >/dev/null 2>&1
  sips --resampleWidth "$w" -s format jpeg -s formatOptions "$JPEG_Q" \
       "$src" --out "${out}.jpg" >/dev/null 2>&1
  printf '  %-46s %6s KB avif / %6s KB jpeg\n' \
    "$(basename "${out}")" \
    "$(( $(stat -f%z "${out}.avif") / 1024 ))" \
    "$(( $(stat -f%z "${out}.jpg") / 1024 ))"
}

# Build every requested width for one source, skipping duplicates that collapse
# to the same pixel width once clamped to the native size.
derive() {
  local src="$1"; shift
  local base="${src%.*}"
  local native
  native=$(sips -g pixelWidth "$src" | awk '/pixelWidth/{print $2}')
  echo "$(basename "$src") (${native}px native)"
  # Clamping to the native width can collapse two requested widths into nearly
  # the same number (600 and 607). Anything within 15% of a width already built
  # is not worth a second pair of files.
  local seen=""
  for want in "$@"; do
    local w=$(( want < native ? want : native )) dup=0
    for prev in $seen; do
      local lo=$(( prev * 85 / 100 )) hi=$(( prev * 115 / 100 ))
      [ "$w" -ge "$lo" ] && [ "$w" -le "$hi" ] && dup=1 && break
    done
    [ "$dup" -eq 1 ] && continue
    seen="$seen $w"
    emit "$src" "$base" "$want" "$native"
  done
}

echo "== Photography =="
for f in assets/photography/*.jpg; do
  case "$f" in *-[0-9]*.jpg) continue ;; esac   # skip already-generated derivatives
  derive "$f" 600 1200
done

echo "== Profile =="
for f in assets/profile/*.jpg; do
  case "$f" in *-[0-9]*.jpg) continue ;; esac
  derive "$f" 400 800
done

echo "== Project imagery =="
for f in assets/projects/*.jpg; do
  case "$f" in *-[0-9]*.jpg) continue ;; esac
  derive "$f" 600 1200
done

echo
echo "Done. Sources untouched; derivatives sit beside them as -WIDTH.avif / -WIDTH.jpg"
