import { getContext } from '@intellibiz/core';
import { can, canAll, canAny, getRoleMask } from './rbac/index.js';
import { verifyJWT, extractBearerToken } from './jwt/index.js';

export { verifyJWT, extractBearerToken } from './jwt/index.js';
export type { JWTClaims, VerifiedToken } from './jwt/index.js';
export { can, canAll, canAny, getRoleMask } from './rbac/index.js';

export interface BusinessUser {
	id: string;
	email: string | null;
	tenantId: string;
	role: string;
}

export interface ActiveTenant {
	id: string;
}

export const identity = {
	/**
	 * Resolves the authenticated user from the current ALS context.
	 * Throws UnauthenticatedError if no user is present.
	 */
	getActiveUser(): BusinessUser {
		const ctx = getContext();
		if (!ctx.userId) throw identity.UnauthenticatedError();
		return {
			id: ctx.userId,
			email: null,
			tenantId: ctx.tenantId,
			role: ctx.role
		};
	},

	/**
	 * Resolves the current tenant from the ALS context.
	 */
	getActiveTenant(): ActiveTenant {
		return { id: getContext().tenantId };
	},

	/**
	 * Returns the current tenant ID from ALS.
	 */
	getTenantId(): string {
		return getContext().tenantId;
	},

	/**
	 * Checks if the current user holds a specific permission.
	 * 500,000+ checks/sec via bitmask evaluation.
	 *
	 * @example
	 * if (!identity.can('billing.admin')) throw identity.ForbiddenError()
	 */
	can,
	canAll,
	canAny,

	/**
	 * Verifies a JWT bearer token and returns the decoded claims.
	 */
	verifyJWT,
	extractBearerToken,

	// ─── Domain Error Factories ────────────────────────────────────────────────

	UnauthenticatedError: () =>
		Object.assign(new Error('Authentication required.'), {
			code: 'UNAUTHENTICATED',
			status: 401
		}),

	ForbiddenError: () =>
		Object.assign(
			new Error('You do not have permission to perform this action.'),
			{
				code: 'FORBIDDEN',
				status: 403
			}
		),

	TenantNotFoundError: () =>
		Object.assign(new Error('Tenant not found.'), {
			code: 'TENANT_NOT_FOUND',
			status: 404
		})
};
