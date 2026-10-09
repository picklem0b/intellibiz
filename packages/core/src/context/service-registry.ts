import type { IntellibizStore } from './store.js';

/**
 * A factory that produces a per-context service instance from the active
 * ALS store. Used by packages such as `@intellibiz/db` to attach themselves to
 * every specialized execution context without creating a dependency from
 * `@intellibiz/core` back onto them.
 */
export type ContextServiceFactory = (
	store: Readonly<IntellibizStore>
) => unknown;

const factories = new Map<string, ContextServiceFactory>();

/**
 * Registers a service that will be attached to every specialized context
 * (req / action / event / job / task / socket) and every event envelope.
 *
 * Packages call this once at import time. The service is namespaced by the keys
 * used in the `SharedServices` module augmentation.
 */
export function registerContextService(
	name: string,
	factory: ContextServiceFactory
): void {
	factories.set(name, factory);
}

export function getContextServiceFactory(
	name: string
): ContextServiceFactory | undefined {
	return factories.get(name);
}

/** Instantiates every registered service for the given store. */
export function buildRegisteredServices(
	store: Readonly<IntellibizStore>
): Record<string, unknown> {
	const services: Record<string, unknown> = {};
	for (const [name, factory] of factories) {
		services[name] = factory(store);
	}
	return services;
}

/** Removes all registered context services. Used in tests. */
export function clearContextServices(): void {
	factories.clear();
}
