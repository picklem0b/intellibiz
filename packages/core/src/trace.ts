import { randomBytes } from 'node:crypto';

/**
 * Generates a high-entropy, lexically sortable trace ID.
 *
 * Format: ibiz_trc_{12-char timestamp hex}{16-char random hex}
 * - Timestamp prefix enables chronological sorting and time-range filtering in logs
 * - Random suffix provides collision resistance across concurrent requests
 *
 * @example
 * createTraceId() // 'ibiz_trc_0192ab3d8f4c1e2d9a7b3c4d5e6f7a8b'
 */
export function createTraceId(): string {
	const timestamp = Date.now().toString(16).padStart(12, '0');
	const random = randomBytes(8).toString('hex');
	return `ibiz_trc_${timestamp}${random}`;
}

/**
 * Creates a deterministic trace ID for testing purposes.
 * Never use in production — predictable IDs are a security liability.
 */
export function createTestTraceId(seed: string): string {
	return `ibiz_tst_${seed.padEnd(20, '0').slice(0, 20)}`;
}

/**
 * Returns true if the string is a valid Intellibiz trace ID.
 */
export function isTraceId(value: string): boolean {
	return /^ibiz_(trc|tst)_[0-9a-f]{28}$/.test(value);
}
