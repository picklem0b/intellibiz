import { describe, it, expect } from 'vitest';
import { verifyJWT, extractBearerToken, type JWTClaims } from '../jwt/index.js';
import * as jose from 'jose';

// Helper to create a valid JWT for testing
async function createTestJWT(
	payload: Record<string, unknown>,
	secret: string,
	algorithm: 'HS256' | 'RS256' = 'HS256'
): Promise<string> {
	const encoder = new TextEncoder();
	const key = encoder.encode(secret);
	return new jose.SignJWT(payload as jose.JWTPayload)
		.setProtectedHeader({ alg: algorithm })
		.setIssuedAt()
		.sign(key);
}

describe('JWT Verification', () => {
	const SECRET = 'test-secret-key-for-jwt-signing';

	describe('verifyJWT', () => {
		it('verifies a valid HS256 token', async () => {
			const token = await createTestJWT({
				sub: 'usr_123',
				tenant_id: 'org_abc',
				roles: ['admin']
			}, SECRET);

			const result = await verifyJWT(token, SECRET, 'HS256');

			expect(result.userId).toBe('usr_123');
			expect(result.tenantId).toBe('org_abc');
			expect(result.role).toBe('admin');
		});

		it('extracts email from claims', async () => {
			const token = await createTestJWT({
				sub: 'usr_1',
				tenant_id: 'org_1',
				email: 'user@example.com'
			}, SECRET);

			const result = await verifyJWT(token, SECRET);
			expect(result.email).toBe('user@example.com');
		});

		it('returns null email when not in claims', async () => {
			const token = await createTestJWT({
				sub: 'usr_1',
				tenant_id: 'org_1'
			}, SECRET);

			const result = await verifyJWT(token, SECRET);
			expect(result.email).toBeNull();
		});

		it('defaults role to "member" when not in claims', async () => {
			const token = await createTestJWT({
				sub: 'usr_1',
				tenant_id: 'org_1'
			}, SECRET);

			const result = await verifyJWT(token, SECRET);
			expect(result.role).toBe('member');
		});

		it('uses role field when roles array is not present', async () => {
			const token = await createTestJWT({
				sub: 'usr_1',
				tenant_id: 'org_1',
				role: 'billing'
			}, SECRET);

			const result = await verifyJWT(token, SECRET);
			expect(result.role).toBe('billing');
		});

		it('throws on missing sub claim', async () => {
			const token = await createTestJWT({
				tenant_id: 'org_1'
			}, SECRET);

			await expect(verifyJWT(token, SECRET)).rejects.toThrow('missing sub');
		});

		it('throws on missing tenant_id claim', async () => {
			const token = await createTestJWT({
				sub: 'usr_1'
			}, SECRET);

			await expect(verifyJWT(token, SECRET)).rejects.toThrow('missing tenant_id');
		});

		it('throws on invalid signature', async () => {
			const token = await createTestJWT({
				sub: 'usr_1',
				tenant_id: 'org_1'
			}, SECRET);

			await expect(verifyJWT(token, 'wrong-secret')).rejects.toThrow();
		});

		it('returns raw claims', async () => {
			const token = await createTestJWT({
				sub: 'usr_1',
				tenant_id: 'org_1',
				custom: 'value'
			}, SECRET);

			const result = await verifyJWT(token, SECRET);
			expect(result.raw.sub).toBe('usr_1');
			expect(result.raw.tenant_id).toBe('org_1');
		});
	});

	describe('extractBearerToken', () => {
		it('extracts token from Bearer header', () => {
			expect(extractBearerToken('Bearer abc123')).toBe('abc123');
		});

		it('is case-insensitive for Bearer keyword', () => {
			expect(extractBearerToken('bearer abc123')).toBe('abc123');
			expect(extractBearerToken('BEARER abc123')).toBe('abc123');
		});

		it('returns null for missing header', () => {
			expect(extractBearerToken(null)).toBeNull();
			expect(extractBearerToken(undefined)).toBeNull();
		});

		it('returns null for non-Bearer header', () => {
			expect(extractBearerToken('Basic abc123')).toBeNull();
		});

		it('returns null for empty string', () => {
			expect(extractBearerToken('')).toBeNull();
		});

		it('handles token with spaces', () => {
			expect(extractBearerToken('Bearer token.with.spaces')).toBe('token.with.spaces');
		});
	});
});
