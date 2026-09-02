// ─── Virtual Time Travel ────────────────────────────────────────────────────
// test.advanceTime() for subscription/trial simulation.

// ─── State ──────────────────────────────────────────────────────────────────

let virtualOffset = 0;
let frozenTime: number | null = null;
const originalDateNow = Date.now;

// ─── Time Travel API ────────────────────────────────────────────────────────

/**
 * Advance virtual time by a duration string.
 *
 * @example
 * test.advanceTime('30d')   // skip 30 days forward
 * test.advanceTime('2h')    // skip 2 hours forward
 * test.advanceTime('1y')    // skip 1 year forward
 */
export function advanceTime(duration: string): Date {
	const ms = parseDuration(duration);
	virtualOffset += ms;
	return getVirtualNow();
}

/**
 * Set virtual time to a specific date.
 */
export function setTime(date: Date | string | number): Date {
	const target = typeof date === 'string' ? new Date(date).getTime() :
		typeof date === 'number' ? date : date.getTime();
	virtualOffset = target - originalDateNow();
	return getVirtualNow();
}

/**
 * Freeze time at the current moment. All subsequent Date.now() calls
 * return the same value until thawTime() is called.
 */
export function freezeTime(): Date {
	frozenTime = getVirtualNow().getTime();
	return getVirtualNow();
}

/**
 * Unfreeze time and resume normal progression (from where it was frozen).
 */
export function thawTime(): Date {
	frozenTime = null;
	return getVirtualNow();
}

/**
 * Reset virtual time to real time.
 */
export function resetTime(): void {
	virtualOffset = 0;
	frozenTime = null;
}

/**
 * Get the current virtual time.
 */
export function getVirtualNow(): Date {
	if (frozenTime !== null) return new Date(frozenTime);
	return new Date(originalDateNow() + virtualOffset);
}

// ─── Duration Parser ────────────────────────────────────────────────────────

function parseDuration(duration: string): number {
	const match = duration.match(/^(\d+)\s*(ms|s|m|h|d|w|mo|y)$/);
	if (!match) throw new Error(`Invalid duration: ${duration}. Use format: 30d, 2h, 1y`);

	const value = parseInt(match[1]!, 10);
	const unit = match[2];

	switch (unit) {
		case 'ms': return value;
		case 's': return value * 1000;
		case 'm': return value * 60 * 1000;
		case 'h': return value * 60 * 60 * 1000;
		case 'd': return value * 24 * 60 * 60 * 1000;
		case 'w': return value * 7 * 24 * 60 * 60 * 1000;
		case 'mo': return value * 30 * 24 * 60 * 60 * 1000;
		case 'y': return value * 365 * 24 * 60 * 60 * 1000;
		default: throw new Error(`Unknown duration unit: ${unit}`);
	}
}

// ─── Monkey-patch Date.now ──────────────────────────────────────────────────

/**
 * Install the virtual time override on Date.now.
 * Call this at the start of your test suite.
 */
export function installTimeTravel(): void {
	Date.now = () => {
		if (frozenTime !== null) return frozenTime;
		return originalDateNow() + virtualOffset;
	};
}

/**
 * Restore Date.now to the real implementation.
 * Call this at the end of your test suite.
 */
export function restoreTime(): void {
	Date.now = originalDateNow;
	virtualOffset = 0;
	frozenTime = null;
}
