import type { IntellibizStore } from './store.js';
import type { ContextServices } from './types.js';
import type { SharedServices } from '../index.js';
import { createLogger } from '../logger.js';
import { emit } from '../events/bus.js';
import { buildRegisteredServices } from './service-registry.js';

/**
 * Builds the kernel-provided service surface for a context: the context-aware
 * `log` and the bound `emit`. Registered package services (e.g. `db`) are
 * merged on top.
 *
 * Called by the action engine, the HTTP kernel middleware, and the event bus
 * so that `req`, `action`, and `event` all expose the same base services.
 */
export function buildBaseContext(
	store: Readonly<IntellibizStore>
): ContextServices & SharedServices {
	return {
		log: createLogger({
			traceId: store.traceId,
			tenantId: store.tenantId,
			userId: store.userId,
			role: store.role,
			origin: store.origin
		}),
		emit: emit as ContextServices['emit'],
		...buildRegisteredServices(store)
	} as unknown as ContextServices & SharedServices;
}
