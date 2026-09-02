/**
 * End-to-end test: require('intellibiz') (CommonJS)
 *
 * Verifies that the CJS entry point works for projects using require().
 */

const {
  defineAction,
  defineConfig,
  definePlugin,
  getContext,
  runWithContext,
  hasContext,
  ContextMissingError,
  sql,
  money,
  finance,
  Money,
  http,
  identity,
  commerce,
} = require('intellibiz');

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

console.log('\n── CJS: core ──');

assert(typeof defineAction === 'function', 'defineAction is a function');
assert(typeof defineConfig === 'function', 'defineConfig is a function');
assert(typeof definePlugin === 'function', 'definePlugin is a function');
assert(typeof getContext === 'function', 'getContext is a function');
assert(typeof runWithContext === 'function', 'runWithContext is a function');
assert(typeof hasContext === 'function', 'hasContext is a function');
assert(typeof ContextMissingError === 'function', 'ContextMissingError is a constructor');

const config = defineConfig({
  modules: ['finance'],
  finance: { baseCurrency: 'USD' },
});
assert(Array.isArray(config.modules), 'defineConfig returns config with modules');
assert(config.modules.includes('finance'), 'defineConfig includes finance module');

// Context lifecycle
assert(hasContext() === false, 'hasContext is false outside any context');

runWithContext(
  { tenantId: 't-cjs', userId: 'u-cjs', role: 'admin', origin: 'test', traceId: 'tr-cjs' },
  () => {
    assert(hasContext() === true, 'hasContext is true inside context');
    assert(getContext().tenantId === 't-cjs', 'getContext returns the context');
  }
);

console.log('\n── CJS: db ──');

assert(typeof sql === 'function', 'sql is a function');

console.log('\n── CJS: finance ──');

assert(typeof money === 'function', 'money is a function');
assert(typeof finance === 'object' || typeof finance === 'function', 'finance is an object or function');
assert(typeof Money === 'function', 'Money class is exported');

const price = money('19.99', 'USD');
const total = price.multiply(3);
assert(total.amount === '59.97', 'money multiply: 19.99 * 3 = ' + total.amount);

console.log('\n── CJS: commerce ──');

assert(typeof commerce === 'object' || typeof commerce === 'function', 'commerce is an object or function');

console.log('\n── CJS: identity ──');

assert(typeof identity === 'object' || typeof identity === 'function', 'identity is an object or function');

console.log('\n── CJS: http ──');

assert(typeof http === 'object' || typeof http === 'function', 'http is an object or function');

// ─── Summary ──

console.log('\n' + '═'.repeat(50));
console.log('  Results: ' + passed + ' passed, ' + failed + ' failed');
console.log('═'.repeat(50) + '\n');

process.exit(failed > 0 ? 1 : 0);
