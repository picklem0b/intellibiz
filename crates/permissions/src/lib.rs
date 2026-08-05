#[derive(Debug, Clone, PartialEq)]
pub enum Permission {
    Read,
    Write,
    Delete,
    Export,
    Admin,
}

#[derive(Debug, Clone)]
pub struct Role {
    pub name: String,
    pub permissions: Vec<Permission>,
}

pub fn can(role: &Role, permission: &Permission) -> bool {
    role.permissions.contains(permission)
}

pub fn default_roles() -> Vec<Role> {
    vec![
        Role {
            name: "owner".into(),
            permissions: vec![
                Permission::Read,
                Permission::Write,
                Permission::Delete,
                Permission::Export,
                Permission::Admin,
            ],
        },
        Role {
            name: "member".into(),
            permissions: vec![Permission::Read, Permission::Write],
        },
        Role {
            name: "viewer".into(),
            permissions: vec![Permission::Read],
        },
    ]
}
