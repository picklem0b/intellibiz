import type { PluginDefinition } from '../define-plugin.js';
import { PluginLoadError, PluginCircularDependencyError } from '../errors.js';

// ─── DI Container ─────────────────────────────────────────────────────────────

/**
 * The Dependency Injection container for the Intellibiz plugin system.
 *
 * Plugins register services they provide. Other plugins access services they declared
 * in their `dependencies` array. The container enforces that a plugin cannot access
 * a service it did not declare — no cross-plugin access without explicit declaration.
 *
 * Per RFC-004 §Sandboxing: services are namespaced to prevent collisions.
 * A plugin 'stripe-payment' registering 'provider' gets key 'stripe-payment.provider'.
 */
export class DIContainer {
	private readonly services = new Map<string, unknown>();

	register(key: string, value: unknown): void {
		if (this.services.has(key)) {
			throw new Error(
				`DIContainer: service '${key}' is already registered. Use a unique key.`
			);
		}
		this.services.set(key, value);
	}

	get<T>(key: string): T {
		if (!this.services.has(key)) {
			throw new Error(
				`DIContainer: service '${key}' is not registered. Declare it in your plugin's 'dependencies' array.`
			);
		}
		return this.services.get(key) as T;
	}

	has(key: string): boolean {
		return this.services.has(key);
	}

	/** Returns a sandboxed view of the container restricted to declared dependencies. */
	sandboxedView(allowedKeys: string[]): Record<string, unknown> {
		const view: Record<string, unknown> = {};
		for (const key of allowedKeys) {
			if (this.services.has(key)) {
				view[key] = this.services.get(key);
			}
		}
		return view;
	}
}

// ─── Circular Dependency Detection ───────────────────────────────────────────

function detectCircular(plugins: PluginDefinition[]): void {
	const depMap = new Map<string, string[]>();
	for (const plugin of plugins) {
		depMap.set(plugin.name, plugin.dependencies ?? []);
	}

	function dfs(name: string, path: string[], visited: Set<string>): void {
		if (path.includes(name)) {
			const cycle = [...path.slice(path.indexOf(name)), name];
			throw new PluginCircularDependencyError(cycle);
		}
		if (visited.has(name)) return;
		visited.add(name);
		for (const dep of depMap.get(name) ?? []) {
			dfs(dep, [...path, name], visited);
		}
	}

	for (const plugin of plugins) {
		dfs(plugin.name, [], new Set());
	}
}

// ─── Plugin Registry ──────────────────────────────────────────────────────────

export class PluginRegistry {
	private readonly container = new DIContainer();
	private readonly loaded: string[] = [];

	/**
	 * Loads all plugins in declaration order.
	 *
	 * Per RFC-004 §Implementation Notes:
	 * - Core services initialize first, then plugins in `plugins` array order
	 * - Service names are namespaced: '{pluginName}.{serviceName}'
	 * - Circular dependencies are detected and throw before any plugin initializes
	 * - configSchema from each plugin is merged with the core schema (caller's responsibility)
	 */
	async loadAll(plugins: PluginDefinition[]): Promise<void> {
		detectCircular(plugins);

		for (const plugin of plugins) {
			await this.load(plugin);
		}
	}

	private async load(plugin: PluginDefinition): Promise<void> {
		if (this.loaded.includes(plugin.name)) return;

		// Ensure all declared dependencies are present
		for (const dep of plugin.dependencies ?? []) {
			if (!this.container.has(dep)) {
				throw new PluginLoadError(
					plugin.name,
					`required dependency '${dep}' is not registered. Check that the plugin providing '${dep}' is loaded first.`
				);
			}
		}

		// Build sandboxed deps view
		const deps = this.container.sandboxedView(plugin.dependencies ?? []);

		// Register services with namespaced keys
		for (const [serviceName, factory] of Object.entries(
			plugin.services ?? {}
		)) {
			const key = `${plugin.name}.${serviceName}`;
			try {
				const instance = factory(deps);
				this.container.register(key, instance);
				// Also register without namespace for the common 'payment.provider' pattern
				if (!this.container.has(serviceName)) {
					this.container.register(serviceName, instance);
				}
			} catch (err) {
				throw new PluginLoadError(
					plugin.name,
					`service factory '${serviceName}' threw: ${err instanceof Error ? err.message : String(err)}`
				);
			}
		}

		this.loaded.push(plugin.name);
	}

	get container_(): DIContainer {
		return this.container;
	}

	getLoaded(): string[] {
		return [...this.loaded];
	}
}

export const globalPluginRegistry = new PluginRegistry();
