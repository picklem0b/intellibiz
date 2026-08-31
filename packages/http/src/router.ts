import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import {
	runWithContext,
	type IntellibizStore,
	IntellibizError
} from '@intellibiz/core';
import type { RequestContext } from '@intellibiz/core';
import { kernelMiddleware, type MiddlewareOptions } from './middleware.js';

type Handler = (req: RequestContext) => Promise<unknown> | unknown;

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

	get(path: string, handler: Handler): this {
		this.app.get(`${this.prefix}${path}`, wrapHandler(handler, 'GET'));
		return this;
	}

	post(path: string, handler: Handler): this {
		this.app.post(`${this.prefix}${path}`, wrapHandler(handler, 'POST'));
		return this;
	}

	put(path: string, handler: Handler): this {
		this.app.put(`${this.prefix}${path}`, wrapHandler(handler, 'PUT'));
		return this;
	}

	patch(path: string, handler: Handler): this {
		this.app.patch(`${this.prefix}${path}`, wrapHandler(handler, 'PATCH'));
		return this;
	}

	delete(path: string, handler: Handler): this {
		this.app.delete(
			`${this.prefix}${path}`,
			wrapHandler(handler, 'DELETE')
		);
		return this;
	}
}

// ─── Handler Wrapper ─────────────────────────────────────────────────────────

function wrapHandler(handler: Handler, method: string) {
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

		let body: unknown = undefined;
		if (['POST', 'PUT', 'PATCH'].includes(method)) {
			try {
				body = await c.req.json();
			} catch {
				body = undefined;
			}
		}

		let _statusOverride: number | null = null;
		const _responseHeaders: Record<string, string> = {};

		const reqCtx: RequestContext = {
			...store,
			body,
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

		try {
			const result = await runWithContext(store, async () => handler(reqCtx));

			// Apply custom headers
			for (const [k, v] of Object.entries(_responseHeaders)) {
				c.header(k, v);
			}

			if (_statusOverride !== null) {
				return c.json(result, _statusOverride as any);
			}

			return buildResponse(c, result, method);
		} catch (err) {
			if (err instanceof IntellibizError) {
				return c.json(err.toJSON(), err.status as any);
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
				500 as const
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
				return c.json(err.toJSON(), err.status as any);
			}
			return c.json(
				{
					error: 'INTERNAL_ERROR',
					message: 'An unexpected error occurred.'
				},
				500 as const
			);
		});
	}

	get(path: string, handler: Handler): this {
		this.app.get(path, wrapHandler(handler, 'GET'));
		return this;
	}

	post(path: string, handler: Handler): this {
		this.app.post(path, wrapHandler(handler, 'POST'));
		return this;
	}

	put(path: string, handler: Handler): this {
		this.app.put(path, wrapHandler(handler, 'PUT'));
		return this;
	}

	patch(path: string, handler: Handler): this {
		this.app.patch(path, wrapHandler(handler, 'PATCH'));
		return this;
	}

	delete(path: string, handler: Handler): this {
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

	private _server: ReturnType<typeof serve> | null = null;
	private _activeConnections = new Set<ReturnType<typeof import('node:net').createConnection>>();

	/**
	 * Starts the server with graceful shutdown support.
	 * Listens for SIGTERM/SIGINT and drains in-flight requests.
	 */
	listen(port: number, callback?: () => void): void {
		this._server = serve({ fetch: this.app.fetch, port }, () => {
			callback?.();
		});

		// Track active connections for graceful shutdown
		this._server.server.on('connection', (conn) => {
			this._activeConnections.add(conn);
			conn.on('close', () => this._activeConnections.delete(conn));
		});

		// Graceful shutdown on SIGTERM/SIGINT
		const shutdown = async (signal: string) => {
			console.log(`\n  Received ${signal}. Shutting down gracefully...`);
			console.log('  Waiting for in-flight requests to complete...');

			// Stop accepting new connections
			this._server?.close();

			// Wait up to 30s for in-flight requests
			const deadline = Date.now() + 30_000;
			while (this._activeConnections.size > 0 && Date.now() < deadline) {
				await new Promise((r) => setTimeout(r, 100));
			}

			if (this._activeConnections.size > 0) {
				console.log(`  Force-closing ${this._activeConnections.size} remaining connections`);
				for (const conn of this._activeConnections) {
					conn.destroy();
				}
			}

			console.log('  Server stopped.');
			process.exit(0);
		};

		process.on('SIGTERM', () => shutdown('SIGTERM'));
		process.on('SIGINT', () => shutdown('SIGINT'));
	}

	/** Exposes the raw Hono fetch handler for testing. */
	get fetch() {
		return this.app.fetch;
	}
}
