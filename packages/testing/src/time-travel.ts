// ─── Virtual Clock ──────────────────────────────────────────────────────────
// Provides deterministic time control for tests that depend on Date.now(),
// setTimeout, setInterval, or time-sensitive business logic (subscriptions,
// token expiry, billing cycles, license renewal).

let _offset = 0;
let _frozenAt: number | null = null;
const _originalDateNow = Date.now.bind(Date);
const _originalDate = Date;

function parseDuration(duration: string): number {
	const match = duration.match(/^(\d+)(ms|s|m|h|d|w|y)$/);
	if (!match) {
		throw new Error(
			`Invalid duration format: '${duration}'. Use '30d', '2h', '15m', '1y', '500ms', '30s', '2w'.`
		);
	}
	const [, amount, unit] = match;
	const n = parseInt(amount!, 10);
	const ms: Record<string, number> = {
		ms: n,
		s: n * 1_000,
		m: n * 60_000,
		h: n * 3_600_000,
		d: n * 86_400_000,
		w: n * 604_800_000,
		y: n * 31_536_000_000
	};
	return ms[unit!]!;
}

/**
 * Returns the virtual current time in milliseconds.
 * Respects both offset-based advance() and freeze-based freeze().
 */
export function virtualNow(): number {
	if (_frozenAt !== null) return _frozenAt;
	return _originalDateNow() + _offset;
}

/**
 * Installs a global Date.now override that returns virtual time.
 * Call once at the top of a test file or in beforeAll.
 */
export function installVirtualClock(): void {
	Date.now = virtualNow;
}

/**
 * Restores the original Date.now.
 * Call in afterAll or afterEach to clean up.
 */
export function restoreRealClock(): void {
	Date.now = _originalDateNow;
	_offset = 0;
	_frozenAt = null;
}

/**
 * Advances the virtual clock by the given duration.
 * Subsequent calls to Date.now() and virtualNow() will reflect the advance.
 *
 * @example
 * time.advance('30d')   // moves forward 30 days
 * time.advance('2h')    // moves forward 2 more hours
 */
export function advance(duration: string): void {
	_offset += parseDuration(duration);
}

/**
 * Sets the virtual clock to a specific absolute timestamp (ms since epoch).
 *
 * @example
 * time.freeze(1700000000000)  // freeze at 2023-11-14T22:13:20.000Z
 */
export function freeze(timestampMs: number): void {
	_frozenAt = timestampMs;
	_offset = timestampMs - _originalDateNow();
}

/**
 * Advances from the current frozen time by the given duration.
 */
export function advanceFromFrozen(duration: string): void {
	if (_frozenAt === null) {
		throw new Error('advanceFromFrozen: clock is not frozen. Call time.freeze() first.');
	}
	_frozenAt += parseDuration(duration);
}

/**
 * Returns a Date object at the virtual current time.
 */
export function virtualDate(): Date {
	return new _originalDate(virtualNow());
}

/**
 * Returns the offset in milliseconds from real time.
 */
export function getOffset(): number {
	return _offset;
}

/**
 * Resets the virtual clock completely — clears offset and unfreezes.
 */
export function reset(): void {
	_offset = 0;
	_frozenAt = null;
}

/**
 * Convenience object for test scripts.
 *
 * @example
 * import { time } from '@intellibiz/testing'
 *
 * it('handles subscription expiry', async () => {
 *   time.advance('31d')
 *   await checkSubscriptions()
 * })
 */
export const time = {
	advance,
	freeze,
	advanceFromFrozen,
	virtualNow,
	virtualDate,
	getOffset,
	reset,
	installVirtualClock,
	restoreRealClock
};
