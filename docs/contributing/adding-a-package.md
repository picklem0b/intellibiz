# Adding a New Package

This guide covers the conventions for creating a new `@intellibiz/*` package in the monorepo.

---

## When to Add a Package

Add a new package when:

- A domain of functionality is large enough to be independently versioned and tree-shaken
- A new plugin for an external service (e.g. `@intellibiz/plugin-sendgrid`)
- A new database adapter (e.g. `@intellibiz/adapter-mysql`)

Do not add a package for:

- A single utility function — add it to `@intellibiz/shared`
- Something that belongs in an existing package's domain

---

## 1. Scaffold the Package

```bash
npx intellibiz generate plugin my-package
# or manually:
mkdir -p packages/my-package/src
```

---

## 2. `package.json`

```json
{
	"name": "@intellibiz/my-package",
	"version": "1.0.0",
	"private": false,
	"main": "./dist/index.js",
	"types": "./dist/index.d.ts",
	"exports": {
		".": {
			"import": "./dist/index.js",
			"require": "./dist/index.cjs"
		}
	},
	"scripts": {
		"build": "tsup src/index.ts --format esm,cjs --dts",
		"dev": "tsup src/index.ts --format esm,cjs --dts --watch",
		"test": "vitest run"
	},
	"dependencies": {
		"@intellibiz/core": "workspace:*"
	}
}
```

---

## 3. `tsconfig.json`

```json
{
	"extends": "../../tsconfig.base.json",
	"compilerOptions": {
		"outDir": "dist",
		"rootDir": "src"
	},
	"include": ["src"]
}
```

---

## 4. `src/index.ts` Structure

```typescript
// Named exports only — no default export
export { myFeature } from './feature';
export type { MyType } from './types';
```

---

## 5. Package Conventions

- **Naming:** `@intellibiz/{domain}` for core domains, `@intellibiz/plugin-{name}` for plugins, `@intellibiz/adapter-{name}` for database adapters
- **Exports:** Named exports only. Default exports only for config files and override definitions.
- **Imports:** Always import from `@intellibiz/core` for shared utilities — never from relative paths crossing package boundaries.
- **Types:** Declare shared types in `@intellibiz/types` and re-export from your package.
- **Error codes:** Register all new error codes in `docs/api/errors.md`.

---

## 6. Register in the Metapackage

If the package should be accessible from `import { x } from 'intellibiz'`, add it to `packages/intellibiz/src/index.ts`:

```typescript
export { myFeature } from '@intellibiz/my-package';
```

And add the subpath export to `packages/intellibiz/package.json`:

```json
{
	"exports": {
		"./my-package": {
			"import": "./dist/my-package.js",
			"require": "./dist/my-package.cjs"
		}
	}
}
```

---

## 7. Update `pnpm-workspace.yaml`

Plugin packages under `packages/plugins/` are already covered by `packages/plugins/*`. New top-level packages under `packages/` are covered by `packages/*`. No change needed unless you add a new directory level.
