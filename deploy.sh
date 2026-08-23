#!/bin/bash
#
# One deploy = one version bump.
#
# Bumps the build number shown in the menu, commits everything, pushes (which
# runs the EC2 workflow when server/** changed), then ships the frontend to
# Vercel.
#
# Usage:
#   ./deploy.sh                          # commit message defaults to the version
#   ./deploy.sh "feat: season tabs"      # your own commit message
#   ./deploy.sh "fix: api" --no-vercel   # backend only, skip the Vercel step
#
set -euo pipefail

cd "$(dirname "$0")"

BRANCH="main"
SKIP_VERCEL=false
MESSAGE=""

for arg in "$@"; do
  case "$arg" in
    --no-vercel) SKIP_VERCEL=true ;;
    *) MESSAGE="$arg" ;;
  esac
done

echo "🚀 NKMovieHUB deploy"
echo "======================================"

# Deploys come off main; anything else is almost certainly a mistake
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" != "$BRANCH" ]; then
  echo "❌ You are on '$CURRENT_BRANCH', not '$BRANCH'. Switch branches first."
  exit 1
fi

# Refuse to build on top of work that is not ours yet
echo "🔍 Fetching origin..."
git fetch origin "$BRANCH" --quiet
BEHIND=$(git rev-list --count "HEAD..origin/$BRANCH")
if [ "$BEHIND" -gt 0 ]; then
  echo "❌ Your branch is $BEHIND commit(s) behind origin/$BRANCH."
  echo "   Run 'git pull' first, then deploy again."
  exit 1
fi

OLD_VERSION=$(node client/scripts/bump-version.js --print)

echo ""
echo "🔢 Bumping the version..."
node client/scripts/bump-version.js
NEW_VERSION=$(node client/scripts/bump-version.js --print)

if [ -z "$MESSAGE" ]; then
  MESSAGE="chore: release v$NEW_VERSION"
fi

echo ""
echo "📝 Committing as: $MESSAGE"
git add -A

if git diff --cached --quiet; then
  echo "❌ Nothing to commit - not even the version changed. Aborting."
  exit 1
fi

git commit -m "$MESSAGE"

echo ""
echo "⬆️  Pushing to origin/$BRANCH..."
git push origin "$BRANCH"

if [ "$SKIP_VERCEL" = true ]; then
  echo ""
  echo "⏭️  Skipping the Vercel step (--no-vercel)."
else
  if ! command -v vercel > /dev/null; then
    echo ""
    echo "⚠️  The vercel CLI is not installed, so the frontend was NOT deployed."
    echo "   Install it with 'npm i -g vercel', or run this with --no-vercel."
    exit 1
  fi

  echo ""
  echo "🌐 Deploying the frontend to Vercel..."
  # .vercel and vercel.json live in client/, so the CLI runs from there
  (cd client && vercel --prod)
fi

echo ""
echo "======================================"
echo "✅ Deployed v$OLD_VERSION -> v$NEW_VERSION"
echo "   The menu now shows v$NEW_VERSION"
