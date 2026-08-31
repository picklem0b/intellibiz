#!/bin/bash
#
# IntelliBiz Monorepo Publish Script
#
# Publishes all packages to npm in dependency order.
# workspace:* references are automatically resolved to real versions by pnpm.
#
# Usage:
#   ./scripts/publish.sh          # publish all packages
#   ./scripts/publish.sh --dry    # dry run (no actual publish)
#   ./scripts/publish.sh --canary # publish with canary tag
#
set -euo pipefail

DRY_RUN=""
TAG="latest"
VERSION_SUFFIX=""

# Parse arguments
for arg in "$@"; do
  case $arg in
    --dry|--dry-run)
      DRY_RUN="--dry-run"
      ;;
    --canary)
      TAG="canary"
      VERSION_SUFFIX="-canary.$(date +%Y%m%d%H%M%S)"
      ;;
  esac
done

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                IntelliBiz Monorepo Publish                   ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "Tag:    $TAG"
echo "Dry:    ${DRY_RUN:-false}"
echo ""

# ─── Build ────────────────────────────────────────────────────────────────────

echo "📦 Building all packages..."
pnpm run build 2>&1 | tail -5
echo ""

# ─── Publish in dependency order ──────────────────────────────────────────────
# workspace:* is automatically replaced with the actual version by pnpm

PACKAGES=(
  # Layer 1: No internal dependencies
  "packages/core"
  "packages/create-intellibiz"

  # Layer 2: Depends only on core
  "packages/finance"
  "packages/db"
  "packages/identity"

  # Layer 3: Depends on core + layer 2
  "packages/commerce"
  "packages/http"
  "packages/testing"
  "packages/cli"

  # Layer 4: Aggregator (depends on everything)
  "packages/intellibiz"

  # Layer 5: Plugins
  "plugins/stripe"
)

echo "📤 Publishing packages..."
echo ""

FAILED=0
for pkg in "${PACKAGES[@]}"; do
  if [ ! -f "$pkg/package.json" ]; then
    echo "  ⏭  $pkg — skipping (not found)"
    continue
  fi

  NAME=$(node -p "require('./$pkg/package.json').name")
  VERSION=$(node -p "require('./$pkg/package.json').version")

  echo -n "  📄 $NAME@$VERSION... "

  if cd "$pkg" && pnpm publish --no-git-checks --tag "$TAG" $DRY_RUN 2>&1 | tail -1; then
    echo "✅"
  else
    echo "❌"
    FAILED=$((FAILED + 1))
  fi
  cd - > /dev/null
done

echo ""

if [ $FAILED -gt 0 ]; then
  echo "❌ $FAILED package(s) failed to publish"
  exit 1
else
  echo "✅ All packages published successfully!"
  echo ""
  echo "Next steps:"
  echo "  1. Verify: npm info intellibiz"
  echo "  2. Test:   npx create-intellibiz test-app"
fi
