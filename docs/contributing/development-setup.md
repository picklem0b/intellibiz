# Development Setup

This guide covers how to run the Intellibiz monorepo locally for core development.

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 18+ | [nodejs.org](https://nodejs.org) |
| pnpm | 9+ | `npm install -g pnpm` |
| Rust | 1.70+ | [rustup.rs](https://rustup.rs) |
| PostgreSQL | 14+ | [postgresql.org](https://postgresql.org) |

---

## 1. Clone and Install

```bash
git clone https://github.com/chapter2/intellibiz.git
cd intellibiz
pnpm install
```

---

## 2. Build Rust Native Crate

```bash
cd crates/bindings
cargo build --release
```

The compiled `.node` binary is output to `crates/bindings/target/release/`. The `@intellibiz/core` package loads it via the native loader.

For development with auto-recompile on Rust changes:

```bash
cargo watch -x "build --release"
```

---

## 3. Build TypeScript Packages

```bash
pnpm build
```

Turborepo builds packages in dependency order — `@intellibiz/core` first, then all dependent packages.

For watch mode across all packages:

```bash
pnpm dev
```

---

## 4. Database Setup

```bash
createdb intellibiz_dev
```

Copy the environment file and fill in your database URL:

```bash
cp .env.example .env
```

```
DATABASE_URL=postgresql://localhost:5432/intellibiz_dev
```

---

## 5. Run the Flagship Store Example

```bash
cd examples/flagship-store
pnpm install
npx intellibiz migrate up
npx intellibiz dev
```

Server starts on `http://localhost:3000`.

---

## 6. Run Tests

```bash
# All packages
pnpm test

# Single package
cd packages/finance
pnpm test

# Watch mode
pnpm test --watch
```

---

## 7. Lint and Format

```bash
pnpm lint
pnpm format
```

Prettier is configured at the root — `pnpm format` formats all TypeScript, JSON, and Markdown files.

---

## 8. Branch Workflow

```bash
git checkout dev
git checkout -b feat/your-feature-name

# ... make changes ...

git add -A
git commit -m "(feat): short description of change"
git push origin feat/your-feature-name
```

Open a PR targeting `dev`. Never open PRs directly to `main`.

---

## 9. Package-Level Development

Each package in `packages/` has its own `tsconfig.json` extending `tsconfig.base.json` from the root. When developing a specific package:

```bash
cd packages/finance
pnpm dev    # tsup in watch mode
pnpm test   # run package tests
```

---

## 10. Commit Convention

```
(feat): add ledger atomic commit
(fix): correct VAT rounding in formula engine
(refactor): simplify ALS context initialization
(chore): update pnpm lockfile
(docs): update RFC-003 event bus specification
(test): add compensating action rollback tests
(build): configure NAPI-RS cross-compilation pipeline
```
