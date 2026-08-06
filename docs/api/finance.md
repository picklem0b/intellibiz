# `@intellibiz/finance` API Reference

High-precision fixed-point monetary calculations and tax engine.

---

## `finance.money(amount, currency)`

Creates an immutable `Money` instance. All arithmetic uses Rust fixed-point math — no floating-point drift.

```typescript
import { finance } from 'intellibiz'

const price = finance.money('19.99', 'USD')
const tax = price.multiply('0.20')
const total = price.add(tax)

console.log(total.toString())     // '23.99 USD'
console.log(total.toFixed(2))     // '23.99'
console.log(total.toMinorUnits()) // 2399
```

### `Money` Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `.add(other)` | `Money` | Add two Money values (same currency) |
| `.subtract(other)` | `Money` | Subtract (same currency) |
| `.multiply(factor)` | `Money` | Multiply by a decimal factor |
| `.toMinorUnits()` | `number` | Amount in cents (integer, safe) |
| `.toFixed(n)` | `string` | Decimal string with n places |
| `.toString()` | `string` | `'{amount} {currency}'` |

---

## `finance.calculateTotal(options)`

Calculates subtotal, destination-based tax, and grand total for a line-item cart.

```typescript
const totals = await finance.calculateTotal({
  items: [
    { price: '49.99', quantity: 2, currency: 'USD' },
    { price: '9.99', quantity: 1, currency: 'USD' },
  ],
  destination: { country: 'DE', vatId: 'DE123456789' },
})

console.log(totals.subtotal.toString())   // '109.97 USD'
console.log(totals.tax.toString())        // '20.89 USD' (19% DE VAT)
console.log(totals.grandTotal.toString()) // '130.86 USD'
```

### Options

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `items` | `CartItem[]` | Yes | Line items with price, quantity, currency |
| `destination` | `{ country, state?, vatId? }` | No | Destination for tax calculation |

---

## `finance.convert(amount, from, to)`

Converts a `Money` value from one currency to another using the configured exchange rate provider.

```typescript
const usd = finance.money('100.00', 'USD')
const eur = await finance.convert(usd, 'USD', 'EUR')
```
