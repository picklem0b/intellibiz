/**
 * WebSocket Chat — realtime rooms on the kernel's SocketContext.
 *
 * The kernel does not care which socket library you use. A runtime supplies a
 * `SocketDriver` (the transport primitives) and the kernel hands your handler a
 * `SocketContext` with:
 *   • the full ALS store (tenantId, userId, traceId)
 *   • kernel services (`socket.log`, `socket.emit`)
 *   • room operations (`join` / `leave` / `send` / `broadcast` / `disconnect`)
 *
 * This example uses an in-memory driver, so it runs anywhere — swap it for a
 * `ws`/`uWebSockets`/Socket.IO driver without touching the handlers.
 *
 * Run it:
 *   pnpm --filter @intellibiz-examples/websocket-chat dev
 */
import { buildSocketContext } from 'intellibiz';
import type { SocketContext, SocketDriver } from 'intellibiz';
import { createTenantStore, withTenantContext } from '@intellibiz/testing';

declare module '@intellibiz/core' {
	interface IntellibizEvents {
		'chat.message': { room: string; from: string; text: string };
	}
}

// ─── Transport ────────────────────────────────────────────────────────────────
interface Envelope {
	connectionId: string;
	kind: 'send' | 'broadcast';
	event: string;
	payload: unknown;
}

class InMemorySocketDriver implements SocketDriver {
	private readonly members = new Map<string, Set<string>>();
	private readonly connections = new Set<string>();

	constructor(private readonly log: (entry: Envelope) => void) {}

	send(connectionId: string, event: string, payload: unknown): void {
		this.log({ connectionId, kind: 'send', event, payload });
	}

	broadcast(room: string, event: string, payload: unknown): void {
		for (const connectionId of this.members.get(room) ?? []) {
			this.log({ connectionId, kind: 'broadcast', event, payload });
		}
	}

	join(connectionId: string, room: string): void {
		this.connections.add(connectionId);
		const set = this.members.get(room) ?? new Set<string>();
		set.add(connectionId);
		this.members.set(room, set);
	}

	leave(connectionId: string, room: string): void {
		this.members.get(room)?.delete(connectionId);
	}

	disconnect(connectionId: string): void {
		this.connections.delete(connectionId);
		for (const set of this.members.values()) set.delete(connectionId);
	}

	roomMembers(room: string): string[] {
		return [...(this.members.get(room) ?? [])];
	}
}

// ─── Application ──────────────────────────────────────────────────────────────
const transcript: Envelope[] = [];
const driver = new InMemorySocketDriver(entry => transcript.push(entry));

type ChatData = { room: string; text: string };

async function handleMessage(socket: SocketContext<ChatData>): Promise<void> {
	// `socket.log` is bound to the connection's trace/tenant/user.
	socket.log.info('chat message received', {
		connectionId: socket.connectionId,
		room: socket.data.room
	});

	// Fan the message out to everyone in the room (including the sender).
	socket.broadcast('chat.message', {
		room: socket.data.room,
		from: socket.userId ?? 'anonymous',
		text: socket.data.text
	});

	// Typed event into the kernel bus — trace/tenant follow it.
	await socket.emit('chat.message', {
		room: socket.data.room,
		from: socket.userId ?? 'anonymous',
		text: socket.data.text
	});
}

// ─── Demo ─────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
	await withTenantContext('org_acme', { userId: 'usr_ada', role: 'member' }, async () => {
		// Two connections on the same tenant, different users.
		const ada = buildSocketContext(
			createTenantStore({ tenantId: 'org_acme', userId: 'usr_ada' }),
			{ room: 'room:general', text: 'morning all' },
			{ connectionId: 'conn_ada', roomId: null, driver }
		);
		const grace = buildSocketContext(
			createTenantStore({ tenantId: 'org_acme', userId: 'usr_grace' }),
			{ room: 'room:general', text: 'morning!' },
			{ connectionId: 'conn_grace', roomId: null, driver }
		);

		// Both join the same room.
		ada.join('room:general');
		grace.join('room:general');

		console.log(`room members: ${driver.roomMembers('room:general').join(', ')}`);

		await handleMessage(ada);
		await handleMessage(grace);

		// A direct message to one connection.
		grace.send('typing', { from: 'usr_grace' });

		// Grace leaves; Ada's next broadcast reaches only Ada.
		grace.leave('room:general');
		console.log(`after leave:  ${driver.roomMembers('room:general').join(', ')}\n`);

		ada.data.text = 'anyone there?';
		await handleMessage(ada);

		ada.disconnect();
	});

	console.log('Transcript');
	console.log('──────────');
	for (const entry of transcript) {
		const arrow = entry.kind === 'broadcast' ? '⇢' : '→';
		console.log(`  ${entry.connectionId.padEnd(12)} ${arrow} ${entry.event} ${JSON.stringify(entry.payload)}`);
	}
}

await main();
