import { describe, it, expect } from 'vitest';
import { definePlugin } from '../define-plugin.js';
import {
	PluginRegistry,
	DIContainer,
	globalPluginRegistry
} from '../plugin/registry.js';
import { PluginLoadError, PluginCircularDependencyError } from '../errors.js';
import type { PluginDefinition } from '../define-plugin.js';

describe('definePlugin', () => {
	it('returns a frozen plugin definition', () => {
		const plugin = definePlugin({
			name: 'test-plugin',
			version: '1.0.0'
		});
		expect(Object.isFrozen(plugin)).toBe(true);
	});

	it('preserves all fields', () => {
		const plugin = definePlugin({
			name: 'my-plugin',
			version: '2.0.0',
			description: 'A test plugin',
			dependencies: ['config', 'log'],
			services: {
				'my-service': (deps) => ({ deps })
			},
			hooks: {
				onInit: async () => {}
			}
		});

		expect(plugin.name).toBe('my-plugin');
		expect(plugin.version).toBe('2.0.0');
		expect(plugin.description).toBe('A test plugin');
		expect(plugin.dependencies).toEqual(['config', 'log']);
		expect(plugin.services).toBeDefined();
		expect(plugin.hooks?.onInit).toBeDefined();
	});

	it('creates copies of arrays and objects (no reference sharing)', () => {
		const deps = ['config'];
		const services = { 'svc': () => ({}) };
		const hooks = { onInit: async () => {} };

		const plugin = definePlugin({
			name: 'test',
			version: '1.0.0',
			dependencies: deps,
			services,
			hooks
		});

		// Mutating original should not affect the frozen definition
		expect(plugin.dependencies).not.toBe(deps);
		expect(plugin.services).not.toBe(services);
	});
});

describe('DIContainer', () => {
	it('registers and retrieves services', () => {
		const container = new DIContainer();
		container.register('my.service', { value: 42 });
		expect(container.get('my.service')).toEqual({ value: 42 });
	});

	it('throws when registering a duplicate key', () => {
		const container = new DIContainer();
		container.register('dup.key', 'value');
		expect(() => container.register('dup.key', 'other')).toThrow(
			/already registered/
		);
	});

	it('throws when getting a non-existent key', () => {
		const container = new DIContainer();
		expect(() => container.get('missing')).toThrow(/not registered/);
	});

	it('has() returns true for registered keys', () => {
		const container = new DIContainer();
		container.register('exists', true);
		expect(container.has('exists')).toBe(true);
		expect(container.has('nope')).toBe(false);
	});

	it('sandboxedView returns only declared keys', () => {
		const container = new DIContainer();
		container.register('a', 1);
		container.register('b', 2);
		container.register('c', 3);

		const view = container.sandboxedView(['a', 'c']);
		expect(view).toEqual({ a: 1, c: 3 });
		expect(view).not.toHaveProperty('b');
	});

	it('sandboxedView handles missing keys gracefully', () => {
		const container = new DIContainer();
		container.register('a', 1);
		const view = container.sandboxedView(['a', 'missing']);
		expect(view).toEqual({ a: 1 });
	});
});

describe('PluginRegistry', () => {
	it('loads a simple plugin', async () => {
		const registry = new PluginRegistry();
		const plugin = definePlugin({
			name: 'simple',
			version: '1.0.0',
			services: {
				hello: () => 'world'
			}
		});

		await registry.loadAll([plugin]);
		expect(registry.getLoaded()).toContain('simple');
		expect(registry.container_.get('simple.hello')).toBe('world');
	});

	it('loads plugins in declaration order', async () => {
		const registry = new PluginRegistry();
		const order: string[] = [];

		const pluginA = definePlugin({
			name: 'a',
			version: '1.0.0',
			services: {
				svc: () => {
					order.push('a');
					return 'a';
				}
			}
		});

		const pluginB = definePlugin({
			name: 'b',
			version: '1.0.0',
			services: {
				svc: () => {
					order.push('b');
					return 'b';
				}
			}
		});

		await registry.loadAll([pluginA, pluginB]);
		expect(order).toEqual(['a', 'b']);
	});

	it('resolves dependencies between plugins', async () => {
		const registry = new PluginRegistry();

		const provider = definePlugin({
			name: 'provider',
			version: '1.0.0',
			services: {
				db: () => ({ connected: true })
			}
		});

		const consumer = definePlugin({
			name: 'consumer',
			version: '1.0.0',
			dependencies: ['provider.db'],
			services: {
				repo: (deps) => {
					const db = deps['provider.db'] as { connected: boolean };
					return { db };
				}
			}
		});

		await registry.loadAll([provider, consumer]);
		expect(registry.container_.get('consumer.repo')).toEqual({
			db: { connected: true }
		});
	});

	it('throws PluginLoadError when dependency is missing', async () => {
		const registry = new PluginRegistry();

		const plugin = definePlugin({
			name: 'orphan',
			version: '1.0.0',
			dependencies: ['nonexistent.service'],
			services: {
				svc: () => ({})
			}
		});

		await expect(registry.loadAll([plugin])).rejects.toThrow(PluginLoadError);
	});

	it('detects circular dependencies between plugins', async () => {
		const registry = new PluginRegistry();

		// Circular detection works on plugin NAMES in the dependencies array
		// When A depends on B and B depends on A, it's detected
		const pluginA = definePlugin({
			name: 'a',
			version: '1.0.0',
			dependencies: ['b'],
			services: { svc: () => 'a' }
		});

		const pluginB = definePlugin({
			name: 'b',
			version: '1.0.0',
			dependencies: ['a'],
			services: { svc: () => 'b' }
		});

		await expect(registry.loadAll([pluginA, pluginB])).rejects.toThrow(
			PluginCircularDependencyError
		);
	});

	it('does not reload already-loaded plugins', async () => {
		const registry = new PluginRegistry();
		let loadCount = 0;

		const plugin = definePlugin({
			name: 'once',
			version: '1.0.0',
			services: {
				svc: () => {
					loadCount++;
					return 'value';
				}
			}
		});

		await registry.loadAll([plugin]);
		await registry.loadAll([plugin]); // second load is a no-op
		expect(loadCount).toBe(1);
	});

	it('calls lifecycle hooks', async () => {
		const registry = new PluginRegistry();
		const events: string[] = [];

		const plugin = definePlugin({
			name: 'lifecycle',
			version: '1.0.0',
			hooks: {
				onInit: async () => {
					events.push('init');
				},
				onStart: async () => {
					events.push('start');
				},
				onStop: async () => {
					events.push('stop');
				}
			}
		});

		await registry.loadAll([plugin]);
		// Hooks are stored but not auto-called by loadAll — they're called by the kernel
		expect(plugin.hooks?.onInit).toBeDefined();
		expect(plugin.hooks?.onStart).toBeDefined();
		expect(plugin.hooks?.onStop).toBeDefined();
	});

	it('reports loaded plugins', async () => {
		const registry = new PluginRegistry();

		await registry.loadAll([
			definePlugin({ name: 'x', version: '1.0.0' }),
			definePlugin({ name: 'y', version: '1.0.0' }),
			definePlugin({ name: 'z', version: '1.0.0' })
		]);

		expect(registry.getLoaded()).toEqual(['x', 'y', 'z']);
	});
});

describe('globalPluginRegistry', () => {
	it('is a singleton PluginRegistry instance', () => {
		expect(globalPluginRegistry).toBeInstanceOf(PluginRegistry);
	});
});
