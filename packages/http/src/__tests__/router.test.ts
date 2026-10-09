import { describe, it, expect, afterEach } from 'vitest';
import { z } from 'zod';
import { defineAction, IntellibizError, on, off } from '@intellibiz/core';
import { IntellibizRouter } from '../router.js';

// Register a test event key for the emit test.
declare module '@intellibiz/core' {
	interface IntellibizEvents {
		'test.http': { value: number };
	}
}

async function post(
	router: IntellibizRouter,
	path: string,
	body: unknown
): Promise<Response> {
	return router.fetch(
		new Request(`http://localhost${path}`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body)
		})
	);
}

async function get(
	router: IntellibizRouter,
	path: string,
	headers: Record<string, string> = {}
): Promise<Response> {
	return router.fetch(new Request(`http://localhost${path}`, { headers }));
}

describe('http router — direct action mounting', () => {
	it('mounts a schema action and calls it with req.body', async () => {
		const Checkout = z.object({ orderId: z.string().min(1) });
		const checkout = defineAction({
			input: Checkout,
			handler: async action => ({
				orderId: action.data.orderId,
				tenantId: action.tenantId,
				hasLog: typeof action.log.info === 'function'
			})
		});

		const router = new IntellibizRouter();
		router.post('/api/checkout', checkout);

		const res = await post(router, '/api/checkout', { orderId: 'ord_1' });
		expect(res.status).toBe(201);
		await expect(res.json()).resolves.toEqual({
			orderId: 'ord_1',
			tenantId: 'system',
			hasLog: true
		});
	});

	it('returns 422 when action input fails validation', async () => {
		const checkout = defineAction({
			input: z.object({ orderId: z.string() }),
			handler: async action => action.data
		});

		const router = new IntellibizRouter();
		router.post('/api/checkout', checkout);

		const res = await post(router, '/api/checkout', { orderId: 123 });
		expect(res.status).toBe(422);
		await expect(res.json()).resolves.toMatchObject({
			error: 'ACTION_VALIDATION_ERROR'
		});
	});

	it('mounts an inline (schema-less) action', async () => {
		const ping = defineAction(async action => ({ data: action.data }));
		const router = new IntellibizRouter();
		router.post('/api/ping', ping);

		const res = await post(router, '/api/ping', { hello: true });
		expect(res.status).toBe(201);
		await expect(res.json()).resolves.toEqual({ data: { hello: true } });
	});

	it('still supports plain handlers receiving the request context', async () => {
		const router = new IntellibizRouter();
		router.get('/plain', async req => ({ url: req.url }));

		const res = await get(router, '/plain');
		expect(res.status).toBe(200);
		const json = (await res.json()) as { url: string };
		expect(json.url).toContain('/plain');
	});
});

describe('http router — response inference and errors', () => {
	it('returns 204 for undefined and null results', async () => {
		const router = new IntellibizRouter();
		router.get('/none', async () => undefined);
		router.get('/null', async () => null);

		expect((await get(router, '/none')).status).toBe(204);
		expect((await get(router, '/null')).status).toBe(204);
	});

	it('returns JSON for objects and text for strings', async () => {
		const router = new IntellibizRouter();
		router.get('/obj', async () => ({ a: 1 }));
		router.get('/text', async () => 'hello');

		const obj = await get(router, '/obj');
		expect(obj.status).toBe(200);
		await expect(obj.json()).resolves.toEqual({ a: 1 });

		const text = await get(router, '/text');
		expect(text.status).toBe(200);
		expect(await text.text()).toBe('hello');
	});

	it('maps IntellibizError to its status and structured body', async () => {
		const router = new IntellibizRouter();
		router.get('/teapot', async () => {
			throw new IntellibizError({
				code: 'TEAPOT',
				message: 'short and stout',
				status: 418
			});
		});

		const res = await get(router, '/teapot');
		expect(res.status).toBe(418);
		await expect(res.json()).resolves.toEqual({
			error: 'TEAPOT',
			message: 'short and stout',
			status: 418
		});
	});

	it('applies req.status() and req.header() overrides', async () => {
		const router = new IntellibizRouter();
		router.post('/accepted', async req => {
			req.status(202);
			req.header('X-Trace-Id', req.traceId);
			return { queued: true };
		});

		const res = await post(router, '/accepted', {});
		expect(res.status).toBe(202);
		expect(res.headers.get('x-trace-id')).toBeTruthy();
	});
});

describe('http router — context services', () => {
	afterEach(() => off('test.http'));

	it('exposes log and emit on req', async () => {
		const router = new IntellibizRouter();
		router.get('/ctx', async req => ({
			hasLog: typeof req.log.info === 'function',
			hasEmit: typeof req.emit === 'function',
			hasLevel: typeof req.log.level === 'string'
		}));

		const res = await get(router, '/ctx');
		await expect(res.json()).resolves.toEqual({
			hasLog: true,
			hasEmit: true,
			hasLevel: true
		});
	});

	it('req.emit delivers to listeners within the request context', async () => {
		const seen: number[] = [];
		let tenant = '';
		on('test.http', async event => {
			seen.push(event.payload.value);
			tenant = event.tenantId;
		});

		const router = new IntellibizRouter();
		router.post('/emit', async req => {
			const result = await req.emit('test.http', { value: 7 });
			return { delivered: result.delivered };
		});

		const res = await post(router, '/emit', {});
		await expect(res.json()).resolves.toEqual({ delivered: 1 });
		expect(seen).toEqual([7]);
		expect(tenant).toBe('system');
	});

	it('resolves tenant from the x-tenant-id header', async () => {
		const router = new IntellibizRouter();
		router.get('/tenant', async req => ({ tenantId: req.tenantId }));

		const res = await get(router, '/tenant', { 'x-tenant-id': 'org_42' });
		await expect(res.json()).resolves.toEqual({ tenantId: 'org_42' });
	});

	it('resolves tenant from a subdomain host', async () => {
		const router = new IntellibizRouter();
		router.get('/tenant', async req => ({ tenantId: req.tenantId }));

		const res = await router.fetch(new Request('http://acme.example.com/tenant'));
		await expect(res.json()).resolves.toEqual({ tenantId: 'acme' });
	});

	it('does not treat a bare host or an IP address as a tenant', async () => {
		const router = new IntellibizRouter();
		router.get('/tenant', async req => ({ tenantId: req.tenantId }));

		const bare = await router.fetch(new Request('http://example.com/tenant'));
		await expect(bare.json()).resolves.toEqual({ tenantId: 'system' });

		const ip = await router.fetch(new Request('http://127.0.0.1/tenant'));
		await expect(ip.json()).resolves.toEqual({ tenantId: 'system' });
	});

	it('exposes the raw body alongside the parsed JSON', async () => {
		const router = new IntellibizRouter();
		router.post('/hook', async req => ({
			raw: req.rawBody,
			parsed: req.body
		}));

		const body = JSON.stringify({ event: 'payment.succeeded', amount: '9.99' });
		const res = await router.fetch(
			new Request('http://localhost/hook', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body
			})
		);

		await expect(res.json()).resolves.toEqual({
			raw: body,
			parsed: { event: 'payment.succeeded', amount: '9.99' }
		});
	});
});
