import { defineAction, commerce, finance, identity, sql } from 'intellibiz'
import { z } from 'zod'

const CartItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().positive(),
  price: z.string().min(1),
  currency: z.string().length(3).toUpperCase(),
})

const ShippingAddressSchema = z.object({
  country: z.string().length(2).toUpperCase(),
  city: z.string().min(1),
  line1: z.string().min(1),
  postalCode: z.string().min(1),
})

const CheckoutInput = z.object({
  cartItems: z.array(CartItemSchema).min(1),
  shippingAddress: ShippingAddressSchema,
})

interface OrderReceipt {
  orderId: string
  total: string
  currency: string
  taxRate: number
  estimatedDelivery: string
  traceId: string
}

/**
 * Atomic checkout flow demonstrating the full V1 Intellibiz pipeline:
 * 1. Identity — get authenticated user from ALS context
 * 2. Finance — calculate subtotal + destination-based tax
 * 3. Commerce — atomic transaction with WAL journaling
 * 4. SQL — pure SQL query with automatic tenancy injection
 */
export const processOrder = defineAction({
  input: CheckoutInput,
  handler: async (action): Promise<OrderReceipt> => {
    // 1. Identity: resolve authenticated user
    const user = identity.getActiveUser()

    // 2. Finance: calculate subtotal + destination-based tax
    const totals = await finance.calculateTotal({
      items: action.data.cartItems.map(item => ({
        price: finance.money(item.price, item.currency),
        quantity: item.quantity,
      })),
      destination: {
        country: action.data.shippingAddress.country,
      },
    })

    // 3. Commerce: atomic transaction backed by WAL ledger
    return await commerce.transaction(async (tx) => {
      // Charge payment provider
      const payment = await tx.payments.charge({
        amount: totals.grandTotal,
        orderId: `ord_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        customerEmail: `${user.id}@placeholder.com`,
        metadata: {
          userId: user.id,
          tenantId: user.tenantId,
        },
      })

      // Pure SQL — tenancy is injected automatically by the Query Planner
      await sql`
        INSERT INTO orders (id, user_id, total_amount, tax_rate, status, store_id)
        VALUES (
          ${payment.id},
          ${user.id},
          ${totals.grandTotal.amount},
          ${String(totals.taxRate)},
          'paid',
          ${user.tenantId}
        )
      `

      return {
        orderId: payment.id,
        total: totals.grandTotal.amount,
        currency: totals.currency,
        taxRate: totals.taxRate,
        estimatedDelivery: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0]!,
        traceId: action.traceId,
      }
    })
  },
})
