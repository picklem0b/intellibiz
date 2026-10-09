/**
 * `processOrder` — the flagship checkout pipeline.
 *
 *  identity → pricing → destination tax → atomic payment → journal → event
 *
 * Mounted on `POST /api/v1/checkout` with no wrapper (see `../index.ts`).
 */
import { commerce, defineAction, finance, identity, money, sql } from 'intellibiz';
import { z } from 'zod';

const CartItemSchema = z.object({
	productId: z.string().min(1),
	quantity: z.number().int().positive(),
	/** Catalogue price as a decimal string. */
	unitPrice: z.string().regex(/^\d+(\.\d+)?$/, 'unitPrice must be a decimal string')
});

const ShippingAddressSchema = z.object({
	line1: z.string().min(1),
	city: z.string().min(1),
	postalCode: z.string().min(1),
	country: z.string().length(2).toUpperCase()
});

export const CheckoutInput = z.object({
	cartItems: z.array(CartItemSchema).min(1),
	shippingAddress: ShippingAddressSchema
});

export interface OrderReceipt {
	orderId: string;
	subtotal: string;
	tax: string;
	total: string;
	currency: string;
	taxRate: number;
	itemCount: number;
	estimatedDelivery: string;
	traceId: string;
}

export const processOrder = defineAction({
	input: CheckoutInput,
	handler: async (action): Promise<OrderReceipt> => {
		const user = identity.getActiveUser();
		const { cartItems, shippingAddress } = action.data;

		const totals = await finance.calculateTotal({
			items: cartItems.map(item => ({
				price: money(item.unitPrice, 'USD'),
				quantity: item.quantity
			})),
			destination: { country: shippingAddress.country }
		});

		return commerce.transaction(async tx => {
			const orderId = `ord_${Date.now().toString(36)}`;

			const payment = await tx.payments.charge({
				amount: totals.grandTotal,
				orderId,
				customerEmail: user.email ?? `${user.id}@example.test`
			});

			// Tenancy is injected by the planner; params stay bound.
			const journal = sql`
				INSERT INTO orders (id, user_id, store_id, total_amount, currency, status)
				VALUES (${payment.id}, ${user.id}, ${user.tenantId}, ${totals.grandTotal.amount}, ${totals.currency}, ${'paid'})
			`;

			await action.emit('order.placed', {
				orderId: payment.id,
				total: totals.grandTotal.amount,
				userId: user.id
			});

			const delivery = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);

			return {
				orderId: payment.id,
				subtotal: totals.subtotal.amount,
				tax: totals.taxTotal.amount,
				total: totals.grandTotal.amount,
				currency: totals.currency,
				taxRate: totals.taxRate,
				itemCount: cartItems.reduce((n, i) => n + i.quantity, 0),
				estimatedDelivery: delivery.toISOString().slice(0, 10),
				traceId: action.traceId
			};
		});
	}
});
