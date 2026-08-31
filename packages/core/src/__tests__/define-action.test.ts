import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { defineAction } from '../define-action.js';
import {
	runWithContext,
	getContext,
	getTenantId,
	getUserId
} from '../context/store.js';
import type { IntellibizStore } from '../context/store.js';
import { ActionValidationError } from '../errors.js';

function createContext(overrides: Partial<IntellibizStore> = {}): IntellibizStore {
	return {
		traceId: 'ibiz_trc_0000000000001111222233334444',
		tenantId: 'org_test',
		userId: 'usr_1',
		role: 'member',
		startTime: process.hrtime.bigint(),
		origin: 'http',
		...overrides
	};
}

describe('defineAction', () => {
	describe('Form 1 — inline handler', () => {
		it('creates a callable action function', async () => {
			const getHealth = defineAction(async (action) => {
				return { status: 'healthy', traceId: action.traceId };
			});

			expect(typeof getHealth).toBe('function');
		});

		it('executes handler with typed action context', async () => {
			const getHealth = defineAction(async (action) => {
				return {
					traceId: action.traceId,
					tenantId: action.tenantId,
					userId: action.userId
				};
			});

			await runWithContext(createContext(), async () => {
				const result = await getHealth(undefined);
				expect(result.traceId).toBe('ibiz_trc_0000000000001111222233334444');
				expect(result.tenantId).toBe('org_test');
				expect(result.userId).toBe('usr_1');
			});
		});

		it('passes data to the action', async () => {
			const echo = defineAction(async (action) => {
				return action.data;
			});

			await runWithContext(createContext(), async () => {
				const result = await echo({ message: 'hello' });
				expect(result).toEqual({ message: 'hello' });
			});
		});

		it('propagates errors from the handler', async () => {
			const failing = defineAction(async () => {
				throw new Error('boom');
			});

			await runWithContext(createContext(), async () => {
				await expect(failing(undefined)).rejects.toThrow('boom');
			});
		});

		it('inherits context from parent scope', async () => {
			const inner = defineAction(async (action) => {
				return { tenantId: action.tenantId, userId: action.userId };
			});

			const outer = defineAction(async () => {
				return inner(undefined);
			});

			await runWithContext(
				createContext({ tenantId: 'org_outer', userId: 'usr_outer' }),
				async () => {
					const result = await outer(undefined);
					expect(result.tenantId).toBe('org_outer');
					expect(result.userId).toBe('usr_outer');
				}
			);
		});
	});

	describe('Form 2 — schema + handler', () => {
		const CheckoutSchema = z.object({
			cartItems: z.array(
				z.object({
					productId: z.string().uuid(),
					quantity: z.number().int().positive(),
					price: z.string()
				})
			),
			shippingAddress: z.object({
				country: z.string().length(2)
			})
		});

		it('validates input with Zod before handler runs', async () => {
			const processCheckout = defineAction({
				input: CheckoutSchema,
				handler: async (action) => {
					return { items: action.data.cartItems.length };
				}
			});

			await runWithContext(createContext(), async () => {
				const validInput = {
					cartItems: [
						{
							productId: '550e8400-e29b-41d4-a716-446655440000',
							quantity: 2,
							price: '19.99'
						}
					],
					shippingAddress: { country: 'US' }
				};
				const result = await processCheckout(validInput);
				expect(result.items).toBe(1);
			});
		});

		it('throws ActionValidationError on invalid input', async () => {
			const processCheckout = defineAction({
				input: CheckoutSchema,
				handler: async (action) => {
					return { items: action.data.cartItems.length };
				}
			});

			await runWithContext(createContext(), async () => {
				const invalidInput = {
					cartItems: [],
					shippingAddress: { country: 'USA' } // too long
				};
				await expect(processCheckout(invalidInput)).rejects.toThrow(
					ActionValidationError
				);
			});
		});

		it('provides structured error details on validation failure', async () => {
			const processCheckout = defineAction({
				input: CheckoutSchema,
				handler: async (action) => {
					return action.data;
				}
			});

			await runWithContext(createContext(), async () => {
				try {
					await processCheckout({
						cartItems: 'not-an-array',
						shippingAddress: { country: 'US' }
					});
					expect.fail('Should have thrown');
				} catch (err) {
					expect(err).toBeInstanceOf(ActionValidationError);
					const actionErr = err as ActionValidationError;
					expect(actionErr.code).toBe('ACTION_VALIDATION_ERROR');
					expect(actionErr.status).toBe(422);
					expect(actionErr.details).toBeDefined();
				}
			});
		});

		it('passes validated data to handler', async () => {
			const schema = z.object({ name: z.string().min(1) });
			const greet = defineAction({
				input: schema,
				handler: async (action) => {
					return `Hello, ${action.data.name}!`;
				}
			});

			await runWithContext(createContext(), async () => {
				const result = await greet({ name: 'Alice' });
				expect(result).toBe('Hello, Alice!');
			});
		});

		it('supports optional journal flag', async () => {
			const readOnly = defineAction({
				input: z.object({ id: z.string() }),
				handler: async (action) => {
					return { id: action.data.id };
				},
				journal: false
			});

			await runWithContext(createContext(), async () => {
				const result = await readOnly({ id: '123' });
				expect(result.id).toBe('123');
			});
		});
	});

	describe('context parameter naming', () => {
		it('action context has all required fields', async () => {
			const testAction = defineAction(async (action) => {
				return {
					hasTraceId: 'traceId' in action,
					hasTenantId: 'tenantId' in action,
					hasUserId: 'userId' in action,
					hasRole: 'role' in action,
					hasStartTime: 'startTime' in action,
					hasOrigin: 'origin' in action,
					hasData: 'data' in action
				};
			});

			await runWithContext(createContext(), async () => {
				const result = await testAction({ test: true });
				expect(result.hasTraceId).toBe(true);
				expect(result.hasTenantId).toBe(true);
				expect(result.hasUserId).toBe(true);
				expect(result.hasRole).toBe(true);
				expect(result.hasStartTime).toBe(true);
				expect(result.hasOrigin).toBe(true);
				expect(result.hasData).toBe(true);
			});
		});
	});
});
