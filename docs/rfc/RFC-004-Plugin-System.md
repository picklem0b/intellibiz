# RFC-004: Plugin System

**Status:** Draft
**Dependencies:** RFC-001, RFC-006
**Implemented In:** `@intellibiz/core` (pending)

---

## Problem

Intellibiz ships with adapters for common providers — Stripe for payments, PostgreSQL for the database, internal for tax calculations. But no set of built-in adapters covers every business's needs. A company operating in India may need a Razorpay payment adapter. A European SaaS may need a Vatstack tax provider. A logistics platform may need a custom carrier integration.

The alternative — adding every possible integration to the core packages — is not viable. It would make the core packages bloated with code that 90% of users will never run, introduce hundreds of third-party dependencies into every installation, and create a maintenance burden that scales with the number of integrations rather than the sophistication of the engine.

Currently, the only way to extend Intellibiz is to fork a core package and modify it directly. This breaks on every upstream update, is not distributable, and leaves the developer responsible for keeping their fork in sync with the main codebase.

---

## Motivation

A plugin system allows third-party developers and internal platform teams to extend Intellibiz with new providers, services, actions, and event listeners — without modifying core packages and without the core team having to review every integration.

A plugin is a self-contained module that declares what it provides, what it needs from the DI container, and how it hooks into the Intellibiz lifecycle. The engine loads it, validates it, and makes its contributions available to the rest of the system.

This is the same model used by successful extensible systems: Fastify plugins, Hono middleware, Vite plugins. The pattern is well understood and well tested at scale.

---

## Proposal

Introduce `definePlugin` as the API for creating Intellibiz plugins. A plugin can contribute services, actions, event listeners, and config schema extensions. Plugins are loaded at boot time, validated against the DI container, and sandboxed to prevent interference between plugins.

### Plugin Definition

```typescript
import { definePlugin } from '@intellibiz/core'

export default definePlugin({
  name: 'razorpay-payment',
  version: '1.0.0',

  // What this plugin needs from the DI container
  dependencies: ['config', 'log', 'ledger'],

  // What this plugin contributes to the DI container
  services: {
    'payment.provider': (deps) => new RazorpayProvider(deps.config.razorpay),
  },

  // Lifecycle hooks
  hooks: {
    onInit: async (app) => {
      app.log.info('Razorpay plugin initialized')
    },
    onStop: async (app) => {
      await app.services.get('payment.provider').disconnect()
    },
  },

  // Extends intellibiz.config.ts with plugin-specific flags
  configSchema: z.object({
    razorpay: z.object({
      keyId: z.string(),
      keySecret: z.string(),
    }),
  }),
})
```

### Plugin Registration

```typescript
import { defineConfig } from 'intellibiz/config'
import razorpay from '@intellibiz/plugin-razorpay'

export default defineConfig({
  plugins: [razorpay],
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID,
    keySecret: process.env.RAZORPAY_KEY_SECRET,
  },
})
```

### Plugin Types

| Type | What It Contributes | Example |
|------|---------------------|---------|
| Service Plugin | A new injectable service | Payment provider, tax calculator |
| Action Plugin | New business logic actions | Custom checkout flow |
| Event Plugin | New event listeners | Slack notifications on payment |
| Schema Plugin | Config schema extensions | New flag definitions |

### Sandboxing

Plugins run with a restricted view of the DI container. A plugin can only access services it explicitly declares in its `dependencies` array. It cannot reach into other plugins' services, cannot access the raw database connection, and cannot override core services without declaring it as an explicit override with a governance warning.

---

## Examples

**Using a payment provider from a plugin:**

```typescript
import { payments } from '@intellibiz/commerce'

const result = await payments.charge({
  provider: 'razorpay',
  amount: total,
  currency: 'INR',
})
```

**Registering a custom event listener from a plugin:**

```typescript
definePlugin({
  name: 'slack-notifications',
  version: '1.0.0',
  events: {
    PaymentFailed: async (data, deps) => {
      await deps.slack.postMessage(`Payment failed for user ${data.userId}`)
    },
  },
})
```

---

## Advantages

- **Ecosystem.** Third-party developers can build and publish plugins independently. The core team does not need to review or maintain every integration.
- **Zero impact on unused integrations.** A plugin that is not registered contributes zero code to the running process.
- **Validated at boot.** Plugins declare their dependencies and config schema. If a required dependency is missing or the config is invalid, the engine refuses to start with a clear error — not a runtime crash.
- **Distributable.** Plugins are standard npm packages. They can be versioned, published, and installed like any other dependency.

---

## Disadvantages

- **Sandboxing adds complexity.** Enforcing that plugins only access declared dependencies requires a non-trivial DI container implementation. Permissive DI containers are easy; restricted ones are hard.
- **Plugin compatibility.** A plugin built against `@intellibiz/core@0.x` may break when the core API changes. A compatibility matrix and deprecation policy are needed before the plugin ecosystem can grow safely.
- **Discovery problem.** Without a registry, developers have no way to find available plugins. A plugin registry is out of scope for v1 but is a prerequisite for ecosystem growth.

---

## Alternatives

**Option A: Middleware-based extension.**
Allow developers to insert functions into the processing pipeline at specific points. Rejected as the primary model because middleware is a lower-level primitive that requires understanding the internal execution pipeline. Middleware may be offered as a secondary extension point for advanced users.

**Option B: Monorepo-only plugins.**
Only allow plugins from within the Intellibiz monorepo. Rejected because it defeats the purpose — the core team cannot maintain every integration, and preventing third-party plugins limits adoption.

**Option C: Configuration-only extension.**
Allow extension only through `intellibiz.config.ts` flags with no code contribution. Rejected because flags can control behavior but cannot add new providers or services that require third-party SDK code.

---

## Implementation Notes

- Plugin loading order is deterministic: core services initialize first, then plugins in the order they appear in the `plugins` array in `intellibiz.config.ts`.
- Plugin service names are namespaced to prevent collisions: a plugin named `razorpay-payment` that registers a `provider` service gets the key `razorpay-payment.provider` in the DI container.
- The `configSchema` from each plugin is merged with the core config schema at boot. Validation runs against the merged schema before any plugin is initialized.
- Circular dependencies between plugins (Plugin A depends on Plugin B, Plugin B depends on Plugin A) are detected at boot and throw a `PluginCircularDependencyError`.

---

## Future Work

- **Plugin registry.** A public registry at `plugins.intellibiz.dev` where developers can discover, publish, and review plugins.
- **Plugin isolation via worker threads.** For untrusted third-party plugins, run them in a separate Node.js worker thread to prevent a buggy plugin from crashing the main process.
- **Hot plugin reload.** Allow plugins to be reloaded without restarting the server — primarily for development workflows.
- **Plugin versioning compatibility matrix.** A machine-readable declaration of which plugin versions are compatible with which core versions.
