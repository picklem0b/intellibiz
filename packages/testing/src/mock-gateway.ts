import type {
	ChargeParams,
	ChargeResult,
	RefundParams,
	PaymentProvider
} from '@intellibiz/commerce';

// ─── Mock Payment Provider ──────────────────────────────────────────────────

type MockChargeHandler = (params: ChargeParams) => Promise<ChargeResult>;
type MockRefundHandler = (params: RefundParams) => Promise<void>;

/**
 * A fully configurable mock payment provider for testing.
 *
 * By default, every charge() call succeeds with a generated ID.
 * Configure failures, custom responses, and spies as needed.
 *
 * @example
 * const mock = createMockGateway('stripe')
 *
 * // All charges succeed by default
 * await tx.payments.charge({ amount: money('19.99', 'USD'), orderId: 'ord_1', customerEmail: '' })
 *
 * // Force next charge to fail
 * mock.failNext({ code: 'card_declined' })
 *
 * // Spy on refund calls
 * const spy = mock.spyRefund()
 * await tx.payments.refund({ paymentId: 'pay_1' })
 * expect(spy).toHaveBeenCalledOnce()
 */
export function createMockGateway(name = 'mock'): MockGateway {
	return new MockGateway(name);
}

export class MockGateway implements PaymentProvider {
	readonly name: string;
	private _callHistory: Array<{
		method: string;
		params: unknown;
		timestamp: number;
		result?: unknown;
		error?: Error;
	}> = [];
	private _nextChargeResult: Partial<ChargeResult> | null = null;
	private _nextChargeError: Error | null = null;
	private _customChargeHandler: MockChargeHandler | null = null;
	private _refundSpies: Array<() => void> = [];
	private _chargeCount = 0;
	private _refundCount = 0;

	constructor(name: string) {
		this.name = name;
	}

	// ── Configuration ────────────────────────────────────────────────────────

	/**
	 * Forces the next charge() call to return the given result.
	 * Consumed after one call — subsequent calls use the default success.
	 */
	succeedNext(result?: Partial<ChargeResult>): this {
		this._nextChargeResult = result ?? null;
		return this;
	}

	/**
	 * Forces the next charge() call to throw with the given error code.
	 * Consumed after one call — subsequent calls use the default success.
	 */
	failNext(opts: { code: string; message?: string }): this {
		this._nextChargeError = new Error(opts.code);
		(this._nextChargeError as Error & { code: string }).code = opts.code;
		return this;
	}

	/**
	 * Fails the next N charge() calls, then succeeds.
	 */
	failNextN(count: number, opts: { code: string; message?: string }): this {
		let remaining = count;
		this._customChargeHandler = async (params) => {
			if (remaining > 0) {
				remaining--;
				const err = new Error(opts.code);
				(err as Error & { code: string }).code = opts.code;
				throw err;
			}
			return this._defaultChargeResult(params);
		};
		return this;
	}

	/**
	 * Replaces the charge handler with a custom implementation.
	 */
	overrideCharge(handler: MockChargeHandler): this {
		this._customChargeHandler = handler;
		return this;
	}

	// ── Spies ────────────────────────────────────────────────────────────────

	/**
	 * Registers a spy that is called every time a refund executes.
	 * Returns a callable spy function that records calls.
	 */
	spyRefund(): { calls: number; reset(): void } {
		const spyInfo = { calls: 0, reset() { spyInfo.calls = 0; } };
		this._refundSpies.push(() => { spyInfo.calls++; });
		return spyInfo;
	}

	// ── PaymentProvider Interface ────────────────────────────────────────────

	async charge(params: ChargeParams): Promise<ChargeResult> {
		this._callHistory.push({
			method: 'charge',
			params,
			timestamp: Date.now()
		});
		this._chargeCount++;

		if (this._customChargeHandler) {
			const result = await this._customChargeHandler(params);
			this._callHistory[this._callHistory.length - 1]!.result = result;
			return result;
		}

		if (this._nextChargeError) {
			const err = this._nextChargeError;
			this._nextChargeError = null;
			this._callHistory[this._callHistory.length - 1]!.error = err;
			throw err;
		}

		const result = this._defaultChargeResult(params);
		if (this._nextChargeResult) {
			Object.assign(result, this._nextChargeResult);
			this._nextChargeResult = null;
		}
		this._callHistory[this._callHistory.length - 1]!.result = result;
		return result;
	}

	async refund(_params: RefundParams): Promise<void> {
		this._callHistory.push({
			method: 'refund',
			params: _params,
			timestamp: Date.now()
		});
		this._refundCount++;
		for (const spy of this._refundSpies) {
			spy();
		}
	}

	// ── Inspection ───────────────────────────────────────────────────────────

	getChargeCount(): number {
		return this._chargeCount;
	}

	getRefundCount(): number {
		return this._refundCount;
	}

	getCallHistory(): ReadonlyArray<{
		method: string;
		params: unknown;
		timestamp: number;
		result?: unknown;
		error?: Error;
	}> {
		return this._callHistory;
	}

	getLastCharge(): ChargeParams | null {
		const last = this._callHistory.filter(c => c.method === 'charge').pop();
		return (last?.params as ChargeParams) ?? null;
	}

	// ── Reset ────────────────────────────────────────────────────────────────

	reset(): void {
		this._callHistory = [];
		this._nextChargeResult = null;
		this._nextChargeError = null;
		this._customChargeHandler = null;
		this._refundSpies = [];
		this._chargeCount = 0;
		this._refundCount = 0;
	}

	// ── Internal ─────────────────────────────────────────────────────────────

	private _defaultChargeResult(params: ChargeParams): ChargeResult {
		return {
			id: `pay_mock_${Date.now().toString(36)}_${this._chargeCount}`,
			status: 'SUCCEEDED',
			rawResponse: { provider: this.name, orderId: params.orderId }
		};
	}
}

// ─── Pre-built Mock Gateways ────────────────────────────────────────────────

/**
 * A Stripe-like mock gateway with Stripe-style event IDs.
 */
export function createStripeMock(): MockGateway {
	return createMockGateway('stripe');
}

/**
 * A PayFast/Ozow-like mock gateway for South African EFT testing.
 */
export function createPayFastMock(): MockGateway {
	return createMockGateway('payfast-ozow');
}
