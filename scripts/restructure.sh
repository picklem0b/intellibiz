#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ ! -f "$ROOT/package.json" ] || ! grep -q '"name": "intellibiz-monorepo"' "$ROOT/package.json"; then
  echo "Error: run this script from the intellibiz monorepo root (where package.json lives)."
  exit 1
fi

echo "Starting Intellibiz V1 restructure..."
echo "Root: $ROOT"
echo ""


# ─── STEP 1: DELETE V2 PACKAGES ──────────────────────────────────────────────
echo "[1/6] Removing V2 packages..."

V2_PACKAGES=(
  packages/ai
  packages/auth
  packages/cache
  packages/crm
  packages/governance
  packages/graphql
  packages/hr
  packages/inventory
  packages/legal
  packages/mail
  packages/manufacturing
  packages/metrics
  packages/queue
  packages/rpc
  packages/scheduler
  packages/storage
  packages/websocket
)

for pkg in "${V2_PACKAGES[@]}"; do
  if [ -d "$ROOT/$pkg" ]; then
    rm -rf "$ROOT/$pkg"
    echo "  Deleted $pkg/"
  fi
done


# ─── STEP 2: RENAME packages/database → packages/db ─────────────────────────
echo ""
echo "[2/6] Renaming packages/database to packages/db..."

if [ -d "$ROOT/packages/database" ]; then
  mv "$ROOT/packages/database" "$ROOT/packages/db"
  DB_PKG="$ROOT/packages/db/package.json"
  sed -i 's/"@intellibiz\/database"/"@intellibiz\/db"/g' "$DB_PKG"
  echo "  Moved packages/database → packages/db"
  echo "  Updated package name to @intellibiz/db"
fi


# ─── STEP 3: MOVE plugins/* OUT OF packages/ ─────────────────────────────────
echo ""
echo "[3/6] Moving packages/plugins/* to top-level plugins/..."

mkdir -p "$ROOT/plugins"

PLUGINS=(
  anthropic
  aws
  azure
  gcp
  mysql
  openai
  postgres
  redis
  s3
  sqlite
  stripe
)

for plugin in "${PLUGINS[@]}"; do
  SRC="$ROOT/packages/plugins/$plugin"
  DST="$ROOT/plugins/$plugin"
  if [ -d "$SRC" ]; then
    mv "$SRC" "$DST"
    echo "  Moved packages/plugins/$plugin → plugins/$plugin"
  fi
done

if [ -d "$ROOT/packages/plugins" ]; then
  rm -rf "$ROOT/packages/plugins"
  echo "  Deleted empty packages/plugins/"
fi


# ─── STEP 4: MOVE internal packages ──────────────────────────────────────────
echo ""
echo "[4/6] Moving shared/types/logger to internal/..."

mkdir -p "$ROOT/internal"

declare -A INTERNAL_MOVES=(
  [packages/shared]="internal/shared"
  [packages/types]="internal/types"
  [packages/logger]="internal/logger"
)

for src in "${!INTERNAL_MOVES[@]}"; do
  dst="${INTERNAL_MOVES[$src]}"
  if [ -d "$ROOT/$src" ]; then
    mv "$ROOT/$src" "$ROOT/$dst"
    echo "  Moved $src → $dst"
  fi
done


# ─── STEP 5: MOVE tools ───────────────────────────────────────────────────────
echo ""
echo "[5/6] Moving create-intellibiz/sdk to tools/..."

mkdir -p "$ROOT/tools"

declare -A TOOL_MOVES=(
  [packages/create-intellibiz]="tools/create-intellibiz"
  [packages/sdk]="tools/sdk"
)

for src in "${!TOOL_MOVES[@]}"; do
  dst="${TOOL_MOVES[$src]}"
  if [ -d "$ROOT/$src" ]; then
    mv "$ROOT/$src" "$ROOT/$dst"
    echo "  Moved $src → $dst"
  fi
done


# ─── STEP 6: SCAFFOLD NEW src/ FILES & DIRECTORIES ───────────────────────────
echo ""
echo "[6/6] Scaffolding new src/ structure inside existing packages..."

touch_empty() {
  local file="$ROOT/$1"
  if [ ! -f "$file" ]; then
    mkdir -p "$(dirname "$file")"
    touch "$file"
    echo "  Created $1"
  fi
}

touch_empty "packages/core/src/context/storage.ts"
touch_empty "packages/core/src/context/specialized/request.ts"
touch_empty "packages/core/src/context/specialized/action.ts"
touch_empty "packages/core/src/context/specialized/event.ts"
touch_empty "packages/core/src/context/specialized/job.ts"
touch_empty "packages/core/src/context/specialized/socket.ts"
touch_empty "packages/core/src/context/specialized/app.ts"
touch_empty "packages/core/src/define-plugin.ts"
touch_empty "packages/core/src/logger.ts"
touch_empty "packages/core/src/errors.ts"

touch_empty "packages/db/src/sql/template.ts"
touch_empty "packages/db/src/sql/fragment.ts"
touch_empty "packages/db/src/tenancy/column.ts"
touch_empty "packages/db/src/tenancy/schema.ts"
touch_empty "packages/db/src/governance/sudo.ts"
touch_empty "packages/db/src/index.ts"

touch_empty "packages/finance/src/currency/registry.ts"
touch_empty "packages/finance/src/tax/calculator.ts"

touch_empty "packages/commerce/src/providers/base.ts"
touch_empty "packages/commerce/src/providers/stripe.ts"
touch_empty "packages/commerce/src/providers/payfast.ts"
touch_empty "packages/commerce/src/webhooks/dedup.ts"
touch_empty "packages/commerce/src/webhooks/verify.ts"
touch_empty "packages/commerce/src/state-machine/bank-retry.ts"
touch_empty "packages/commerce/src/transaction.ts"

touch_empty "packages/identity/src/jwt.ts"
touch_empty "packages/identity/src/resolver.ts"

touch_empty "packages/http/src/router.ts"
touch_empty "packages/http/src/middleware.ts"

touch_empty "packages/cli/src/commands/dev.ts"
touch_empty "packages/cli/src/commands/build.ts"
touch_empty "packages/cli/src/commands/audit.ts"
touch_empty "packages/cli/src/commands/dashboard.ts"
touch_empty "packages/cli/src/index.ts"

touch_empty "packages/testing/src/time-travel.ts"
touch_empty "packages/testing/src/mock-gateway.ts"
touch_empty "packages/testing/src/tenant-context.ts"
touch_empty "packages/testing/src/ledger-assert.ts"
touch_empty "packages/testing/src/index.ts"

touch_empty "tools/create-intellibiz/src/index.ts"
touch_empty "tools/sdk/src/index.ts"

touch_empty "internal/shared/src/index.ts"
touch_empty "internal/types/src/index.ts"
touch_empty "internal/logger/src/index.ts"

for plugin in "${PLUGINS[@]}"; do
  touch_empty "plugins/$plugin/src/index.ts"
done


# ─── EDIT: pnpm-workspace.yaml ───────────────────────────────────────────────
echo ""
echo "[edit] Updating pnpm-workspace.yaml..."

cat > "$ROOT/pnpm-workspace.yaml" << 'EOF'
packages:
  - 'packages/*'
  - 'plugins/*'
  - 'internal/*'
  - 'tools/*'
  - 'examples/*'
EOF
echo "  Updated pnpm-workspace.yaml"


# ─── EDIT: turbo.json (fix merge conflict) ───────────────────────────────────
echo ""
echo "[edit] Fixing turbo.json merge conflict..."

cat > "$ROOT/turbo.json" << 'EOF'
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "test": {
      "dependsOn": ["^build"]
    },
    "lint": {}
  }
}
EOF
echo "  Fixed turbo.json"


# ─── EDIT: packages/intellibiz/src/index.ts ──────────────────────────────────
echo ""
echo "[edit] Trimming V2 exports from packages/intellibiz/src/index.ts..."

cat > "$ROOT/packages/intellibiz/src/index.ts" << 'EOF'
export { http } from '@intellibiz/http'
export { finance } from '@intellibiz/finance'
export { commerce } from '@intellibiz/commerce'
export { identity } from '@intellibiz/identity'
export { defineConfig } from '@intellibiz/core'
export { defineAction } from '@intellibiz/core'
export type { IntellibiзConfig } from '@intellibiz/core'
EOF
echo "  Updated packages/intellibiz/src/index.ts"


# ─── EDIT: packages/intellibiz/package.json ──────────────────────────────────
echo ""
echo "[edit] Trimming V2 dependencies from packages/intellibiz/package.json..."

cat > "$ROOT/packages/intellibiz/package.json" << 'EOF'
{
  "name": "intellibiz",
  "version": "1.0.0",
  "private": false,
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    },
    "./commerce": {
      "import": "./dist/commerce.js",
      "require": "./dist/commerce.cjs"
    },
    "./finance": {
      "import": "./dist/finance.js",
      "require": "./dist/finance.cjs"
    },
    "./identity": {
      "import": "./dist/identity.js",
      "require": "./dist/identity.cjs"
    },
    "./config": {
      "import": "./dist/config.js",
      "require": "./dist/config.cjs"
    }
  },
  "scripts": {
    "build": "tsup src/index.ts --format esm,cjs --dts",
    "dev": "tsup src/index.ts --format esm,cjs --dts --watch",
    "test": "echo \"no tests yet\""
  },
  "dependencies": {
    "@intellibiz/core": "workspace:*",
    "@intellibiz/db": "workspace:*",
    "@intellibiz/finance": "workspace:*",
    "@intellibiz/commerce": "workspace:*",
    "@intellibiz/identity": "workspace:*",
    "@intellibiz/http": "workspace:*"
  }
}
EOF
echo "  Updated packages/intellibiz/package.json"


# ─── DONE ─────────────────────────────────────────────────────────────────────
echo ""
echo "Restructure complete."
echo ""
echo "Final layout:"
echo "  packages/   — V1 core (core, db, finance, commerce, identity, http, cli, testing, intellibiz)"
echo "  plugins/    — provider plugins (stripe, postgres, redis, s3 ...)"
echo "  internal/   — private workspace packages (shared, types, logger)"
echo "  tools/      — developer tooling (create-intellibiz, sdk)"
echo "  examples/   — reference apps"
echo "  crates/     — Rust workspace (unchanged)"
echo "  docs/       — documentation (unchanged)"
