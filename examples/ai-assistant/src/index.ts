/**
 * AI Assistant — how a *plugin* extends an Intellibiz application.
 *
 * The `anthropic-ai` plugin contributes a single service (`completion`) to the
 * DI container. The `askAssistant` action consumes it by key. Because the key
 * is namespaced (`anthropic-ai.completion`) and the plugin declares its own
 * dependencies, one plugin can never reach into another's internals.
 *
 * Swap the stub `completion` implementation for a real SDK call and nothing
 * else in this file changes.
 *
 * Run it:
 *   pnpm --filter @intellibiz-examples/ai-assistant dev
 */
import { definePlugin, defineAction, globalPluginRegistry } from 'intellibiz';
import type { ApplicationContext } from 'intellibiz';
import { withContext } from '@intellibiz/testing';
import { z } from 'zod';

declare module '@intellibiz/core' {
	interface IntellibizEvents {
		'ai.completion.ready': { model: string; prompt: string; tokens: number };
	}
}

// ─── The provider contract the plugin will satisfy ────────────────────────────
interface CompletionRequest {
	prompt: string;
	maxTokens: number;
}

interface CompletionResult {
	model: string;
	text: string;
	tokens: number;
}

type CompletionFn = (request: CompletionRequest) => Promise<CompletionResult>;

// ─── The plugin ───────────────────────────────────────────────────────────────
const anthropicPlugin = definePlugin({
	name: 'anthropic-ai',
	version: '1.0.0',
	description: 'Anthropic Claude provider for Intellibiz',
	dependencies: [],
	services: {
		completion: (): CompletionFn => {
			// Stand-in for `new Anthropic({ apiKey }).messages.create(...)`.
			return async (request: CompletionRequest): Promise<CompletionResult> => {
				const text =
					`You asked: "${request.prompt}". ` +
					`This is a deterministic stub standing in for Claude.`;
				return {
					model: 'claude-sonnet-4-5',
					text,
					tokens: Math.ceil(text.length / 4)
				};
			};
		}
	},
	hooks: {
		onInit: async (app: ApplicationContext) => {
			app.log.log('[anthropic-ai] plugin initialised');
		}
	}
});

// ─── Boot: load the plugin and expose its DI container ────────────────────────
await globalPluginRegistry.loadAll([anthropicPlugin]);

const container = globalPluginRegistry.container_;
const complete = container.get<CompletionFn>('anthropic-ai.completion');

// Lifecycle hooks are called by the runtime after all plugins load. This is the
// minimal ApplicationContext a boot script would hand them.
const app: ApplicationContext = {
	log: console,
	register: (name, value) => {
		if (!container.has(name)) container.register(name, value);
	},
	get: <T>(name: string) => container.get<T>(name)
};

for (const plugin of [anthropicPlugin]) {
	await plugin.hooks?.onInit?.(app);
}

// ─── The action that consumes the service ─────────────────────────────────────
const AskInput = z.object({
	prompt: z.string().min(1).max(4000),
	maxTokens: z.number().int().positive().max(8192).default(256)
});

export const askAssistant = defineAction({
	input: AskInput,
	handler: async (action) => {
		action.log.debug('dispatching completion', { maxTokens: action.data.maxTokens });

		const result = await complete({
			prompt: action.data.prompt,
			maxTokens: action.data.maxTokens
		});

		await action.emit('ai.completion.ready', {
			model: result.model,
			prompt: action.data.prompt,
			tokens: result.tokens
		});

		return result;
	}
});

// ─── Demo ─────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
	console.log(`Plugins loaded: ${globalPluginRegistry.getLoaded().join(', ')}`);
	console.log(
		`Service keys: ${['anthropic-ai.completion', 'completion']
			.filter(key => container.has(key))
			.join(', ')}\n`
	);

	const result = await withContext(
		{ tenantId: 'org_acme', userId: 'usr_ada', role: 'member' },
		() => askAssistant({ prompt: 'Summarise our Q3 numbers', maxTokens: 512 })
	);

	console.log(`model   ${result.model}`);
	console.log(`tokens  ${result.tokens}`);
	console.log(`answer  ${result.text}`);
}

await main();
