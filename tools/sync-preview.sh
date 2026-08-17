#!/bin/bash
# Mirror the site into a preview directory outside ~/Downloads.
#
# Why this exists: macOS restricts access to ~/Downloads, and the Claude Code
# preview launcher does not hold that permission — it cannot even open a script
# stored here ("Operation not permitted"). Serving from a location outside the
# protected folder sidesteps it.
#
# You do NOT need this in your own terminal, which has normal access:
#
#     python3 tools/serve.py "$PWD" 4173
#
# Usage: ./tools/sync-preview.sh [dest]
# Prints the destination so a launch config can point at it.

set -euo pipefail
cd "$(dirname "$0")/.."

DEST="${1:-/private/tmp/claude-501/-Users-thomasgao-Downloads-Civil-engineering-portfolio-site/304bf98d-8fb8-4eb2-a50b-71ab1b29cc2f/scratchpad/preview}"

mkdir -p "$DEST"
rsync -a --delete \
  --exclude '.git' \
  --exclude 'uploads' \
  --exclude '.DS_Store' \
  --exclude '.thumbnail' \
  --exclude '.claude' \
  ./ "$DEST/"

echo "$DEST"
