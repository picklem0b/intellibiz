# Strategy Override & Auto-Scaffolding Guide

This guide explains how to customize Intellibiz engine behavior without modifying core packages.

---

## How It Works

Intellibiz uses a registry of strategies for business rules. When you need custom logic, you enable an override flag in `intellibiz.config.ts`. The CLI detects the flag and scaffolds a type-safe override file at the configured path. You fill in the logic. The engine loads it at boot.

---

## Enabling an Override

```typescript
export default defineConfig({
  overrides: {
    path: './intellibiz',    // Directory where override files live
    autoScaffold: true,       // CLI auto-creates missing files
    taxCalculation: true,     // Enable custom tax logic
    shippingCalculator: true, // Enable custom shipping rates
  },
})
```

Run `npx intellibiz dev` — missing override files are scaffolded automatically.

---

## Available Overrides

| Flag | File | Overrides |
|------|------|-----------|
| `overrides.taxCalculation` | `intellibiz/tax-rules.ts` | Tax rate calculation |
| `overrides.shippingCalculator` | `intellibiz/shipping.ts` | Shipping cost calculation |
| `overrides.dbQueryLogic` | `intellibiz/db-rules.ts` | Query transformation |
| `overrides.invoiceTemplate` | `intellibiz/invoice.ts` | Invoice PDF generation |
| `overrides.fraudDetection` | `intellibiz/fraud.ts` | Fraud signal evaluation |

---

## Override Examples

### Custom Tax Rules

```typescript
// intellibiz/tax-rules.ts
import { defineTaxOverride } from 'intellibiz/config'

export default defineTaxOverride({
  calculate: async (amount, destination, context) => {
    // Oregon has no state sales tax
    if (destination.state === 'OR') {
      return { taxAmount: 0, rate: 0 }
    }

    // Fall back to the internal engine for all other states
    return context.defaultTaxEngine.calculate(amount, destination)
  },
})
```

### Custom DB Query Logic

```typescript
// intellibiz/db-rules.ts
import { defineDbOverride } from 'intellibiz/config'

export default defineDbOverride({
  onSelectFrom: async (query, ctx) => {
    // Allow SuperAdmins to see soft-deleted records
    if (ctx.role === 'SuperAdmin') {
      query.includeDeleted = true
    }
    return query
  },
})
```

---

## Override Rules

- Overrides must return the same type as the original strategy function.
- Overrides are loaded once at boot. A server restart is required after changing them.
- Two override files for the same strategy throw `ConflictingOverrideError` at boot.
- Calling `context.defaultEngine.*` inside an override always calls the original engine — no recursion.
