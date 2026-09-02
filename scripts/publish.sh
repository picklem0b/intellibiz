#!/bin/bash
#
# IntelliBiz Monorepo Publish Script
#
# Publishes all packages to npm in dependency order.
# workspace:* references are automatically resolved to real versions by pnpm.
#
# Usage:
#   ./scripts/publish.sh              # publish all packages
#   ./scripts/publish.sh --dry        # dry run (no actual publish)
#   ./scripts/publish.sh --canary     # publish with canary tag
#   ./scripts/publish.sh --bump patch # bump all versions, then publish
#   ./scripts/publish.sh --only core  # publish only one package (plus its dependents)
#   ./scripts/publish.sh --check      # verify workspace:* resolution without publishing
#
set -euo pipefail

# ─── Resolve script root (absolute path) ────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$SCRIPT_DIR"

# ─── Package registry (dependency order) ─────────────────────────────────────
# Layer 0: Benchmarking (no framework deps)
# Layer 1: No internal dependencies
# Layer 2: Depends only on core
# Layer 3: Depends on core + layer 2
# Layer 4: Aggregator (depends on everything)

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

DRY_RUN=""
TAG="latest"
VERSION_SUFFIX=""
BUMP=""
ONLY=""
CHECK_ONLY=false

# ─── Parse arguments ─────────────────────────────────────────────────────────

while [[ $# -gt 0 ]]; do
  case $1 in
    --dry|--dry-run)
      DRY_RUN="--dry-run"
      shift
      ;;
    --canary)
      TAG="canary"
      VERSION_SUFFIX="-canary.$(date +%Y%m%d%H%M%S)"
      shift
      ;;
    --bump)
      BUMP="$2"
      shift 2
      ;;
    --only)
      ONLY="$2"
      shift 2
      ;;
    --check)
      CHECK_ONLY=true
      shift
      ;;
    patch|minor|major)
      BUMP="$1"
      shift
      ;;
    *)
      echo "Unknown argument: $1"
      exit 1
      ;;
  esac
done

# ─── Header ──────────────────────────────────────────────────────────────────

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║              IntelliBiz Monorepo Publish                     ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "Tag:    $TAG"
echo "Dry:    ${DRY_RUN:-false}"
echo "Bump:   ${BUMP:-none}"
echo "Only:   ${ONLY:-all}"
echo "Check:  $CHECK_ONLY"
echo ""

# ─── Helper functions ────────────────────────────────────────────────────────

get_package_name() {
  node -p "require('$SCRIPT_DIR/$1/package.json').name" 2>/dev/null || echo "unknown"
}

get_package_version() {
  node -p "require('$SCRIPT_DIR/$1/package.json').version" 2>/dev/null || echo "0.0.0"
}

# Resolve workspace:* → actual versions and return the resolved dependency map
check_workspace_resolution() {
  local pkg_dir="$SCRIPT_DIR/$1"
  local resolved
  resolved=$(node -e "
    const fs = require('fs');
    const path = require('path');
    const pkg = JSON.parse(fs.readFileSync(path.join('$pkg_dir', 'package.json'), 'utf8'));
    const deps = pkg.dependencies || {};
    const ws = Object.entries(deps).filter(([, v]) => v.startsWith('workspace:'));
    if (ws.length === 0) {
      console.log(JSON.stringify({ has_workspace: false }));
    } else {
      // Read each dependency's version from its package.json
      const resolved = {};
      for (const [name, protocol] of ws) {
        // Find the workspace package
        const parts = name.replace('@', '').split('/');
        const pkgName = parts.length > 1 ? parts.slice(1).join('-') : parts[0];
        const candidates = [
          path.join(process.cwd(), 'packages', pkgName),
          path.join(process.cwd(), 'plugins', pkgName),
        ];
        for (const dir of candidates) {
          const p = path.join(dir, 'package.json');
          if (fs.existsSync(p)) {
            const v = JSON.parse(fs.readFileSync(p, 'utf8')).version;
            resolved[name] = v;
            break;
          }
        }
      }
      console.log(JSON.stringify({ has_workspace: true, resolved }));
    }
  " 2>/dev/null)
  echo "$resolved"
}

# ─── Step 1: Filter packages if --only is set ────────────────────────────────

if [[ -n "$ONLY" ]]; then
  FILTERED=()
  FOUND=false
  for pkg in "${PACKAGES[@]}"; do
    NAME=$(get_package_name "$pkg")
    if [[ "$NAME" == *"$ONLY"* || "$pkg" == *"$ONLY"* ]]; then
      FOUND=true
    fi
    if [[ "$FOUND" == true && -f "$SCRIPT_DIR/$pkg/package.json" ]]; then
      FILTERED+=("$pkg")
    fi
  done
  if [[ ${#FILTERED[@]} -eq 0 ]]; then
    echo "❌ No packages matched '$ONLY'"
    exit 1
  fi
  PACKAGES=("${FILTERED[@]}")
  echo "📦 Filtered to ${#PACKAGES[@]} package(s):"
  for pkg in "${PACKAGES[@]}"; do
    echo "    - $(get_package_name "$pkg")@$(get_package_version "$pkg")"
  done
  echo ""
fi

# ─── Step 2: Check workspace:* resolution ────────────────────────────────────

echo "🔍 Checking workspace:* resolution..."
echo ""

RESOLVE_ERRORS=0
for pkg in "${PACKAGES[@]}"; do
  if [[ ! -f "$SCRIPT_DIR/$pkg/package.json" ]]; then
    continue
  fi

  NAME=$(get_package_name "$pkg")
  RESOLUTION=$(check_workspace_resolution "$pkg")
  HAS_WS=$(echo "$RESOLUTION" | node -p "JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).has_workspace" 2>/dev/null || echo "false")

  if [[ "$HAS_WS" == "true" ]]; then
    RESOLVED_DEPS=$(echo "$RESOLUTION" | node -p "
      const d = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).resolved;
      Object.entries(d).map(([k,v]) => k + ' → ' + v).join(', ')
    " 2>/dev/null || echo "unknown")
    echo "  ✅ $NAME — workspace:* resolves to: $RESOLVED_DEPS"
  else
    echo "  ⚪ $NAME — no workspace:* deps"
  fi
done

echo ""

if [[ "$CHECK_ONLY" == true ]]; then
  echo "✅ Workspace resolution check complete."
  exit 0
fi

# ─── Step 3: Bump versions ──────────────────────────────────────────────────

if [[ -n "$BUMP" ]]; then
  echo "📈 Bumping all versions ($BUMP)..."
  for pkg in "${PACKAGES[@]}"; do
    if [[ ! -f "$SCRIPT_DIR/$pkg/package.json" ]]; then
      continue
    fi
    NAME=$(get_package_name "$pkg")
    OLD_VER=$(get_package_version "$pkg")
    (cd "$SCRIPT_DIR/$pkg" && pnpm version "$BUMP" --no-git-tag-version 2>/dev/null) || true
    NEW_VER=$(get_package_version "$pkg")
    echo "  $NAME: $OLD_VER → $NEW_VER"
  done
  echo ""
fi

# ─── Step 4: Build ──────────────────────────────────────────────────────────

echo "📦 Building all packages..."
echo ""

BUILD_FAILURES=0
for pkg in "${PACKAGES[@]}"; do
  if [[ ! -f "$SCRIPT_DIR/$pkg/package.json" ]]; then
    echo "  ⏭  $pkg — skipping (not found)"
    continue
  fi

  NAME=$(get_package_name "$pkg")
  VERSION=$(get_package_version "$pkg")

  if grep -q '"build"' "$SCRIPT_DIR/$pkg/package.json" 2>/dev/null; then
    echo -n "  🔨 $NAME@$VERSION... "
    if (cd "$SCRIPT_DIR/$pkg" && pnpm run build 2>&1 | tail -1); then
      echo "✅"
    else
      echo "❌"
      BUILD_FAILURES=$((BUILD_FAILURES + 1))
    fi
  else
    echo "  ⏭  $NAME@$VERSION — no build script"
  fi
done

echo ""

if [[ $BUILD_FAILURES -gt 0 ]]; then
  echo "❌ $BUILD_FAILURES package(s) failed to build. Aborting publish."
  exit 1
fi

# ─── Step 5: Verify npm auth ──────────────────────────────────────────────

echo "🔐 Verifying npm authentication..."

NPM_USER=$(npm whoami 2>/dev/null || echo "")
if [[ -z "$NPM_USER" ]]; then
echo ""
echo "  ❌ npm auth failed. Your npm token is invalid or expired."
echo ""
echo "  Fix:"
echo "    1. npm login"
echo "    2. Or set a new token in ~/.npmrc:"
echo "       //registry.npmjs.org/:_authToken=YOUR_TOKEN"
echo ""
echo "  To generate a token:"
echo "    https://www.npmjs.com/settings/tokens"
echo ""
exit 1
fi
echo "  ✅ Authenticated as: $NPM_USER"
echo ""

# Check @intellibiz org membership (scoped packages need this)
HAS_SCOPED=false
for pkg in "${PACKAGES[@]}"; do
  NAME=$(get_package_name "$pkg")
  if [[ "$NAME" == @* ]]; then
    HAS_SCOPED=true
    break
  fi
done

if [[ "$HAS_SCOPED" == true ]]; then
  SCOPE=$(echo "$NAME" | cut -d'/' -f1 | sed 's/^@//')
  ORG_MEMBER=$(npm org ls "$SCOPE" 2>/dev/null | grep -c "$NPM_USER" || echo "0")
  if [[ "$ORG_MEMBER" -eq 0 ]]; then
echo "  ⚠️  You are not a member of the @$SCOPE org."
echo "     Scoped packages will fail with 404."
echo "     Fix: npm org add $SCOPE $NPM_USER"
echo ""
    if [[ -z "$DRY_RUN" ]]; then
      echo "  ❌ Aborting. Fix org membership first."
      exit 1
    fi
  else
echo "  ✅ Member of @$SCOPE org"
echo ""
  fi
fi

# ─── Step 6: Publish ────────────────────────────────────────────────────────

echo "📤 Publishing packages..."
echo ""

FAILED=0
PUBLISHED=0

for pkg in "${PACKAGES[@]}"; do
  if [[ ! -f "$SCRIPT_DIR/$pkg/package.json" ]]; then
    echo "  ⏭  $pkg — skipping (not found)"
    continue
  fi

  NAME=$(get_package_name "$pkg")
  VERSION=$(get_package_version "$pkg")

  # Check if this version is already published (skip during dry run)
  if [[ -z "$DRY_RUN" ]]; then
    EXISTING=$(npm view "$NAME@$VERSION" version 2>/dev/null || echo "")
    if [[ -n "$EXISTING" ]]; then
      echo "  ⏭  $NAME@$VERSION — already published, skipping"
      continue
    fi
  fi

  echo -n "  📄 $NAME@$VERSION... "

  if (cd "$SCRIPT_DIR/$pkg" && pnpm publish --tag "$TAG" --access public $DRY_RUN 2>&1 | tail -1); then
    echo "✅"
    PUBLISHED=$((PUBLISHED + 1))
  else
    echo "❌"
    FAILED=$((FAILED + 1))
  fi
done

# ─── Summary ─────────────────────────────────────────────────────────────────

echo ""
echo "═══════════════════════════════════════════════════════════════"

if [[ $FAILED -gt 0 ]]; then
  echo "❌ $FAILED package(s) failed to publish"
  exit 1
else
  echo "✅ $PUBLISHED package(s) published successfully"
  echo ""
  echo "Next steps:"
  echo "  1. Verify: npm info intellibiz"
  echo "  2. Test:   npx create-intellibiz test-app"
  echo "  3. Commit: git add -A && git commit -m 'release: v$(get_package_version packages/intellibiz)'"
fi
