use sha2::{Digest, Sha256};

pub fn sha256_hex(input: &str) -> String {
    format!("{:x}", Sha256::digest(input.as_bytes()))
}

pub fn generate_license_key(tenant_id: &str, plan: &str, secret: &str) -> String {
    let raw = format!("{}:{}:{}", tenant_id, plan, secret);
    let hash = sha256_hex(&raw);
    // Format as XXXX-XXXX-XXXX-XXXX
    hash[..16]
        .chars()
        .collect::<Vec<char>>()
        .chunks(4)
        .map(|c| c.iter().collect::<String>().to_uppercase())
        .collect::<Vec<String>>()
        .join("-")
}

pub fn verify_license_key(tenant_id: &str, plan: &str, secret: &str, key: &str) -> bool {
    generate_license_key(tenant_id, plan, secret) == key
}
