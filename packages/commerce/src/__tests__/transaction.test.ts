import { describe, it, expect } from 'vitest';
import { transaction, setPaymentProvider, type PaymentProvider, type ChargeParams } from '../transaction/index.js';
import { money } from '@intellibiz/finance';
import { runWithContext, type IntellibizStore } from '@intellibiz/core';

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

class MockPaymentProvider implements PaymentProvider {
	readonly name = 'mock';
	private _chargeCount = 0;

	async charge(params: ChargeParams) {
		this._chargeCount++;
		return {
			id: `pay_${this._chargeCount}`,
			status: 'SUCCEEDED' as const,
			rawResponse: { orderId: params.orderId }
		};
	}

	getChargeCount() {
		return this._chargeCount;
	}

	reset() {
		this._chargeCount = 0;
	}
}

class FailingPaymentProvider implements PaymentProvider {
	readonly name = 'failing';

	async charge(_params: ChargeParams) {
		throw new Error('Payment provider error');
	}
}

describe('commerce.transaction', () => {
	it('executes transaction and returns result', async () => {
		const mock = new MockPaymentProvider();
		setPaymentProvider(mock);

		await runWithContext(createContext(), async () => {
			const result = await transaction(async (tx) => {
				const payment = await tx.payments.charge({
					amount: money('19.99', 'USD'),
					orderId: 'ord_1',
					customerEmail: 'test@example.com'
				});
				return { paymentId: payment.id };
			});

			expect(result.paymentId).toBe('pay_1');
		});
	});

	it('calls the payment provider', async () => {
		const mock = new MockPaymentProvider();
		setPaymentProvider(mock);

		await runWithContext(createContext(), async () => {
			await transaction(async (tx) => {
				await tx.payments.charge({
					amount: money('29.99', 'USD'),
					orderId: 'ord_2',
					customerEmail: 'a@b.com'
				});
			});
		});

		expect(mock.getChargeCount()).toBe(1);
	});

	it('executes license issuance', async () => {
		const mock = new MockPaymentProvider();
		setPaymentProvider(mock);

		await runWithContext(createContext(), async () => {
			const result = await transaction(async (tx) => {
				const license = await tx.licenses.issue({
					plan: 'pro',
					duration: '1y'
				});
				return { licenseKey: license.key, plan: license.plan };
			});

			expect(result.plan).toBe('pro');
			expect(result.licenseKey).toContain('LIC-');
		});
	});

	it('license.grant() is an alias for issue()', async () => {
		const mock = new MockPaymentProvider();
		setPaymentProvider(mock);

		await runWithContext(createContext(), async () => {
			const result = await transaction(async (tx) => {
				const license = await tx.licenses.grant({
					plan: 'enterprise'
				});
				return license.plan;
			});

			expect(result).toBe('enterprise');
		});
	});

	it('propagates errors from payment provider', async () => {
		setPaymentProvider(new FailingPaymentProvider());

		await runWithContext(createContext(), async () => {
			await expect(
				transaction(async (tx) => {
					await tx.payments.charge({
						amount: money('10', 'USD'),
						orderId: 'ord_fail',
						customerEmail: 'a@b.com'
					});
				})
			).rejects.toThrow('Payment provider error');
		});
	});

	it('license expiry defaults to 1 year', async () => {
		const mock = new MockPaymentProvider();
		setPaymentProvider(mock);

		await runWithContext(createContext(), async () => {
			const result = await transaction(async (tx) => {
				const license = await tx.licenses.issue({ plan: 'basic' });
				return license.expiresAt;
			});

			const oneYearFromNow = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
			// Should be within 1 second of one year from now
			expect(Math.abs(result.getTime() - oneYearFromNow.getTime())).toBeLessThan(1000);
		});
	});

	it('license expiry respects duration string', async () => {
		const mock = new MockPaymentProvider();
		setPaymentProvider(mock);

		await runWithContext(createContext(), async () => {
			const result = await transaction(async (tx) => {
				const license = await tx.licenses.issue({ plan: 'trial', duration: '30d' });
				return license.expiresAt;
			});

			const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
			expect(Math.abs(result.getTime() - thirtyDaysFromNow.getTime())).toBeLessThan(1000);
		});
	});

	it('tx.payments.refund() executes without error', async () => {
		const mock = new MockPaymentProvider();
		setPaymentProvider(mock);

		await runWithContext(createContext(), async () => {
			await transaction(async (tx) => {
				// Refund is a no-op compensating action in V1
				await tx.payments.refund({ paymentId: 'pay_1' });
			});
		});
	});

	it('tx.licenses.revoke() executes without error', async () => {
		const mock = new MockPaymentProvider();
		setPaymentProvider(mock);

		await runWithContext(createContext(), async () => {
			await transaction(async (tx) => {
				await tx.licenses.revoke({ licenseId: 'lic_1' });
			});
		});
	});
});
