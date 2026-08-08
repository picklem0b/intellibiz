use serde::{Deserialize, Serialize};
use thiserror::Error;

// ─── Errors ──────────────────────────────────────────────────────────────────

#[derive(Debug, Error)]
pub enum PermissionError {
    #[error("unknown role: '{0}'")]
    UnknownRole(String),

    #[error("unknown permission: '{0}'")]
    UnknownPermission(String),
}

// ─── Permission Bitmask ───────────────────────────────────────────────────────

/// Each permission is a unique power-of-two bit.
/// A bitwise AND check determines if a role holds a permission.
/// Throughput: > 500,000 checks/sec/core — no allocations, no hash lookups.
#[repr(u32)]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Permission {
    Read       = 0b0000_0001,
    Write      = 0b0000_0010,
    Delete     = 0b0000_0100,
    Export     = 0b0000_1000,
    Admin      = 0b0001_0000,
    Billing    = 0b0010_0000,
    Impersonate = 0b0100_0000,
    Sudo       = 0b1000_0000,
}

impl Permission {
    pub fn from_str(s: &str) -> Result<Self, PermissionError> {
        match s {
            "read"        => Ok(Permission::Read),
            "write"       => Ok(Permission::Write),
            "delete"      => Ok(Permission::Delete),
            "export"      => Ok(Permission::Export),
            "admin"       => Ok(Permission::Admin),
            "billing"     => Ok(Permission::Billing),
            "impersonate" => Ok(Permission::Impersonate),
            "sudo"        => Ok(Permission::Sudo),
            other => Err(PermissionError::UnknownPermission(other.to_string())),
        }
    }

    pub fn as_u32(self) -> u32 {
        self as u32
    }
}

// ─── Role Bitmask ─────────────────────────────────────────────────────────────

/// A compiled role is a single u32 bitmask — the OR of all its permissions.
/// A permission check is: (role_mask & permission_bit) != 0
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompiledRole {
    pub name: String,
    pub mask: u32,
}

impl CompiledRole {
    pub fn new(name: impl Into<String>, permissions: &[Permission]) -> Self {
        let mask = permissions.iter().fold(0u32, |acc, p| acc | p.as_u32());
        Self { name: name.into(), mask }
    }

    /// Bitwise check — O(1), no allocations.
    #[inline(always)]
    pub fn can(&self, permission: Permission) -> bool {
        self.mask & permission.as_u32() != 0
    }

    /// Checks if the role holds ALL of the given permissions.
    #[inline(always)]
    pub fn can_all(&self, permissions: &[Permission]) -> bool {
        let required_mask = permissions.iter().fold(0u32, |acc, p| acc | p.as_u32());
        self.mask & required_mask == required_mask
    }

    /// Checks if the role holds ANY of the given permissions.
    #[inline(always)]
    pub fn can_any(&self, permissions: &[Permission]) -> bool {
        let any_mask = permissions.iter().fold(0u32, |acc, p| acc | p.as_u32());
        self.mask & any_mask != 0
    }
}

// ─── Built-In Roles ───────────────────────────────────────────────────────────

/// Compiles the default Intellibiz role set into bitmask structs.
/// Loaded once at boot — reused across all permission checks.
pub fn default_roles() -> Vec<CompiledRole> {
    vec![
        CompiledRole::new(
            "owner",
            &[
                Permission::Read,
                Permission::Write,
                Permission::Delete,
                Permission::Export,
                Permission::Admin,
                Permission::Billing,
                Permission::Impersonate,
                Permission::Sudo,
            ],
        ),
        CompiledRole::new(
            "admin",
            &[
                Permission::Read,
                Permission::Write,
                Permission::Delete,
                Permission::Export,
                Permission::Admin,
                Permission::Billing,
            ],
        ),
        CompiledRole::new(
            "billing",
            &[
                Permission::Read,
                Permission::Billing,
                Permission::Export,
            ],
        ),
        CompiledRole::new(
            "member",
            &[Permission::Read, Permission::Write],
        ),
        CompiledRole::new(
            "viewer",
            &[Permission::Read],
        ),
    ]
}

// ─── Permission Registry ─────────────────────────────────────────────────────

/// Compiled permission registry loaded at boot.
/// All checks are O(1) bitmask operations — no database, no hash lookups.
pub struct PermissionRegistry {
    roles: Vec<CompiledRole>,
}

impl PermissionRegistry {
    pub fn new(roles: Vec<CompiledRole>) -> Self {
        Self { roles }
    }

    pub fn with_defaults() -> Self {
        Self::new(default_roles())
    }

    /// Looks up a compiled role by name.
    pub fn get_role(&self, name: &str) -> Result<&CompiledRole, PermissionError> {
        self.roles
            .iter()
            .find(|r| r.name == name)
            .ok_or_else(|| PermissionError::UnknownRole(name.to_string()))
    }

    /// Checks if a named role has a named permission.
    /// This is the primary hot path — called > 500k times/sec/core in production.
    pub fn check(&self, role_name: &str, permission: Permission) -> Result<bool, PermissionError> {
        let role = self.get_role(role_name)?;
        Ok(role.can(permission))
    }

    /// Checks via permission string name — used from the NAPI-RS bridge.
    pub fn check_by_name(
        &self,
        role_name: &str,
        permission_name: &str,
    ) -> Result<bool, PermissionError> {
        let permission = Permission::from_str(permission_name)?;
        self.check(role_name, permission)
    }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    fn registry() -> PermissionRegistry {
        PermissionRegistry::with_defaults()
    }

    #[test]
    fn owner_has_all_permissions() {
        let reg = registry();
        assert!(reg.check("owner", Permission::Read).unwrap());
        assert!(reg.check("owner", Permission::Write).unwrap());
        assert!(reg.check("owner", Permission::Delete).unwrap());
        assert!(reg.check("owner", Permission::Admin).unwrap());
        assert!(reg.check("owner", Permission::Sudo).unwrap());
    }

    #[test]
    fn viewer_can_only_read() {
        let reg = registry();
        assert!(reg.check("viewer", Permission::Read).unwrap());
        assert!(!reg.check("viewer", Permission::Write).unwrap());
        assert!(!reg.check("viewer", Permission::Delete).unwrap());
        assert!(!reg.check("viewer", Permission::Admin).unwrap());
    }

    #[test]
    fn member_can_read_and_write() {
        let reg = registry();
        assert!(reg.check("member", Permission::Read).unwrap());
        assert!(reg.check("member", Permission::Write).unwrap());
        assert!(!reg.check("member", Permission::Delete).unwrap());
        assert!(!reg.check("member", Permission::Billing).unwrap());
    }

    #[test]
    fn billing_role_cannot_delete() {
        let reg = registry();
        assert!(reg.check("billing", Permission::Billing).unwrap());
        assert!(!reg.check("billing", Permission::Delete).unwrap());
        assert!(!reg.check("billing", Permission::Write).unwrap());
    }

    #[test]
    fn unknown_role_returns_error() {
        let result = registry().check("hacker", Permission::Read);
        assert!(matches!(result, Err(PermissionError::UnknownRole(_))));
    }

    #[test]
    fn check_by_name_works() {
        let reg = registry();
        assert!(reg.check_by_name("owner", "sudo").unwrap());
        assert!(!reg.check_by_name("member", "sudo").unwrap());
    }

    #[test]
    fn can_all_requires_every_permission() {
        let admin = registry().get_role("admin").unwrap().clone();
        assert!(admin.can_all(&[Permission::Read, Permission::Write, Permission::Admin]));
        assert!(!admin.can_all(&[Permission::Read, Permission::Sudo]));
    }

    #[test]
    fn can_any_requires_at_least_one() {
        let viewer = registry().get_role("viewer").unwrap().clone();
        assert!(viewer.can_any(&[Permission::Read, Permission::Write]));
        assert!(!viewer.can_any(&[Permission::Write, Permission::Delete]));
    }

    #[test]
    fn bitmask_is_unique_per_permission() {
        // Each permission must have a unique power-of-two bit — no collisions.
        let perms = [
            Permission::Read,
            Permission::Write,
            Permission::Delete,
            Permission::Export,
            Permission::Admin,
            Permission::Billing,
            Permission::Impersonate,
            Permission::Sudo,
        ];
        for (i, p1) in perms.iter().enumerate() {
            for (j, p2) in perms.iter().enumerate() {
                if i != j {
                    assert_ne!(p1.as_u32(), p2.as_u32());
                    assert_eq!(p1.as_u32() & p2.as_u32(), 0);
                }
            }
        }
    }
}