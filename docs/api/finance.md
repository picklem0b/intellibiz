# `@intellibiz/finance` API Reference

High-precision fixed-point monetary calculations backed by Rust's 128-bit `rust_decimal` engine, regional tax calculation, and ISO-4217 currency support.

---

## `money(amount, currency?)`

Constructs an immutable `Money` instance. All arithmetic executes in Rust C-memory — zero V8 heap allocation, zero GC pressure.

```typescript
import { money } from 'intellibiz'

const price = money(19.99, 'USD')
const price2 = money('19.99', 'USD') // string form — preferred for precision
```

**Never construct `Money` from a JavaScript arithmetic result.** Always pass a string or a raw number literal — never a computed `number`.

---

## `Money` Class Methods

### `.add(other)`

```typescript
const subtotal = money('49.99', 'USD')
const shipping = money('5.00', 'USD')
const total = subtotal.add(shipping) // Money('54.99', 'USD')
```

Throws if currencies differ.

### `.subtract(other)`

```typescript
const refund = total.subtract(money('10.00', 'USD')) // Money('44.99', 'USD')
```

### `.multiply(factor)`

```typescript
const price = money('19.99', 'USD')
const tax = price.multiply(0.15)  // Money('2.9985', 'USD')
const qty = price.multiply(3)     // Money('59.97', 'USD')
```

Factor can be a `number` or `string`. Calculation executes in Rust — no floating-point drift.

### `.allocate(ratios)`

Splits a `Money` value proportionally across ratios without rounding loss. The remainder is distributed to the first allocation.

```typescript
const total = money('22.99', 'USD')
const splits = total.allocate([70, 30]) // 70% vendor / 30% platform

splits[0].format()  // '$16.09'
splits[1].format()  // '$6.90'
// splits[0] + splits[1] = $22.99 exactly — no cent lost
```

### `.toMinorUnits()`

Returns the amount as an integer in the currency's minor unit (e.g. cents for USD). Safe for passing to payment providers.

```typescript
money('19.99', 'USD').toMinorUnits() // 1999
money('1000', 'JPY').toMinorUnits()  // 1000 (JPY has 0 decimal places)
money('1.234', 'BHD').toMinorUnits() // 1234 (BHD has 3 decimal places)
```

### `.amount`

Returns the decimal string rounded for display (2 decimal places for USD, 0 for JPY, 3 for BHD):

```typescript
money('22.9885', 'USD').amount  // '22.99'
money('1000', 'JPY').amount     // '1000'
money('1.2345', 'BHD').amount   // '1.235'
```

### `.format(locale?)`

Returns a locale-aware formatted currency string using `Intl.NumberFormat`:

```typescript
const price = money('22.99', 'USD')
price.format()        // '$22.99'     (default en-US)
price.format('en-ZA') // 'R 22,99'
price.format('de-DE') // '22,99 $'

const yen = money('1000', 'JPY')
yen.format('ja-JP')   // '¥1,000'
```

---

## `finance.calculateTotal(params)`

Calculates subtotal, destination-based tax, and grand total for a line-item cart.

```typescript
import { finance, money } from 'intellibiz'

const totals = await finance.calculateTotal({
  items: [
    { price: money('49.99', 'USD'), quantity: 2 },
    { price: money('9.99', 'USD'),  quantity: 1 },
  ],
  taxRate: 0.15,                                    // explicit rate overrides destination lookup
  destination: { country: 'DE', state: undefined }, // destination-based rate if taxRate omitted
})

totals.subtotal.format()   // '$109.97'
totals.taxTotal.format()   // '$16.50'
totals.grandTotal.format() // '$126.47'
```

### Tax Rate Resolution Order

1. Explicit `taxRate` parameter
2. Override file (`intellibiz/tax-rules.ts`) if `overrides.taxCalculation: true`
3. Internal regional rate table (VAT by EU country, GST by region)
4. Zero if no rate applies

### Parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `items` | `Array<{ price: Money; quantity: number }>` | Yes | Line items |
| `taxRate` | `number` | No | Explicit rate (e.g. `0.15` = 15%) |
| `destination` | `{ country: string; state?: string; vatId?: string }` | No | For destination-based lookup |

---

## `finance.convert(amount, from, to)`

Converts a `Money` value between currencies using the configured exchange rate provider.

```typescript
const usd = money('100.00', 'USD')
const eur = await finance.convert(usd, 'USD', 'EUR')
```

Exchange rates sync on the interval configured by `exchange_rates.sync` (default: `'hourly'`).

---

## ISO-4217 Currency Decimal Precision

The engine resolves decimal precision automatically per currency:

| Decimals | Currencies |
|----------|-----------|
| 0 | JPY, KRW, VND, ISK |
| 2 | USD, EUR, GBP, ZAR, CAD, AUD, most others |
| 3 | BHD, KWD, OMR, JOD |

`money('100', 'JPY').toMinorUnits()` returns `100`. `money('100', 'USD').toMinorUnits()` returns `10000`.

---

## Domain Error Factories

```typescript
import { finance } from 'intellibiz'

throw finance.InsufficientFundsError()
// → HTTP 422 Unprocessable Entity
// → { error: 'INSUFFICIENT_FUNDS', message: 'Account balance is insufficient.' }

throw finance.CurrencyMismatchError('USD', 'EUR')
// → HTTP 400 Bad Request
```
