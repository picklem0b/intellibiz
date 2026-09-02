/**
 * End-to-end test: import from 'intellibiz' (barrel export)
 *
 * Verifies that every public symbol is importable and works at runtime.
 */

import {
  // core
  defineAction,
  defineConfig,
  definePlugin,
  getContext,
  runWithContext,
  hasContext,
  getTenantId,
  getUserId,
  getTraceId,
  getRole,
  getOrigin,
  getElapsedMs,
  emit,
  on,
  off,
  IntellibizError,
  ContextMissingError,
  ConfigValidationError,
  ConfigDependencyError,
  StrictTenancyViolationError,
  createTraceId,
  isTraceId,
  getNative,
  setNative,
  resetNative,

  // db
  sql,
  db,

  // finance
  finance,
  money,
  Money,

  // commerce
  commerce,

  // identity
  identity,

  // http
  http,
} from 'intellibiz';

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${label}`);
  } else {
    failed++;
    console.error(`  ❌ ${label}`);
  }
}

function section(name) {
  console.log(`\n── ${name} ──`);
}

// ─── core ───────────────────────────────────────────────────────────────────

section('core');

assert(typeof defineAction === 'function', 'defineAction is a function');
assert(typeof defineConfig === 'function', 'defineConfig is a function');
assert(typeof definePlugin === 'function', 'definePlugin is a function');
assert(typeof getContext === 'function', 'getContext is a function');
assert(typeof runWithContext === 'function', 'runWithContext is a function');
assert(typeof hasContext === 'function', 'hasContext is a function');
assert(typeof getTenantId === 'function', 'getTenantId is a function');
assert(typeof getUserId === 'function', 'getUserId is a function');
assert(typeof getTraceId === 'function', 'getTraceId is a function');
assert(typeof getRole === 'function', 'getRole is a function');
assert(typeof getOrigin === 'function', 'getOrigin is a function');
assert(typeof getElapsedMs === 'function', 'getElapsedMs is a function');
assert(typeof ContextMissingError === 'function', 'ContextMissingError is a constructor');
assert(typeof ConfigValidationError === 'function', 'ConfigValidationError is a constructor');
assert(typeof ConfigDependencyError === 'function', 'ConfigDependencyError is a constructor');
assert(typeof StrictTenancyViolationError === 'function', 'StrictTenancyViolationError is a constructor');

// defineConfig validates and returns frozen config
const config = defineConfig({
  modules: ['finance'],
  finance: { baseCurrency: 'USD' },
});
assert(Array.isArray(config.modules), 'defineConfig returns config with modules');
assert(config.modules.includes('finance'), 'defineConfig includes finance module');

// Trace IDs
const traceId = createTraceId();
assert(typeof traceId === 'string', 'createTraceId returns a string');
assert(isTraceId(traceId), 'isTraceId validates the created trace ID');

// Native bridge
const prevNative = getNative();
assert(typeof prevNative === 'object' || prevNative === undefined, 'getNative returns object or undefined');
setNative({ test: true });
assert(getNative().test === true, 'setNative sets a value');
resetNative();

// ─── event bus ──────────────────────────────────────────────────────────────

section('event bus');

let eventReceived = false;
on('test-event', () => { eventReceived = true; });
emit('test-event');
assert(eventReceived === true, 'emit/on event bus works');
off('test-event', () => {});

// ─── db (sql requires an active ALS context) ────────────────────────────────

section('db');

assert(typeof sql === 'function', 'sql is a function');
assert(typeof db === 'object' || typeof db === 'function', 'db is an object or function');

// sql() needs a tenant context — test inside runWithContext
const queryResult = await runWithContext(
  { tenantId: 't-001', userId: 'u-001', role: 'user', origin: 'test', traceId: 'tr-test' },
  () => sql`SELECT * FROM users WHERE id = ${1}`
);
assert(typeof queryResult === 'object', 'sql tagged template returns an object inside context');
assert(queryResult.text.includes('SELECT'), 'sql template contains SELECT');

// hasContext should be false outside
assert(hasContext() === false, 'hasContext is false outside any context');

// getTenantId inside context
const tenant = await runWithContext(
  { tenantId: 't-002', userId: 'u-002', role: 'admin', origin: 'test', traceId: 'tr-test-2' },
  () => getTenantId()
);
assert(tenant === 't-002', 'getTenantId returns correct tenant inside context');

// ─── finance ────────────────────────────────────────────────────────────────

section('finance');

assert(typeof money === 'function', 'money is a function');
assert(typeof finance === 'object' || typeof finance === 'function', 'finance is an object or function');
assert(typeof Money === 'function', 'Money class is exported');

// Money arithmetic
const price = money('19.99', 'USD');
const qty = money('3.00', 'USD');
const total = price.multiply(3);
assert(total.amount === '59.97', `money multiply: 19.99 * 3 = ${total.amount}`);

const discounted = price.multiply(0.85);
assert(discounted.amount === '16.99', `money discount: 19.99 * 0.85 = ${discounted.amount}`);

const sum = price.add(qty);
assert(sum.amount === '22.99', `money add: 19.99 + 3.00 = ${sum.amount}`);

const diff = price.subtract(qty);
assert(diff.amount === '16.99', `money subtract: 19.99 - 3.00 = ${diff.amount}`);

// calculateTotal (tax)
const taxTotal = finance.calculateTotal({
  items: [{ price: money('100', 'USD'), quantity: 2 }],
  taxDestination: { country: 'US', region: 'CA' },
});
assert(typeof taxTotal === 'object', 'finance.calculateTotal returns an object');

// ─── commerce ───────────────────────────────────────────────────────────────

section('commerce');

assert(typeof commerce === 'object' || typeof commerce === 'function', 'commerce is an object or function');

// ─── identity ───────────────────────────────────────────────────────────────

section('identity');

assert(typeof identity === 'object' || typeof identity === 'function', 'identity is an object or function');

// ─── http ───────────────────────────────────────────────────────────────────

section('http');

assert(typeof http === 'object' || typeof http === 'function', 'http is an object or function');

// ─── Summary ────────────────────────────────────────────────────────────────

console.log(`\n${'═'.repeat(50)}`);
console.log(`  Results: ${passed} passed, ${failed} failed`);
console.log(`${'═'.repeat(50)}\n`);

process.exit(failed > 0 ? 1 : 0);
