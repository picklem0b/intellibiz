import type { ZodTypeAny } from 'zod';
import type { ApplicationContext } from './context/types.js';

// ─── Plugin Lifecycle Hooks ───────────────────────────────────────────────────

export interface PluginHooks {
	/**
	 * Called after all plugins are loaded and the DI container is ready,
	 * but before the HTTP server accepts connections.
	 * Use for: establishing connections, registering event listeners, validating credentials.
	 */
	onInit?: (app: ApplicationContext) => Promise<void>;

	/**
	 * Called when the HTTP server is ready and accepting traffic.
	 */
	onStart?: (app: ApplicationContext) => Promise<void>;

	/**
	 * Called on graceful shutdown before the process exits.
	 * Use for: draining connections, flushing buffers, closing clients.
	 */
	onStop?: (app: ApplicationContext) => Promise<void>;
}

// ─── Plugin Definition ────────────────────────────────────────────────────────

export interface PluginDefinition {
	/**
	 * Unique plugin name. Used as the service namespace prefix.
	 * Convention: '{scope}-{noun}', e.g. 'stripe-payment', 'redis-cache'.
	 */
	readonly name: string;
	readonly version: string;

	/**
	 * Service keys from the DI container this plugin needs.
	 * The plugin is sandboxed — it cannot access services not declared here.
	 */
	readonly dependencies?: string[];

	/**
	 * Services this plugin contributes to the DI container.
	 * Keys are namespaced: '{name}.{key}', e.g. 'stripe-payment.provider'.
	 */
	readonly services?: Record<
		string,
		(deps: Record<string, unknown>) => unknown
	>;

	/**
	 * Lifecycle hooks for initialization, startup, and shutdown.
	 */
	readonly hooks?: PluginHooks;

	/**
	 * Zod schema extending intellibiz.config.ts with plugin-specific flags.
	 * Merged with the core schema at boot — validation fails if the user's config
	 * does not satisfy the plugin's schema.
	 */
	readonly configSchema?: ZodTypeAny;

	/**
	 * Human-readable description of what this plugin provides.
	 */
	readonly description?: string;
}

// ─── definePlugin ─────────────────────────────────────────────────────────────

/**
 * Defines an Intellibiz plugin (RFC-004).
 *
 * A plugin is a self-contained module that contributes services to the DI container,
 * hooks into lifecycle events, and optionally extends the config schema.
 *
 * @example
 * export default definePlugin({
 *   name: 'stripe-payment',
 *   version: '1.0.0',
 *   description: 'Stripe payment provider for @intellibiz/commerce',
 *   dependencies: ['config', 'log'],
 *   services: {
 *     'payment.provider': (deps) => new StripeProvider(deps['config']),
 *   },
 *   hooks: {
 *     onInit: async (app) => {
 *       app.log.info('Stripe plugin initialized')
 *       app.register('stripe.ready', true)
 *     },
 *     onStop: async (app) => {
 *       await app.get<StripeProvider>('stripe-payment.payment.provider').disconnect()
 *     },
 *   },
 *   configSchema: z.object({
 *     stripe: z.object({
 *       secretKey: z.string().startsWith('sk_'),
 *       webhookSecret: z.string().startsWith('whsec_'),
 *     }),
 *   }),
 * })
 */
export function definePlugin(definition: PluginDefinition): PluginDefinition {
	// Freeze the definition to prevent mutation after registration
	return Object.freeze({
		...definition,
		services: definition.services ? { ...definition.services } : undefined,
		hooks: definition.hooks ? { ...definition.hooks } : undefined,
		dependencies: definition.dependencies
			? [...definition.dependencies]
			: undefined
	});
}
