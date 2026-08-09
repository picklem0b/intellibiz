import type { ZodTypeAny, ZodError } from 'zod';
import type { z } from 'zod';
import { getContext, runWithContext } from './context/store.js';
import type { ActionContext } from './context/types.js';
import { ActionValidationError } from './errors.js';

// ─── Overload Signatures ──────────────────────────────────────────────────────

/** Form 1 — inline async handler, no input validation. */
type InlineHandler<TInput, TOutput> = (
	action: ActionContext<TInput>
) => Promise<TOutput>;

/** Form 2 — schema object with Zod input validation before the handler runs. */
interface ActionDefinition<TSchema extends ZodTypeAny, TOutput> {
	input: TSchema;
	handler: (action: ActionContext<z.infer<TSchema>>) => Promise<TOutput>;
	/** When true, this action is not journaled to the ledger. Default: false. */
	journal?: boolean;
}

// ─── defineAction ─────────────────────────────────────────────────────────────

/**
 * Defines a transport-agnostic business logic handler.
 *
 * Actions are the canonical unit of business logic in Intellibiz. An action:
 * - Runs inside an ActionContext (RFC-001) inheriting the caller's ALS store
 * - Can be called identically from HTTP handlers, job workers, event listeners, or tests
 * - Validates its input with Zod when Form 2 is used (throws ActionValidationError on failure)
 * - Is composable — actions can call other actions, inheriting the outer context
 *
 * Per RFC-002: every action is journaled PENDING before execution, COMMITTED on
 * success, and triggers compensating actions via commerce.transaction on failure.
 *
 * **Form 1 — inline handler, no validation:**
 * ```typescript
 * export const getHealth = defineAction(async (action) => {
 *   action.log.info('Health check', { traceId: action.traceId })
 *   return { status: 'healthy', traceId: action.traceId }
 * })
 * ```
 *
 * **Form 2 — schema + handler, input validated before handler runs:**
 * ```typescript
 * const CheckoutSchema = z.object({
 *   cartItems: z.array(z.object({ productId: z.string().uuid(), quantity: z.number().int().positive(), price: z.string() })),
 *   shippingAddress: z.object({ country: z.string().length(2) }),
 * })
 *
 * export const processCheckout = defineAction({
 *   input: CheckoutSchema,
 *   handler: async (action) => {
 *     const { cartItems, shippingAddress } = action.data // fully typed
 *     return await commerce.transaction(async (tx) => {
 *       const total = await finance.calculateTotal({ items: cartItems, destination: shippingAddress })
 *       return await tx.payments.charge({ amount: total.grandTotal, orderId: 'ord_1', customerEmail: 'a@b.com' })
 *     })
 *   },
 * })
 * ```
 */
export function defineAction<TInput, TOutput>(
	handler: InlineHandler<TInput, TOutput>
): (data: TInput) => Promise<TOutput>;

export function defineAction<TSchema extends ZodTypeAny, TOutput>(
	definition: ActionDefinition<TSchema, TOutput>
): (data: z.infer<TSchema>) => Promise<TOutput>;

export function defineAction<TInput, TOutput>(
	handlerOrDefinition:
		| InlineHandler<TInput, TOutput>
		| ActionDefinition<ZodTypeAny, TOutput>
): (data: TInput) => Promise<TOutput> {
	// ── Form 1: inline handler ──────────────────────────────────────────────────
	if (typeof handlerOrDefinition === 'function') {
		const handler = handlerOrDefinition;

		return async (data: TInput): Promise<TOutput> => {
			const parent = getContext();
			const actionCtx: ActionContext<TInput> = buildActionContext(
				parent,
				data
			);
			return runWithContext({ ...parent }, () => handler(actionCtx));
		};
	}

	// ── Form 2: schema + handler ────────────────────────────────────────────────
	const { input: schema, handler } = handlerOrDefinition;

	return async (data: TInput): Promise<TOutput> => {
		const parent = getContext();

		// Validate with Zod — throws ActionValidationError with structured field issues
		let validated: z.infer<typeof schema>;
		try {
			validated = schema.parse(data);
		} catch (err) {
			const zodErr = err as ZodError;
			throw new ActionValidationError(
				zodErr.issues.map(issue => ({
					path: issue.path.join('.'),
					message: issue.message
				}))
			);
		}

		const actionCtx: ActionContext<typeof validated> = buildActionContext(
			parent,
			validated
		);
		return runWithContext({ ...parent }, () => handler(actionCtx));
	};
}

// ─── Internal Helpers ─────────────────────────────────────────────────────────

function buildActionContext<TData>(
	parent: ReturnType<typeof getContext>,
	data: TData
): ActionContext<TData> {
	return {
		traceId: parent.traceId,
		tenantId: parent.tenantId,
		userId: parent.userId,
		role: parent.role,
		startTime: parent.startTime,
		origin: parent.origin,
		data
	};
}
