/**
 * Multi-Tenancy — isolation you can actually see.
 *
 * A tenant is resolved from the `x-tenant-id` header into the ALS context. From
 * there, two things happen automatically:
 *
 *   • `sql` tagged templates are rewritten by the query planner to inject
 *     `org_id = '<tenant>' AND deleted_at IS NULL`
 *   • `req.db` / `req.tenantId` expose the isolated view
 *
 * The escape hatch (`req.db.sudo()`) is deliberately loud: it bypasses the
 * filters and writes a GOVERNANCE_SUDO_ACCESS record to the governance log.
 *
 * This file is a self-contained script: it boots the router and drives it with
 * `http.fetch()`, so you get a printed transcript instead of a server to poke.
 *
 * Run it:
 *   pnpm --filter @intellibiz-examples/multi-tenant dev
 */
import { http, sql, defineAction } from 'intellibiz';
import { getGovernanceLog } from '@intellibiz/db';
import { z } from 'zod';

// ─── In-memory store (stands in for Postgres) ─────────────────────────────────
interface Order {
	id: string;
	orgId: string;
	total: string;
	status: 'paid' | 'refunded';
}

const ORDERS: Order[] = [
	{ id: 'ord_a1', orgId: 'org_northwind', total: '249.00', status: 'paid' },
	{ id: 'ord_a2', orgId: 'org_northwind', total: '89.50', status: 'paid' },
	{ id: 'ord_b1', orgId: 'org_acme', total: '1750.00', status: 'paid' }
];

// ─── Routes ───────────────────────────────────────────────────────────────────
const CreateOrderInput = z.object({
	total: z.string().regex(/^\d+(\.\d+)?$/, 'total must be a decimal string')
});

export const createOrder = defineAction({
	input: CreateOrderInput,
	handler: async (action) => {
		const order: Order = {
			id: `ord_${Math.random().toString(36).slice(2, 8)}`,
			// The tenant always comes from the context — never from the body.
			orgId: action.tenantId,
			total: action.data.total,
			status: 'paid'
		};
		ORDERS.push(order);
		action.log.info('order created', { orderId: order.id, tenantId: action.tenantId });
		return order;
	}
});

http.post('/api/v1/orders', createOrder);

http.get('/api/v1/orders', (req) => {
	// Only this tenant's rows — filtered in application code here, but the
	// generated SQL below shows the filter the planner would inject.
	const mine = ORDERS.filter(o => o.orgId === req.tenantId);

	const plan = sql`
		SELECT id, total, status FROM orders
		WHERE status = ${'paid'}
		ORDER BY id
	`;

	return {
		tenantId: req.tenantId,
		count: mine.length,
		orders: mine,
		generatedSql: { text: plan.text, params: plan.params }
	};
});

http.get('/api/v1/platform/total', (req) => {
	// Deliberately cross-tenant. `sudo()` records GOVERNANCE_SUDO_ACCESS.
	const plan = req.db.sudo().sql`SELECT count(*) FROM orders`;
	const grandTotal = ORDERS.reduce((sum, o) => sum + Number(o.total), 0);

	return {
		requestedBy: req.tenantId,
		scope: plan.tenantId,
		query: plan.text,
		orders: ORDERS.length,
		grandTotal: grandTotal.toFixed(2)
	};
});

// ─── Driver ───────────────────────────────────────────────────────────────────
interface Transcript {
	status: number;
	body: unknown;
}

async function call(
	path: string,
	tenantId: string,
	init: { method?: string; body?: unknown } = {}
): Promise<Transcript> {
	const response = await http.fetch(
		new Request(`http://localhost${path}`, {
			method: init.method ?? 'GET',
			headers: {
				'x-tenant-id': tenantId,
				...(init.body !== undefined ? { 'content-type': 'application/json' } : {})
			},
			...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {})
		})
	);
	const text = await response.text();
	return { status: response.status, body: text ? JSON.parse(text) : null };
}

function show(label: string, t: Transcript): void {
	console.log(`\n${label}  →  HTTP ${t.status}`);
	console.log(JSON.stringify(t.body, null, 2));
}

async function main(): Promise<void> {
	const tenantA = 'org_northwind';
	const tenantB = 'org_acme';

	show('GET /api/v1/orders  as Northwind', await call('/api/v1/orders', tenantA));
	show('GET /api/v1/orders  as Acme', await call('/api/v1/orders', tenantB));

	show(
		'POST /api/v1/orders  as Acme',
		await call('/api/v1/orders', tenantB, { method: 'POST', body: { total: '42.00' } })
	);

	// Northwind still sees exactly its own two orders — Acme's new row is invisible.
	const after = await call('/api/v1/orders', tenantA);
	console.log(`\nNorthwind order count after Acme write: ${(after.body as { count: number }).count} (unchanged)`);

	show('GET /api/v1/platform/total  (sudo)', await call('/api/v1/platform/total', tenantA));

	console.log(`\nGovernance log entries: ${getGovernanceLog().length}`);
	for (const record of getGovernanceLog()) {
		console.log(`  ${record.type}  tenant=${record.tenantId}  by=${record.userId ?? 'anonymous'}`);
	}
}

await main();
