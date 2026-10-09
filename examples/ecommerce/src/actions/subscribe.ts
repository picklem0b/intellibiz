/**
 * `subscribe` — one action that does the whole job.
 *
 *   validate → price → tax → atomic transaction (charge + licence) → journal → emit
 *
 * Because it is a `defineAction`, the exact same function can be mounted on an
 * HTTP route, called from a queue worker, or invoked directly in a test — it
 * only ever needs an ALS context, which every entry point provides.
 */
import { commerce, finance, money, sql, defineAction } from 'intellibiz';
import { z } from 'zod';

export type Plan = 'starter' | 'pro' | 'enterprise';
export type BillingCycle = 'monthly' | 'annual';

/** Catalogue prices live in minor-unit-safe decimal strings, never numbers. */
export const PLAN_PRICES: Record<Plan, Record<BillingCycle, string>> = {
	starter: { monthly: '29.00', annual: '290.00' },
	pro: { monthly: '79.00', annual: '790.00' },
	enterprise: { monthly: '299.00', annual: '2990.00' }
};

export const SubscribeInput = z.object({
	plan: z.enum(['starter', 'pro', 'enterprise']),
	billingCycle: z.enum(['monthly', 'annual']),
	customerEmail: z.string().email(),
	/** ISO-3166 alpha-2 destination, used for destination-based tax. */
	country: z.string().length(2).toUpperCase().default('US')
});

export type SubscribeInput = z.infer<typeof SubscribeInput>;

export interface SubscriptionReceipt {
	subscriptionId: string;
	plan: Plan;
	billingCycle: BillingCycle;
	currency: string;
	subtotal: string;
	tax: string;
	total: string;
	taxRate: number;
	licenseKey: string;
	expiresAt: string;
	/** The SQL the query planner produced — tenancy injected, params bound. */
	journalSql: string;
}

export const subscribe = defineAction({
	input: SubscribeInput,
	handler: async (action): Promise<SubscriptionReceipt> => {
		const { plan, billingCycle, customerEmail, country } = action.data;

		// 1. Price from the catalogue as an exact Money value.
		const price = money(PLAN_PRICES[plan][billingCycle], 'USD');

		// 2. Destination-based tax (EU VAT, reverse charge, or zero).
		const totals = await finance.calculateTotal({
			items: [{ price, quantity: 1 }],
			destination: { country }
		});

		const orderId = `sub_${Date.now().toString(36)}`;

		// 3. Everything mutating happens inside one atomic transaction. If the
		//    licence grant throws, the charge is refunded by the compensating
		//    action the transaction registered for us.
		const receipt = await commerce.transaction(async tx => {
			const payment = await tx.payments.charge({
				amount: totals.grandTotal,
				orderId,
				customerEmail
			});

			const license = await tx.licenses.issue({
				plan,
				duration: billingCycle === 'annual' ? '365d' : '30d'
			});

			const journal = sql`
				INSERT INTO subscriptions (id, email, plan, amount, currency)
				VALUES (${payment.id}, ${customerEmail}, ${plan}, ${totals.grandTotal.amount}, ${totals.currency})
			`;

			return {
				subscriptionId: payment.id,
				plan,
				billingCycle,
				currency: totals.currency,
				subtotal: totals.subtotal.amount,
				tax: totals.taxTotal.amount,
				total: totals.grandTotal.amount,
				taxRate: totals.taxRate,
				licenseKey: license.key,
				expiresAt: license.expiresAt.toISOString(),
				journalSql: journal.text
			} satisfies SubscriptionReceipt;
		});

		// 4. Announce it. The trace/tenant from this action flow into listeners.
		await action.emit('subscription.created', {
			subscriptionId: receipt.subscriptionId,
			plan,
			total: receipt.total
		});

		return receipt;
	}
});
