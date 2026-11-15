#!/usr/bin/env bash
# Serve the most recently pushed branch (default: newest claude/* branch) as a
# local website, so you can see it like the live site without merging to main.
#
#   ./tools/preview-latest-branch.sh            # newest claude/* branch, port 4173
#   ./tools/preview-latest-branch.sh any 4200   # newest branch of any name
#   ./tools/preview-latest-branch.sh claude/foo # a specific branch
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"
PATTERN="${1:-claude}"
PORT="${2:-4173}"

git fetch --all --prune --quiet

if git show-ref --verify --quiet "refs/remotes/origin/$PATTERN"; then
  BRANCH="origin/$PATTERN"
elif [ "$PATTERN" = "any" ]; then
  BRANCH=$(git for-each-ref --sort=-committerdate --count=1 --format='%(refname:short)' \
    'refs/remotes/origin/*' | grep -v '/HEAD$' | head -1)
else
  BRANCH=$(git for-each-ref --sort=-committerdate --format='%(refname:short)' \
    "refs/remotes/origin/$PATTERN/*" | head -1)
fi
[ -n "${BRANCH:-}" ] || { echo "No matching branch found" >&2; exit 1; }

DIR="${TMPDIR:-/tmp}/site-preview"
rm -rf "$DIR"
git worktree prune
git worktree add --detach --force "$DIR" "$BRANCH" >/dev/null

echo "Branch : $BRANCH"
echo "Commit : $(git log -1 --format='%h %s (%cr)' "$BRANCH")"
echo "URL    : http://127.0.0.1:$PORT/"
exec python3 tools/serve.py "$DIR" "$PORT"
