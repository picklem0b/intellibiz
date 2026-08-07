# Plugin Development Guide

This guide covers how to build, register, and distribute Intellibiz plugins.

---

## What Is a Plugin?

A plugin is a self-contained module that extends Intellibiz with new providers, services, actions, or event listeners without modifying core packages. Plugins are registered at boot time, validated against the DI container, and made available to the rest of the system.

---

## Defining a Plugin

```typescript
import { definePlugin } from '@intellibiz/core'
import { z } from 'zod'

export const razorpayPlugin = definePlugin({
  name: 'razorpay-payment',
  version: '1.0.0',

  // What this plugin needs from the DI container
  dependencies: ['config', 'log', 'ledger'],

  // Config schema extension — merged with core schema at boot
  configSchema: z.object({
    razorpay: z.object({
      keyId: z.string(),
      keySecret: z.string(),
    }),
  }),

  // Services this plugin contributes to the DI container
  services: {
    'payment.provider': (deps) => new RazorpayProvider({
      keyId: deps.config.razorpay.keyId,
      keySecret: deps.config.razorpay.keySecret,
    }),
  },

  // Lifecycle hooks
  hooks: {
    onInit: async (app) => {
      app.log.info('Razorpay plugin initializing')
    },
    onStart: async (app) => {
      app.log.info('Razorpay plugin ready')
    },
    onStop: async (app) => {
      await app.services.get('payment.provider').disconnect()
    },
  },
})
```

---

## Plugin Types

| Type | What It Contributes | Example |
|------|---------------------|---------|
| Service Plugin | New injectable service | Payment provider, tax calculator |
| Action Plugin | New `defineAction` handlers | Custom checkout flow |
| Event Plugin | New `on()` listeners | Slack notifications |
| Schema Plugin | Config schema extensions | New flag definitions |

---

## Registering a Plugin

```typescript
// intellibiz.config.ts
import { defineConfig } from 'intellibiz/config'
import { razorpayPlugin } from '@intellibiz/plugin-razorpay'

export default defineConfig({
  plugins: [razorpayPlugin],
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID!,
    keySecret: process.env.RAZORPAY_KEY_SECRET!,
  },
})
```

---

## Using a Plugin Service

After registration, plugin services are available on every context:

```typescript
import { commerce } from 'intellibiz'

const result = await commerce.transaction(async (tx) => {
  return tx.payments.charge({
    provider: 'razorpay',
    amount: money('1000.00', 'INR'),
    orderId: 'ord_123',
    customerEmail: user.email,
  })
})
```

---

## Plugin Service Namespacing

Plugin service names are namespaced to prevent collisions. A plugin named `razorpay-payment` that registers a `provider` service gets the key `razorpay-payment.provider` in the DI container.

---

## Plugin Loading Order

1. Core services initialize first (`db`, `ledger`, `log`, `cache`, `auth`, `config`)
2. Plugins load in the order they appear in the `plugins` array in `intellibiz.config.ts`
3. Each plugin's `onInit` hook runs after its services are registered
4. All `onStart` hooks run after all plugins have initialized
5. HTTP server begins accepting traffic

---

## Plugin Sandboxing

A plugin can only access services it explicitly declares in its `dependencies` array. It cannot reach into other plugins' private services or access the raw database connection without declaring it.

---

## Scaffolding a Plugin Package

```bash
npx intellibiz generate plugin my-provider
# Creates: packages/plugins/my-provider/
# ├── src/
# │   └── index.ts    — definePlugin call
# └── package.json    — @intellibiz/plugin-my-provider
```

---

## Plugin Conventions

- Plugin package names follow `@intellibiz/plugin-{name}` — e.g. `@intellibiz/plugin-razorpay`
- Plugin folder lives in `packages/plugins/{name}/`
- Default export from `src/index.ts` is the `definePlugin` result
- Plugin version must follow semver and be compatible with the declared core version range
- Circular plugin dependencies throw `PluginCircularDependencyError` at boot
