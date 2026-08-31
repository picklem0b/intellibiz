# IntelliBiz Publish Guide

## Prerequisites

```bash
# Node.js >= 22
node --version  # v22+

# pnpm >= 10
pnpm --version  # 10.11+

# Rust toolchain (for native addon)
cargo --version  # 1.97+

# npm account with 2FA
npm whoami  # Should show your username
```

## 1. Build Everything

```bash
cd intellibiz

# Install dependencies
pnpm install

# Build the Rust native addon
cargo build --release --manifest-path crates/bindings/Cargo.toml
cp target/release/libintellibiz_bindings.so packages/core/intellibiz.node

# Build all TypeScript packages (dependency order)
pnpm run build

# Run all tests to verify
pnpm run test
```

## 2. Dry Run (Recommended)

```bash
./scripts/publish.sh --dry
```

This shows exactly what would be published without actually publishing.

## 3. Publish to npm

### Option A: Use the publish script (recommended)
```bash
./scripts/publish.sh
```

### Option B: Publish manually in order

Packages MUST be published in dependency order:

```bash
# Layer 1: No internal dependencies
cd packages/core && pnpm publish --access public
cd packages/create-intellibiz && pnpm publish --access public

# Layer 2: Depends only on core
cd packages/finance && pnpm publish --access public
cd packages/db && pnpm publish --access public
cd packages/identity && pnpm publish --access public

# Layer 3: Depends on core + layer 2
cd packages/commerce && pnpm publish --access public
cd packages/http && pnpm publish --access public
cd packages/testing && pnpm publish --access public
cd packages/cli && pnpm publish --access public

# Layer 4: Aggregator (depends on everything)
cd packages/intellibiz && pnpm publish --access public

# Layer 5: Plugins
cd plugins/stripe && pnpm publish --access public
```

### workspace:* Handling

pnpm automatically converts `workspace:*` references to real versions during publish.
If package `@intellibiz/finance` depends on `"@intellibiz/core": "workspace:*"` and both are at v1.0.0, pnpm publishes finance with `"@intellibiz/core": "^1.0.0"`.

### Publishing a Pre-release (Canary)

```bash
./scripts/publish.sh --canary
```

This publishes with the `canary` tag:
```
npm install intellibiz@canary
```

### Publishing a Specific Version

```bash
# In the package directory
cd packages/core
# Edit package.json version manually
pnpm publish --access public --tag latest
```

## 4. npx create-intellibiz

After publishing `create-intellibiz` to npm:

```bash
# Users can create a new project with:
npx create-intellibiz my-app

# Or with a specific directory:
npx create-intellibiz my-app --dir ./projects/my-app
```

The `create-intellibiz` package:
- Has zero runtime dependencies (only citty + consola)
- Is self-contained with all templates inline
- Generates a complete project structure
- Includes intellibiz.config.ts, actions, server entry, tsconfig, .env.example

## 5. Package Structure After Publish

```
npm: @intellibiz/core@1.0.0
  ├── dist/index.mjs     (ESM)
  ├── dist/index.cjs     (CJS)
  ├── dist/index.d.mts   (TypeScript types)
  └── intellibiz.node    (Rust native addon, platform-specific)
```

The native addon is included in `files: ["dist", "*.node"]` so it ships with the package.

### Platform-Specific Builds (Future)

For production, you'd use `@napi-rs/cli` to build prebuilt binaries for:
- linux-x64-gnu
- linux-arm64-gnu
- darwin-x64
- darwin-arm64
- win32-x64-msvc

```bash
# Install napi CLI
pnpm add -D @napi-rs/cli

# Build platform-specific binaries
napi build --release --platform

# Generate npm config for platform packages
napi create-npm-dir
```

## 6. Testing the Published Package

```bash
# Test locally with npm link
cd packages/core && pnpm link --global
mkdir /tmp/test-intellibiz && cd /tmp/test-intellibiz
npm init -y && npm link @intellibiz/core
node -e "const { createTraceId } = require('@intellibiz/core'); console.log(createTraceId())"

# Test from a fresh project
cd ~/intellibiz-test/backend
# The packages are already copied to node_modules for local testing
node --input-type=module -e "
import { http } from 'intellibiz';
console.log('✅ IntelliBiz works:', typeof http);
"
```

## 7. Version Bumping

Follow semver:
- **Major** (1.0.0 → 2.0.0): Breaking changes
- **Minor** (1.0.0 → 1.1.0): New features, backward compatible
- **Patch** (1.0.0 → 1.0.1): Bug fixes

```bash
# Bump all packages at once
find packages/ plugins/ -name "package.json" -not -path "*/node_modules/*" \
  -exec sed -i 's/"version": "1.0.0"/"version": "1.1.0"/' {} \;
```

## 8. Post-Publish Verification

```bash
# Verify packages are live
npm info @intellibiz/core
npm info intellibiz
npm info create-intellibiz
npm info @intellibiz/plugin-stripe

# Test installation
mkdir /tmp/verify && cd /tmp/verify
npm init -y
npm install intellibiz @intellibiz/http
node -e "const { defineAction } = require('intellibiz'); console.log('✅ Works:', typeof defineAction)"
```

## Quick Reference

| Command | Purpose |
|---------|---------|
| `./scripts/publish.sh` | Publish all packages |
| `./scripts/publish.sh --dry` | Dry run (no actual publish) |
| `./scripts/publish.sh --canary` | Publish canary pre-releases |
| `pnpm run build` | Build all packages |
| `pnpm run test` | Run all tests |
| `cargo build --release` | Build the Rust native addon |

## Package Naming

| Package | npm name | Description |
|---------|----------|-------------|
| packages/core | `@intellibiz/core` | Kernel — ALS, defineAction, defineConfig, definePlugin |
| packages/finance | `@intellibiz/finance` | Money, fixed-point arithmetic, tax, currency |
| packages/db | `@intellibiz/db` | SQL templates, Kysely proxy, tenancy, governance |
| packages/identity | `@intellibiz/identity` | RBAC, JWT, tenant resolution |
| packages/commerce | `@intellibiz/commerce` | Transactions, payment providers, webhooks |
| packages/http | `@intellibiz/http` | Hono wrapper, middleware, routing |
| packages/testing | `@intellibiz/testing` | Time travel, mock gateway, assertions |
| packages/cli | `@intellibiz/cli` | CLI commands: dev, build, audit, generate |
| packages/intellibiz | `intellibiz` | Aggregator — the public face of the framework |
| packages/create-intellibiz | `create-intellibiz` | npx scaffolding tool |
| plugins/stripe | `@intellibiz/plugin-stripe` | Stripe payment provider |
