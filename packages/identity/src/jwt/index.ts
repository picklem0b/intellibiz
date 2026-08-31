import { jwtVerify, createHmac } from 'jose';
import type { JWTPayload } from 'jose';

export interface JWTClaims extends JWTPayload {
	sub: string;
	tenant_id: string;
	roles?: string[];
	role?: string;
	email?: string;
}

export interface VerifiedToken {
	userId: string;
	tenantId: string;
	role: string;
	email: string | null;
	raw: JWTClaims;
}

/**
 * Verifies a JWT bearer token using HS256 or RS256.
 * Extracted claims: sub → userId, tenant_id → tenantId, roles → role.
 */
export async function verifyJWT(
	token: string,
	secret: string,
	algorithm: 'HS256' | 'RS256' = 'HS256'
): Promise<VerifiedToken> {
	const key = new TextEncoder().encode(secret);

	const { payload } = await jwtVerify(token, key, {
		algorithms: [algorithm]
	});

	const claims = payload as JWTClaims;

	if (!claims.sub) throw new Error('JWT missing sub claim');
	if (!claims.tenant_id) throw new Error('JWT missing tenant_id claim');

	const role = claims.roles?.[0] ?? claims.role ?? 'member';

	return {
		userId: claims.sub,
		tenantId: claims.tenant_id,
		role,
		email: claims.email ?? null,
		raw: claims
	};
}

/**
 * Extracts the bearer token from an Authorization header value.
 * Returns null if the header is missing or malformed.
 */
export function extractBearerToken(
	authHeader: string | null | undefined
): string | null {
	if (!authHeader) return null;
	const match = authHeader.match(/^Bearer\s+(.+)$/i);
	return match?.[1] ?? null;
}
