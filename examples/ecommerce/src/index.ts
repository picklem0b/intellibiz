/**
 * E-commerce — subscription checkout, end to end.
 *
 * Wires a mock payment gateway (so it runs without keys), listens for the
 * resulting event, and executes the `subscribe` action in a tenant context.
 *
 * Run it:
 *   pnpm --filter @intellibiz-examples/ecommerce dev
 */
import { commerce, money, on } from 'intellibiz';
import { createStripeMock, withContext } from '@intellibiz/testing';
import { subscribe } from './actions/subscribe';

// ─── Typed events ─────────────────────────────────────────────────────────────
declare module '@intellibiz/core' {
	interface IntellibizEvents {
		'subscription.created': {
			subscriptionId: string;
			plan: string;
			total: string;
		};
	}
}

on('subscription.created', async (event) => {
	event.log.info('provisioning workspace for new subscriber', {
		subscriptionId: event.payload.subscriptionId,
		plan: event.payload.plan
	});
});

// ─── Payment provider ─────────────────────────────────────────────────────────
// Swap this for `new StripeProvider({ secretKey })` from @intellibiz/commerce
// in production; everything else stays identical.
const gateway = createStripeMock();
commerce.setPaymentProvider(gateway);

async function main(): Promise<void> {
	const receipt = await withContext(
		{ tenantId: 'org_acme', userId: 'usr_ada', role: 'billing' },
		() =>
			subscribe({
				plan: 'pro',
				billingCycle: 'monthly',
				customerEmail: 'ada@acme.test',
				country: 'DE'
			})
	);

	console.log('Subscription receipt');
	console.log('────────────────────');
	console.log(`  subscription  ${receipt.subscriptionId}`);
	console.log(`  plan          ${receipt.plan} (${receipt.billingCycle})`);
	console.log(`  subtotal      ${money(receipt.subtotal, receipt.currency).format()}`);
	console.log(`  tax (${(receipt.taxRate * 100).toFixed(0)}%)     ${money(receipt.tax, receipt.currency).format()}`);
	console.log(`  total         ${money(receipt.total, receipt.currency).format()}`);
	console.log(`  licence       ${receipt.licenseKey}`);
	console.log(`  expires       ${receipt.expiresAt}`);
	console.log(`  journal SQL   ${receipt.journalSql}`);

	const charge = gateway.getLastCharge();
	console.log(`\nGateway charge count: ${gateway.getChargeCount()}`);
	console.log(`Charged amount: ${charge?.amount.format() ?? '—'}`);
	console.log(`Refund count: ${gateway.getRefundCount()} (0 — the transaction committed)`);
}

await main();
