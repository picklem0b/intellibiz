// ─── intellibiz/identity — RBAC, tenant resolution, JWT, user context ────────
export { identity, verifyJWT, extractBearerToken, can, canAll, canAny, getRoleMask } from '@intellibiz/identity'
export type { BusinessUser, ActiveTenant, JWTClaims, VerifiedToken } from '@intellibiz/identity'
