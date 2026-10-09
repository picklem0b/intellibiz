/**
 * Hello World — the smallest useful Intellibiz service.
 *
 * Demonstrates the four things every app needs on day one:
 *  1. HTTP routes with a fully typed `req` context (`http.get` / `http.post`)
 *  2. A validated business action mounted directly onto a route (`defineAction`)
 *  3. Typed events (`on` / `action.emit`) with the context logger
 *  4. Kernel services on the context — `req.log`, `req.emit`, `action.log`
 *
 * Run it:
 *   pnpm --filter @intellibiz-examples/hello-world dev
 *
 *   curl localhost:3000/health
 *   curl -X POST localhost:3000/greet -H 'content-type: application/json' \
 *        -d '{"name":"Ada","enthusiasm":3}'
 */
import { getElapsedMs, http, on, defineAction } from 'intellibiz';
import { z } from 'zod';

// ─── Typed events ─────────────────────────────────────────────────────────────
// The event registry lives on `@intellibiz/core`; augmenting it is what makes
// `emit`/`on` fully typed (an unknown event name is a compile error).
declare module '@intellibiz/core' {
	interface IntellibizEvents {
		'hello.greeted': { name: string; at: string };
	}
}

// Listeners are registered once at boot — never inside a request handler.
on('hello.greeted', async (event) => {
	// `event.log` is bound to the emitting trace/tenant/user.
	event.log.info('greeting delivered', {
		name: event.payload.name,
		deliveryAttempt: event.deliveryAttempt
	});
});

// ─── A validated action ───────────────────────────────────────────────────────
const GreetInput = z.object({
	name: z.string().min(1).max(80),
	enthusiasm: z.number().int().min(0).max(5).default(1)
});

export const greet = defineAction({
	input: GreetInput,
	handler: async (action) => {
		// `action.data` is fully inferred from the Zod schema above.
		const { name, enthusiasm } = action.data;
		const message = `Hello, ${name}${'!'.repeat(enthusiasm)}`;

		// `action.emit` inherits the action's ALS context, so the trace ID and
		// tenant flow into the listener automatically.
		const delivery = await action.emit('hello.greeted', {
			name,
			at: new Date().toISOString()
		});

		action.log.debug('greet action completed', { name, delivered: delivery.delivered });

		return {
			message,
			traceId: action.traceId,
			listenersReached: delivery.delivered
		};
	}
});

// ─── Routes ───────────────────────────────────────────────────────────────────
http.get('/', () => ({
	service: 'intellibiz-hello-world',
	routes: ['GET /health', 'GET /greet', 'POST /greet']
}));

http.get('/health', (req) => ({
	status: 'ok',
	tenantId: req.tenantId,
	userId: req.userId,
	traceId: req.traceId,
	// hrtime-based latency measurement, straight off the context.
	elapsedMs: Number(getElapsedMs().toFixed(3))
}));

// Actions mount directly — the router validates `req.body` and builds the
// ActionContext for you. No wrapper function required.
http.post('/greet', greet);

http.get('/greet', () => ({
	hint: 'POST a JSON body, e.g. {"name":"Ada","enthusiasm":3}'
}));

// ─── Boot ─────────────────────────────────────────────────────────────────────
const port = Number(process.env['PORT'] ?? 3000);
http.listen(port, () => {
	console.log(`hello-world listening on http://localhost:${port}`);
});
