import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Shared cryptographic primitives for verifying inbound payment-provider
 * webhooks. These are intentionally dependency-free (Node's `node:crypto`) and
 * use constant-time comparison so a valid signature cannot be brute-forced
 * byte-by-byte via response timing.
 *
 * Per docs/SYNTAX_AND_LIBRARIES.md §3.4 — "[Signature Verification] validates
 * HMAC SHA-256 header secret".
 */

/** HMAC-SHA256 of `payload` with `secret`, lowercase hex. Used by Stripe. */
export function hmacSha256Hex(secret: string, payload: string): string {
	return createHmac('sha256', secret).update(payload, 'utf8').digest('hex');
}

/** HMAC-SHA512 of `payload` with `secret`, lowercase hex. Used by Ozow. */
export function hmacSha512Hex(secret: string, payload: string): string {
	return createHmac('sha512', secret).update(payload, 'utf8').digest('hex');
}

/**
 * MD5 digest (lowercase hex). PayFast signs with a plain MD5 over the ordered
 * field string plus the merchant passphrase — not an HMAC.
 */
export function md5Hex(payload: string): string {
	return createHash('md5').update(payload, 'utf8').digest('hex');
}

/**
 * Constant-time comparison of two lowercase/uppercase hex digests.
 * Returns false for empty or length-mismatched inputs instead of throwing.
 */
export function timingSafeEqualHex(a: string, b: string): boolean {
	const bufA = Buffer.from(a, 'hex');
	const bufB = Buffer.from(b, 'hex');
	if (bufA.length === 0 || bufA.length !== bufB.length) return false;
	return timingSafeEqual(bufA, bufB);
}

/**
 * Stripe signature header parser.
 *
 * The `Stripe-Signature` header is a comma-separated list of `key=value`
 * pairs, e.g. `t=1492774577,v1=5257a869...,v1=<previous-key>`. Multiple `v1`
 * entries appear during secret rotation; any match is accepted.
 */
export interface ParsedStripeSignature {
	/** Raw `t` value, verbatim — used as the HMAC timestamp prefix. */
	readonly timestamp: string | null;
	/** All `v1` signatures present in the header. */
	readonly signatures: string[];
}

export function parseStripeSignatureHeader(
	header: string
): ParsedStripeSignature {
	const signatures: string[] = [];
	let timestamp: string | null = null;

	for (const part of header.split(',')) {
		const separator = part.indexOf('=');
		if (separator === -1) continue;
		const key = part.slice(0, separator).trim();
		const value = part.slice(separator + 1).trim();
		if (!value) continue;
		if (key === 't') timestamp = value;
		else if (key === 'v1') signatures.push(value);
	}

	return { timestamp, signatures };
}
