import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import {
	runWithContext,
	buildBaseContext,
	isAction,
	type IntellibizStore,
	type Action,
	IntellibizError
} from '@intellibiz/core';
import type { RequestContext } from '@intellibiz/core';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { kernelMiddleware, type MiddlewareOptions } from './middleware.js';

type Handler = (req: RequestContext) => Promise<unknown> | unknown;

/**
 * A route handler is either a plain function receiving the request context, or
 * an action returned by `defineAction`. Actions are mounted directly and are
 * invoked with `req.body`; the action builds its own context from ALS.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- actions are
// accepted regardless of their input type; the router hands them `req.body`.
type RouteHandler = Handler | Action<any, unknown>;

// ─── Response Inference ───────────────────────────────────────────────────────

/**
 * Infers the HTTP response from the handler return value.
 *
 * Per docs/api/http.md §Response Inference:
 * | Return Value         | HTTP Response                     |
 * | object/array         | 200 OK or 201 Created — JSON      |
 * | string               | 200 OK — text/plain               |
 * | undefined/null       | 204 No Content                    |
 * | thrown IntellibizError | error.status + structured JSON  |
 * | thrown Error         | 500 Internal Server Error         |
 */
function buildResponse(c: any, result: unknown, method: string): Response {
	if (result === undefined || result === null) return c.body(null, 204);
	if (typeof result === 'string') return c.text(result, 200);
	const status = method === 'POST' ? 201 : 200;
	return c.json(result, status);
}

// ─── Route Group ─────────────────────────────────────────────────────────────

export interface RouteGroupOptions {
	middleware?: string[];
}

class RouteGroup {
	constructor(
		private readonly app: Hono,
		private readonly prefix: string
	) {}

	get(path: string, handler: Handler): this;
	get(path: string, action: Action<any, unknown>): this;
	get(path: string, handler: RouteHandler): this {
		this.app.get(`${this.prefix}${path}`, wrapHandler(handler, 'GET'));
		return this;
	}

	post(path: string, handler: Handler): this;
	post(path: string, action: Action<any, unknown>): this;
	post(path: string, handler: RouteHandler): this {
		this.app.post(`${this.prefix}${path}`, wrapHandler(handler, 'POST'));
		return this;
	}

	put(path: string, handler: Handler): this;
	put(path: string, action: Action<any, unknown>): this;
	put(path: string, handler: RouteHandler): this {
		this.app.put(`${this.prefix}${path}`, wrapHandler(handler, 'PUT'));
		return this;
	}

	patch(path: string, handler: Handler): this;
	patch(path: string, action: Action<any, unknown>): this;
	patch(path: string, handler: RouteHandler): this {
		this.app.patch(`${this.prefix}${path}`, wrapHandler(handler, 'PATCH'));
		return this;
	}

	delete(path: string, handler: Handler): this;
	delete(path: string, action: Action<any, unknown>): this;
	delete(path: string, handler: RouteHandler): this {
		this.app.delete(
			`${this.prefix}${path}`,
			wrapHandler(handler, 'DELETE')
		);
		return this;
	}
}

// ─── Handler Wrapper ─────────────────────────────────────────────────────────

function wrapHandler(handler: RouteHandler, method: string) {
	return async (c: any): Promise<Response> => {
		const store: IntellibizStore = c.get('intellibizStore');

		// Runtime guard — should never fire if kernelMiddleware is mounted
		if (!store) {
			return c.json(
				{
					error: 'KERNEL_NOT_INITIALIZED',
					message: 'Kernel middleware not mounted.'
				},
				500
			);
		}

		// Read the body once as text so handlers get both the parsed JSON and the
		// exact bytes that were sent. Webhook signature verification hashes the
		// raw bytes — re-serializing parsed JSON would invalidate the HMAC.
		let rawBody = '';
		let body: unknown = undefined;
		if (['POST', 'PUT', 'PATCH'].includes(method)) {
			try {
				rawBody = await c.req.text();
			} catch {
				rawBody = '';
			}
			if (rawBody.length > 0) {
				try {
					body = JSON.parse(rawBody);
				} catch {
					body = undefined;
				}
			}
		}

		let _statusOverride: number | null = null;
		const _responseHeaders: Record<string, string> = {};

		const reqCtx: RequestContext = {
			...buildBaseContext(store),
			...store,
			body,
			rawBody,
			headers: Object.fromEntries(c.req.raw.headers.entries()),
			params: c.req.param(),
			query: Object.fromEntries(
				new URL(c.req.url).searchParams.entries()
			),
			ip:
				c.req.header('x-forwarded-for') ??
				c.env?.remoteAddr ??
				'0.0.0.0',
			method,
			url: c.req.url,
			status(code: number) {
				_statusOverride = code;
			},
			header(key: string, value: string) {
				_responseHeaders[key] = value;
			}
		};

		// Actions are mounted directly — they receive req.body and build their own
		// ActionContext from the ALS store set above.
		const action = isAction(handler)
			? (handler as Action<any, unknown>)
			: null;
		const plainHandler = action === null ? (handler as Handler) : null;

		try {
			const result = await runWithContext(store, async () =>
				action !== null ? await action(reqCtx.body) : await plainHandler!(reqCtx)
			);

			// Apply custom headers
			for (const [k, v] of Object.entries(_responseHeaders)) {
				c.header(k, v);
			}

			if (_statusOverride !== null) {
				return c.json(result, _statusOverride);
			}

			return buildResponse(c, result, method);
		} catch (err) {
			if (err instanceof IntellibizError) {
				return c.json(err.toJSON(), err.status);
			}
			// Domain error factory objects (plain errors with .code and .status)
			if (err instanceof Error && 'code' in err && 'status' in err) {
				const e = err as Error & {
					code: string;
					status: number;
					details?: unknown;
				};
				return c.json(
					{
						error: e.code,
						message: e.message,
						...(e.details ? { details: e.details } : {})
					},
					e.status
				);
			}
			console.error('[intellibiz:http] unhandled error', err);
			return c.json(
				{
					error: 'INTERNAL_ERROR',
					message: 'An unexpected error occurred.'
				},
				500
			);
		}
	};
}

// ─── HTTP Router ─────────────────────────────────────────────────────────────

export class IntellibizRouter {
	private readonly app: Hono;

	constructor(private readonly opts: MiddlewareOptions = {}) {
		this.app = new Hono();
		this.app.use('*', kernelMiddleware(opts));

		// Global error handler
		this.app.onError((err, c) => {
			if (err instanceof IntellibizError) {
				return c.json(err.toJSON(), err.status as ContentfulStatusCode);
			}
			return c.json(
				{
					error: 'INTERNAL_ERROR',
					message: 'An unexpected error occurred.'
				},
				500
			);
		});
	}

	get(path: string, handler: Handler): this;
	get(path: string, action: Action<any, unknown>): this;
	get(path: string, handler: RouteHandler): this {
		this.app.get(path, wrapHandler(handler, 'GET'));
		return this;
	}

	post(path: string, handler: Handler): this;
	post(path: string, action: Action<any, unknown>): this;
	post(path: string, handler: RouteHandler): this {
		this.app.post(path, wrapHandler(handler, 'POST'));
		return this;
	}

	put(path: string, handler: Handler): this;
	put(path: string, action: Action<any, unknown>): this;
	put(path: string, handler: RouteHandler): this {
		this.app.put(path, wrapHandler(handler, 'PUT'));
		return this;
	}

	patch(path: string, handler: Handler): this;
	patch(path: string, action: Action<any, unknown>): this;
	patch(path: string, handler: RouteHandler): this {
		this.app.patch(path, wrapHandler(handler, 'PATCH'));
		return this;
	}

	delete(path: string, handler: Handler): this;
	delete(path: string, action: Action<any, unknown>): this;
	delete(path: string, handler: RouteHandler): this {
		this.app.delete(path, wrapHandler(handler, 'DELETE'));
		return this;
	}

	/**
	 * Creates a route group with a shared prefix.
	 *
	 * @example
	 * const v1 = http.group('/api/v1')
	 * v1.get('/orders', async (req) => { ... })
	 */
	group(prefix: string, _opts?: RouteGroupOptions): RouteGroup {
		return new RouteGroup(this.app, prefix);
	}

	/**
	 * Starts the server. Uses @hono/node-server on Node.js.
	 */
	listen(port: number, callback?: () => void): void {
		serve({ fetch: this.app.fetch, port }, () => {
			callback?.();
		});
	}

	/** Exposes the raw Hono fetch handler for testing. */
	get fetch() {
		return this.app.fetch;
	}
}
