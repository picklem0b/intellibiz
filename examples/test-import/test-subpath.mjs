/**
 * End-to-end test: subpath imports
 *
 * Verifies that every subpath import works:
 *   import { ... } from 'intellibiz/db'
 *   import { ... } from 'intellibiz/finance'
 *   import { ... } from 'intellibiz/commerce'
 *   import { ... } from 'intellibiz/identity'
 *   import { ... } from 'intellibiz/http'
 *   import { ... } from 'intellibiz/config'
 */

import { sql, db } from 'intellibiz/db';
import { money, finance, getCurrencyDecimals } from 'intellibiz/finance';
import { commerce, transaction } from 'intellibiz/commerce';
import { identity } from 'intellibiz/identity';
import { http } from 'intellibiz/http';
import { defineConfig } from 'intellibiz/config';
import { runWithContext } from 'intellibiz';

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    passed++;
    console.log('  ✅ ' + label);
  } else {
    failed++;
    console.error('  ❌ ' + label);
  }
}

function section(name) {
  console.log('\n── ' + name + ' ──');
}

// ─── intellibiz/db ──────────────────────────────────────────────────────────

section('intellibiz/db');

assert(typeof sql === 'function', 'sql is a function');
assert(typeof db === 'object' || typeof db === 'function', 'db is an object or function');

// sql() requires an active context for tenant scoping
const query = await runWithContext(
  { tenantId: 't-sub', userId: 'u-sub', role: 'user', origin: 'test', traceId: 'tr-sub' },
  () => sql`SELECT * FROM users WHERE id = ${1}`
);
assert(typeof query === 'object', 'sql tagged template returns an object inside context');
assert(query.text.includes('SELECT'), 'sql template contains SELECT');

// ─── intellibiz/finance ────────────────────────────────────────────────────

section('intellibiz/finance');

assert(typeof money === 'function', 'money is a function');
assert(typeof finance === 'object' || typeof finance === 'function', 'finance is an object or function');
assert(typeof getCurrencyDecimals === 'function', 'getCurrencyDecimals is a function');

const price = money('19.99', 'USD');
const total = price.multiply(3);
assert(total.amount === '59.97', 'money multiply: 19.99 * 3 = ' + total.amount);

const total2 = finance.calculateTotal({
  items: [{ price: money('100', 'USD'), quantity: 1 }],
  taxDestination: { country: 'US', region: 'CA' },
});
assert(typeof total2 === 'object', 'finance.calculateTotal returns an object');

// ─── intellibiz/commerce ───────────────────────────────────────────────────

section('intellibiz/commerce');

assert(typeof commerce === 'object' || typeof commerce === 'function', 'commerce is an object or function');
assert(typeof transaction === 'function', 'transaction is a function');

// ─── intellibiz/identity ───────────────────────────────────────────────────

section('intellibiz/identity');

assert(typeof identity === 'object' || typeof identity === 'function', 'identity is an object or function');

// ─── intellibiz/http ───────────────────────────────────────────────────────

section('intellibiz/http');

assert(typeof http === 'object' || typeof http === 'function', 'http is an object or function');

// ─── intellibiz/config ─────────────────────────────────────────────────────

section('intellibiz/config');

assert(typeof defineConfig === 'function', 'defineConfig is a function');

const config = defineConfig({
  modules: ['finance'],
  finance: { baseCurrency: 'USD' },
});
assert(Array.isArray(config.modules), 'defineConfig returns config with modules');
assert(config.modules.includes('finance'), 'defineConfig includes finance module');

// ─── Summary ────────────────────────────────────────────────────────────────

console.log('\n' + '═'.repeat(50));
console.log('  Results: ' + passed + ' passed, ' + failed + ' failed');
console.log('═'.repeat(50) + '\n');

process.exit(failed > 0 ? 1 : 0);
