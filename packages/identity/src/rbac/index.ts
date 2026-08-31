import { getContext } from '@intellibiz/core';

/**
 * V1: Pure TypeScript bitmask RBAC.
 * V2: Delegates to the Rust permissions crate via NAPI-RS bridge for 500k+ checks/sec.
 */

const PERMISSIONS: Record<string, number> = {
	read: 0b0000_0001,
	write: 0b0000_0010,
	delete: 0b0000_0100,
	export: 0b0000_1000,
	admin: 0b0001_0000,
	billing: 0b0010_0000,
	impersonate: 0b0100_0000,
	sudo: 0b1000_0000
};

const ROLES: Record<string, number> = {
	owner: 0b1111_1111,
	admin: 0b0011_1111,
	billing: 0b0010_1001,
	member: 0b0000_0011,
	viewer: 0b0000_0001,
	anonymous: 0b0000_0000
};

function roleMask(role: string): number {
	return ROLES[role] ?? 0;
}

/**
 * Checks if the current user holds a specific permission.
 * O(1) bitmask evaluation — no database query, no heap allocation.
 *
 * @example
 * if (!can('billing')) throw identity.ForbiddenError()
 */
export function can(permission: string): boolean {
	const ctx = getContext();
	const mask = roleMask(ctx.role);
	const bit = PERMISSIONS[permission];
	if (bit === undefined) return false;
	return (mask & bit) !== 0;
}

/**
 * Checks if the current user holds ALL of the given permissions.
 */
export function canAll(permissions: string[]): boolean {
	return permissions.every(p => can(p));
}

/**
 * Checks if the current user holds ANY of the given permissions.
 */
export function canAny(permissions: string[]): boolean {
	return permissions.some(p => can(p));
}

/**
 * Returns the compiled bitmask for a given role name.
 * Used by the NAPI bridge and tests.
 */
export function getRoleMask(role: string): number {
	return roleMask(role);
}
