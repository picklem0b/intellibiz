# Releasing to npm

This page explains how the packages are published, and how consumers install
them. It is written for maintainers and for anyone wondering why there are both
scoped packages and a metapackage.

## What gets published

| Package | Scope | Published |
| --- | --- | --- |
| `intellibiz` | unscoped metapackage | ✅ |
| `@intellibiz/core` | scoped | ✅ |
| `@intellibiz/finance` | scoped | ✅ |
| `@intellibiz/db` | scoped | ✅ |
| `@intellibiz/commerce` | scoped | ✅ |
| `@intellibiz/identity` | scoped | ✅ |
| `@intellibiz/http` | scoped | ✅ |
| `@intellibiz/testing` | scoped | ✅ |
| `@intellibiz/cli` | scoped | ✅ |
| `@intellibiz/create-intellibiz` | scoped | ✅ |
| `internal/*`, `plugins/*`, `tools/sdk` | scoped stubs | ❌ (`private: true`) |

Every published package carries the same version and the same metadata:
`license`, `author`, `repository` (with a `directory` so the npm page links to
the right folder), `homepage`, `bugs`, `publishConfig.access: "public"`, and
`engines.node >= 22`.

## Install shapes

```bash
# Everything, one install. The metapackage pulls in all eight scoped packages.
npm install intellibiz

# Just one capability, no metapackage.
npm install @intellibiz/finance

# The scaffolder, then the CLI it generates a project for.
npm create @intellibiz/intellibiz@latest my-app
npx intellibiz init my-app
npx intellibiz dev
```

Once installed, the two import shapes are equivalent:

```ts
// Unscoped, from the metapackage — the common path.
import { defineAction, money, http } from 'intellibiz';
import { sql } from 'intellibiz/db';

// Scoped, directly from a package.
import { defineAction } from '@intellibiz/core';
import { sql } from '@intellibiz/db';
```

`intellibiz/*` subpaths are re-exports of the matching scoped package, so both
resolve to the same code at runtime.

## How the packages resolve each other

Inside the monorepo, packages depend on each other with the `workspace:*`
protocol. When you run `pnpm publish`, pnpm rewrites `workspace:*` to the
concrete version (for example `1.18.2`) in the published tarball — the workspace
protocol never reaches consumers. This is why publishing must go through
`pnpm publish`, not `npm publish`.

## Release checklist

1. `pnpm install` — refresh the lockfile after any dependency change.
2. `pnpm build && pnpm typecheck && pnpm test && pnpm test:examples` — all green.
3. Bump `version` in every published `package.json` (they move together).
4. Commit, then tag: `git tag v1.18.2 && git push origin v1.18.2`.
5. The `Release` workflow verifies the tag, then runs
   `pnpm -r publish --access public --provenance`. Private packages are
   skipped automatically.

Publishing requires an `NPM_TOKEN` repository secret with publish rights to the
`@intellibiz` scope. Provenance requires the `id-token: write` permission that
the workflow already requests.

## Manual dry run

```bash
pnpm build
pnpm publish:dry   # pnpm -r publish --access public --no-git-checks --dry-run
```

The dry run lists exactly what would be uploaded from each package's `files`
(always `dist/`), without touching the registry.

## Retired names

`@intellibiz/intellibiz@1.0.0` was published before the metapackage settled on
the unscoped `intellibiz` name. It is superseded and should be deprecated once,
so installers are pointed at the current package:

```bash
npm deprecate '@intellibiz/intellibiz' \
  "Renamed to intellibiz. Install with: npm install intellibiz"
```

Deprecation only adds a warning to the old package; it does not delete it and
never breaks existing installs.

## Versioning

Consumers see [Semantic Versioning](https://semver.org). All packages share one
version number, so there is never a question of which `@intellibiz/db` works
with which `@intellibiz/core`.

Maintainers also tag releases with the internal build scheme `v1.<category>.<stage>`
(for example `v1.18.2`), which the CI and release workflows key off. The
`1.18.2` in the manifests is the semver published to npm; the git tag and the
manifest version match so the two schemes never drift apart.
