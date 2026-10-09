/**
 * CRM — authentication and authorisation without a single middleware of your own.
 *
 * The request pipeline is:
 *   1. `createRouter({ jwtSecret })` mounts the kernel middleware
 *   2. the middleware verifies the bearer JWT and resolves tenant + role into ALS
 *   3. handlers/actions call `identity.can('write')`, an O(1) bitmask check
 *   4. a thrown `identity.ForbiddenError()` becomes a 403 with a stable code
 *
 * Contacts are tenant-scoped, so a user from one org can never read another's.
 *
 * Run it:
 *   pnpm --filter @intellibiz-examples/crm dev
 */
import { createRouter } from '@intellibiz/http';
import { defineAction, identity } from 'intellibiz';
import { SignJWT } from 'jose';
import { z } from 'zod';

const JWT_SECRET = process.env['JWT_SECRET'] ?? 'dev-only-secret-change-me';
const encoder = new TextEncoder();

// A real deployment signs tokens in your auth service; this is the dev issuer.
async function mintToken(userId: string, tenantId: string, role: string): Promise<string> {
	return new SignJWT({ tenant_id: tenantId, roles: [role] })
		.setProtectedHeader({ alg: 'HS256' })
		.setSubject(userId)
		.setIssuedAt()
		.setExpirationTime('1h')
		.sign(encoder.encode(JWT_SECRET));
}

// ─── Data ─────────────────────────────────────────────────────────────────────
interface Contact {
	id: string;
	orgId: string;
	name: string;
	email: string;
}

const CONTACTS: Contact[] = [];

// ─── Routes ───────────────────────────────────────────────────────────────────
const api = createRouter({ jwtSecret: JWT_SECRET });

api.get('/api/v1/contacts', (req) => {
	if (!identity.can('read')) throw identity.ForbiddenError();
	return CONTACTS.filter(c => c.orgId === req.tenantId);
});

const CreateContactInput = z.object({
	name: z.string().min(1).max(120),
	email: z.string().email()
});

export const createContact = defineAction({
	input: CreateContactInput,
	handler: async (action) => {
		if (!identity.can('write')) throw identity.ForbiddenError();

		const contact: Contact = {
			id: `ct_${Math.random().toString(36).slice(2, 8)}`,
			orgId: action.tenantId,
			...action.data
		};
		CONTACTS.push(contact);
		return contact;
	}
});

api.post('/api/v1/contacts', createContact);

api.delete('/api/v1/contacts/:id', (req) => {
	if (!identity.can('delete')) throw identity.ForbiddenError();

	const index = CONTACTS.findIndex(
		c => c.id === req.params['id'] && c.orgId === req.tenantId
	);
	if (index === -1) {
		throw Object.assign(new Error('Contact not found.'), {
			code: 'CONTACT_NOT_FOUND',
			status: 404
		});
	}
	const [removed] = CONTACTS.splice(index, 1);
	return removed;
});

api.get('/api/v1/contacts/export', (req) => {
	if (!identity.can('export')) throw identity.ForbiddenError();
	return {
		tenantId: req.tenantId,
		format: 'csv',
		rows: CONTACTS.filter(c => c.orgId === req.tenantId).length
	};
});

// ─── Driver ───────────────────────────────────────────────────────────────────
async function call(
	token: string,
	path: string,
	init: { method?: string; body?: unknown } = {}
): Promise<{ status: number; body: unknown }> {
	const response = await api.fetch(
		new Request(`http://localhost${path}`, {
			method: init.method ?? 'GET',
			headers: {
				authorization: `Bearer ${token}`,
				...(init.body !== undefined ? { 'content-type': 'application/json' } : {})
			},
			...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {})
		})
	);
	const text = await response.text();
	return { status: response.status, body: text ? JSON.parse(text) : null };
}

async function main(): Promise<void> {
	const tenant = 'org_acme';
	const admin = await mintToken('usr_admin', tenant, 'admin');
	const member = await mintToken('usr_member', tenant, 'member');
	const viewer = await mintToken('usr_viewer', tenant, 'viewer');

	const scenarios: Array<[string, () => Promise<{ status: number; body: unknown }>]> = [
		['admin  → POST   /contacts   (write)', () => call(admin, '/api/v1/contacts', { method: 'POST', body: { name: 'Ada Lovelace', email: 'ada@acme.test' } })],
		['viewer → POST   /contacts   (denied)', () => call(viewer, '/api/v1/contacts', { method: 'POST', body: { name: 'Mallory', email: 'mal@acme.test' } })],
		['viewer → GET    /contacts   (read)', () => call(viewer, '/api/v1/contacts')],
		['member → DELETE /contacts/:id (denied)', () => call(member, '/api/v1/contacts/ct_missing', { method: 'DELETE' })],
		['admin  → GET    /contacts/export', () => call(admin, '/api/v1/contacts/export')],
		['viewer → GET    /contacts/export (denied)', () => call(viewer, '/api/v1/contacts/export')]
	];

	for (const [label, run] of scenarios) {
		const { status, body } = await run();
		const outcome = status < 400 ? 'ALLOW' : 'DENY ';
		console.log(`[${outcome}] ${String(status)}  ${label}`);
		console.log(`         ${JSON.stringify(body)}`);
	}

	// A token for another tenant is honoured for *its* tenant, and sees nothing here.
	const other = await mintToken('usr_other', 'org_globex', 'admin');
	const crossTenant = await call(other, '/api/v1/contacts');
	console.log(`\n[ALLOW] ${crossTenant.status}  org_globex → GET /contacts`);
	console.log(`         ${JSON.stringify(crossTenant.body)} (isolation holds)`);
}

await main();
