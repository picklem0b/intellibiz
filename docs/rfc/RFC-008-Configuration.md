# RFC-008: Configuration System

**Status:** Accepted
**Dependencies:** RFC-006
**Implemented In:** `@intellibiz/core`

---

## Problem

Backend frameworks configure their behavior through a combination of function calls, environment variables, middleware registration, and plugin options scattered across multiple files. Adding authentication to an Express app requires installing a package, calling `app.use(authMiddleware())`, configuring the middleware with options, and knowing which routes it applies to. Adding multi-tenancy requires another package, another middleware call, and careful ordering to ensure it runs before any handler that needs it.

The cognitive overhead of assembling these pieces correctly grows with the number of features. Every configuration decision is a potential mistake — middleware in the wrong order, an option set incorrectly, a feature enabled in development but forgotten in production. The framework has no way to validate that the assembled configuration is internally consistent.

For a business engine with financial, legal, and compliance requirements, this model is unacceptable. A misconfigured tenancy layer that does not properly scope database queries is not a UX problem — it is a data breach. A misconfigured tax engine that silently falls back to zero tax is not a degraded experience — it is a legal liability.

---

## Motivation

`intellibiz.config.ts` should be the single file that defines how the business engine behaves. Every feature, every module, every behavioral flag should be declared here. The engine should read this file at boot, validate it completely before doing anything else, and refuse to start if anything is invalid or inconsistent.

This is the Vite model for business logic. Vite's `vite.config.ts` is the single source of truth for how a project builds. Intellibiz's `intellibiz.config.ts` is the single source of truth for how a business runs.

---

## Proposal

Introduce `defineConfig` as the only way to configure Intellibiz. The function accepts a typed configuration object, validates it at boot using Zod, checks flag dependencies, and makes the resolved config available to every context via the injected `config` service.

### Configuration File

```typescript
import { defineConfig } from 'intellibiz/config'

export default defineConfig({
  tenancy: {
    strategy: 'column',
    key: 'org_id',
    type: 'uuid',
    strict: true,
  },

  ledger: {
    mode: 'atomic',
    sync: ['db'],
    retention: '7y',
  },

  finance: {
    baseCurrency: 'USD',
    taxation: {
      provider: 'internal',
      autoCalculate: true,
    },
  },

  commerce: {
    ledger: { mode: 'atomic' },
    invoicing: 'auto',
  },

  governance: {
    auditAll: true,
    allowSudo: false,
    excludeSensitive: ['password', 'cardNumber'],
  },

  environment: {
    dryRun: false,
    trace: true,
  },
})
```

### Flag Categories

| Category | Flags | Controls |
|----------|-------|----------|
| Identity | `tenancy`, `auth` | Multi-tenancy strategy, authentication |
| Finance | `ledger`, `finance`, `currency` | Accounting mode, currency, tax |
| Commerce | `commerce`, `inventory`, `logistics` | Payment behavior, stock control |
| Legal | `privacy`, `signature`, `license` | GDPR, EULA, license management |
| Operations | `governance`, `reporting`, `environment` | Auditing, reporting, dev tools |
| Growth | `growth`, `referrals` | Referral programs, promotions |
| Infrastructure | `eventBus`, `cache`, `governanceStore` | Multi-node, caching, ledger storage |

### Validation

Config validation runs in two passes at boot:

**Pass 1 — Schema validation.** The full config object is parsed against the Zod schema for each flag. Type mismatches, missing required fields, and invalid enum values are caught here. The engine throws `ConfigValidationError` and does not start.

**Pass 2 — Dependency validation.** Flag dependencies are checked. If `ledger.sync` includes `'s3'`, an `s3` block must be present. If `governance.allowSudo` is `true`, a governance audit warning is emitted at boot. Dependencies are declared as a graph that the validator traverses.

### Environment Overrides

Flags can be overridden per environment without maintaining separate config files:

```typescript
export default defineConfig({
  ledger: { mode: 'atomic' },
  environment: { dryRun: false },
  ...process.env.NODE_ENV === 'test' && {
    ledger: { mode: 'background' },
    environment: { dryRun: true },
  },
})
```

### Accessing Config at Runtime

```typescript
export const getInvoiceSettings = defineAction(async (ctx) => {
  const { baseCurrency } = ctx.config.finance
  const { invoicing } = ctx.config.commerce
  return { baseCurrency, invoicing }
})
```

---

## Examples

**Boot failure on missing S3 config:**

```
ConfigDependencyError: ledger.sync includes 's3' but no 's3' configuration block was found.
Add an 's3' block to intellibiz.config.ts or remove 's3' from ledger.sync.

  at validateConfigDependencies (packages/core/src/config/validate.ts:42)
```

**Boot failure on type mismatch:**

```
ConfigValidationError: Invalid configuration
  tenancy.type: Expected 'uuid' | 'string', received 'number'
  ledger.retention: Expected string matching /^\d+[dwmy]$/, received '7 years'
```

---

## Advantages

- **Single file, complete picture.** A developer can open `intellibiz.config.ts` and understand exactly how the business engine is configured — no middleware files, no plugin option objects, no environment variable hunting.
- **Fail fast.** Misconfiguration is caught at boot, not at runtime. A production deployment that starts successfully is correctly configured.
- **Type-safe flags.** `ctx.config.finance.baseCurrency` is typed as `string`. `ctx.config.ledger.mode` is typed as `'atomic' | 'background'`. No string casting, no `process.env` parsing in business logic.
- **Consistent behavior.** Flags that control behavior across multiple packages (e.g., `tenancy.strict`) are read from one place. There is no risk of the HTTP layer and the job queue layer having different tenancy settings.

---

## Disadvantages

- **Static by design.** Flags cannot change at runtime without a restart. Businesses that need to change behavior dynamically (e.g., enabling a feature flag for a specific tenant) must implement this at the application level, not the framework level.
- **Large config surface.** A system with 50-80 flags has a large `intellibiz.config.ts`. Developers unfamiliar with the system must read documentation to understand what each flag does. Sensible defaults reduce this burden but do not eliminate it.
- **Single config file coupling.** All environments share the same config file. Teams that need drastically different behavior between environments must manage this with conditional spreads or separate config factories.

---

## Alternatives

**Option A: Environment variables only.**
Configure all behavior through `process.env`. Rejected because environment variables are stringly typed, have no schema validation, do not support nested structures, and provide no IDE autocomplete.

**Option B: Multiple config files per environment.**
Maintain `intellibiz.config.dev.ts`, `intellibiz.config.prod.ts`, etc. Rejected because it duplicates configuration and makes it easy for environment-specific files to drift out of sync with each other.

**Option C: Runtime flag management via database.**
Store flags in the database and allow them to change at runtime without a restart. Rejected for core flags — runtime flag changes invalidate the audit trail consistency guarantee. Application-level feature flags are a separate concern and can be implemented in the growth or governance packages.

---

## Implementation Notes

- `defineConfig` is a thin identity function at runtime. Its value is to provide TypeScript types for the config object and serve as a hook for the CLI to parse the config without executing application code.
- The resolved config is frozen after validation. Mutation of config values at runtime throws a `TypeError`.
- The CLI parses `intellibiz.config.ts` using `tsx` to handle TypeScript without a build step.
- Flags with sensible defaults do not need to be specified in `intellibiz.config.ts`. The Zod schema for each flag uses `.default()` for optional fields.

---

## Future Work

- **Config diff command.** `npx intellibiz config --diff` compares the current config against the deployed config and highlights changes that require a restart versus changes that are safe to apply.
- **Config migration.** When a new version of Intellibiz changes a flag's structure (e.g., `taxation.provider` becomes `taxation.engine`), a migration script should update `intellibiz.config.ts` automatically.
- **Per-tenant config overrides.** A mechanism to override specific flags at the tenant level — stored in the database and merged with the base config at context creation time. This would enable tenant-specific feature flags without a full deployment.
