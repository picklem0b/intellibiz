use aes_gcm::{
    aead::{Aead, AeadCore, KeyInit, OsRng},
    Aes256Gcm, Key, Nonce,
};
use argon2::{
    password_hash::{rand_core::OsRng as ArgonOsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use ed25519_dalek::{Signature, Signer, SigningKey, Verifier, VerifyingKey};
use sha2::{Digest, Sha256};
use thiserror::Error;

// ─── Errors ──────────────────────────────────────────────────────────────────

#[derive(Debug, Error)]
pub enum CryptoError {
    #[error("invalid signing key bytes")]
    InvalidSigningKey,

    #[error("invalid verifying key bytes")]
    InvalidVerifyingKey,

    #[error("signature verification failed")]
    SignatureVerificationFailed,

    #[error("invalid signature bytes")]
    InvalidSignature,

    #[error("encryption failed: {0}")]
    EncryptionFailed(String),

    #[error("decryption failed: ciphertext may be tampered")]
    DecryptionFailed,

    #[error("password hashing failed: {0}")]
    HashingFailed(String),

    #[error("invalid AES key length — must be 32 bytes")]
    InvalidKeyLength,

    #[error("invalid nonce length — must be 12 bytes")]
    InvalidNonceLength,

    #[error("invalid hex encoding: {0}")]
    InvalidHex(String),
}

// ─── SHA-256 ─────────────────────────────────────────────────────────────────

/// Computes SHA-256 and returns the lowercase hex digest.
/// Used by the ledger for block chaining.
pub fn sha256_hex(input: &str) -> String {
    format!("{:x}", Sha256::digest(input.as_bytes()))
}

/// Computes SHA-256 over raw bytes.
pub fn sha256_bytes(input: &[u8]) -> Vec<u8> {
    Sha256::digest(input).to_vec()
}

// ─── License Keys ─────────────────────────────────────────────────────────────

/// Generates a deterministic HMAC-style license key from tenant_id, plan, and a server secret.
/// Format: XXXX-XXXX-XXXX-XXXX (16 hex chars from the SHA-256 digest, uppercased).
/// This is a V1 implementation. V2 will use Ed25519-signed structured tokens.
pub fn generate_license_key(tenant_id: &str, plan: &str, secret: &str) -> String {
    let payload = format!("{}:{}:{}", tenant_id, plan, secret);
    let hash = sha256_hex(&payload);
    hash[..16]
        .chars()
        .collect::<Vec<char>>()
        .chunks(4)
        .map(|chunk| chunk.iter().collect::<String>().to_uppercase())
        .collect::<Vec<String>>()
        .join("-")
}

/// Verifies a license key against the expected computed value.
pub fn verify_license_key(tenant_id: &str, plan: &str, secret: &str, key: &str) -> bool {
    generate_license_key(tenant_id, plan, secret) == key
}

// ─── Ed25519 Digital Signatures ───────────────────────────────────────────────

/// Signs a message with an Ed25519 signing key (provided as raw 32-byte hex).
/// Used for signing ledger blocks and internal audit tokens.
pub fn ed25519_sign(signing_key_hex: &str, message: &[u8]) -> Result<Vec<u8>, CryptoError> {
    let key_bytes = hex::decode(signing_key_hex)
        .map_err(|e| CryptoError::InvalidHex(e.to_string()))?;
    let key_array: [u8; 32] = key_bytes
        .try_into()
        .map_err(|_| CryptoError::InvalidSigningKey)?;
    let signing_key = SigningKey::from_bytes(&key_array);
    Ok(signing_key.sign(message).to_bytes().to_vec())
}

/// Verifies an Ed25519 signature.
pub fn ed25519_verify(
    verifying_key_hex: &str,
    message: &[u8],
    signature_bytes: &[u8],
) -> Result<bool, CryptoError> {
    let key_bytes = hex::decode(verifying_key_hex)
        .map_err(|e| CryptoError::InvalidHex(e.to_string()))?;
    let key_array: [u8; 32] = key_bytes
        .try_into()
        .map_err(|_| CryptoError::InvalidVerifyingKey)?;
    let verifying_key =
        VerifyingKey::from_bytes(&key_array).map_err(|_| CryptoError::InvalidVerifyingKey)?;

    let sig_array: [u8; 64] = signature_bytes
        .try_into()
        .map_err(|_| CryptoError::InvalidSignature)?;
    let signature = Signature::from_bytes(&sig_array);

    Ok(verifying_key.verify(message, &signature).is_ok())
}

/// Generates a fresh random Ed25519 signing keypair.
/// Returns (signing_key_hex, verifying_key_hex).
pub fn ed25519_generate_keypair() -> (String, String) {
    let signing_key = SigningKey::generate(&mut OsRng);
    let verifying_key = signing_key.verifying_key();
    (
        hex::encode(signing_key.to_bytes()),
        hex::encode(verifying_key.to_bytes()),
    )
}

// ─── AES-256-GCM Symmetric Encryption ────────────────────────────────────────

/// Encrypts plaintext with AES-256-GCM using a random 96-bit nonce.
/// Returns nonce_bytes (12) + ciphertext concatenated.
/// Key must be exactly 32 bytes provided as hex.
pub fn aes256_encrypt(key_hex: &str, plaintext: &[u8]) -> Result<Vec<u8>, CryptoError> {
    let key_bytes = hex::decode(key_hex)
        .map_err(|e| CryptoError::InvalidHex(e.to_string()))?;
    if key_bytes.len() != 32 {
        return Err(CryptoError::InvalidKeyLength);
    }
    let key = Key::<Aes256Gcm>::from_slice(&key_bytes);
    let cipher = Aes256Gcm::new(key);
    let nonce = Aes256Gcm::generate_nonce(&mut OsRng);
    let ciphertext = cipher
        .encrypt(&nonce, plaintext)
        .map_err(|e| CryptoError::EncryptionFailed(e.to_string()))?;

    // Prepend nonce so decryption can extract it.
    let mut output = nonce.to_vec();
    output.extend_from_slice(&ciphertext);
    Ok(output)
}

/// Decrypts AES-256-GCM ciphertext (nonce prepended, 12 bytes).
pub fn aes256_decrypt(key_hex: &str, nonce_and_ciphertext: &[u8]) -> Result<Vec<u8>, CryptoError> {
    if nonce_and_ciphertext.len() < 12 {
        return Err(CryptoError::DecryptionFailed);
    }
    let key_bytes = hex::decode(key_hex)
        .map_err(|e| CryptoError::InvalidHex(e.to_string()))?;
    if key_bytes.len() != 32 {
        return Err(CryptoError::InvalidKeyLength);
    }
    let key = Key::<Aes256Gcm>::from_slice(&key_bytes);
    let cipher = Aes256Gcm::new(key);
    let (nonce_bytes, ciphertext) = nonce_and_ciphertext.split_at(12);
    let nonce = Nonce::from_slice(nonce_bytes);

    cipher
        .decrypt(nonce, ciphertext)
        .map_err(|_| CryptoError::DecryptionFailed)
}

// ─── Argon2id Password Hashing ────────────────────────────────────────────────

/// Hashes a password with Argon2id using a random salt.
/// Returns the full PHC string (includes algorithm, params, salt, and hash).
pub fn argon2_hash(password: &str) -> Result<String, CryptoError> {
    let salt = SaltString::generate(&mut ArgonOsRng);
    let argon2 = Argon2::default();
    argon2
        .hash_password(password.as_bytes(), &salt)
        .map(|hash| hash.to_string())
        .map_err(|e| CryptoError::HashingFailed(e.to_string()))
}

/// Verifies a password against an Argon2id PHC hash string.
pub fn argon2_verify(password: &str, hash: &str) -> Result<bool, CryptoError> {
    let parsed = PasswordHash::new(hash)
        .map_err(|e| CryptoError::HashingFailed(e.to_string()))?;
    Ok(Argon2::default()
        .verify_password(password.as_bytes(), &parsed)
        .is_ok())
}

// ─── Tests ───────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sha256_is_deterministic() {
        let h1 = sha256_hex("intellibiz");
        let h2 = sha256_hex("intellibiz");
        assert_eq!(h1, h2);
        assert_eq!(h1.len(), 64);
    }

    #[test]
    fn license_key_format() {
        let key = generate_license_key("org_123", "pro", "secret");
        let parts: Vec<&str> = key.split('-').collect();
        assert_eq!(parts.len(), 4);
        assert!(parts.iter().all(|p| p.len() == 4));
    }

    #[test]
    fn license_key_verify() {
        let key = generate_license_key("org_123", "pro", "secret");
        assert!(verify_license_key("org_123", "pro", "secret", &key));
        assert!(!verify_license_key("org_456", "pro", "secret", &key));
    }

    #[test]
    fn ed25519_sign_and_verify() {
        let (sk_hex, vk_hex) = ed25519_generate_keypair();
        let message = b"ledger block payload";
        let sig = ed25519_sign(&sk_hex, message).unwrap();
        assert!(ed25519_verify(&vk_hex, message, &sig).unwrap());
    }

    #[test]
    fn ed25519_rejects_tampered_message() {
        let (sk_hex, vk_hex) = ed25519_generate_keypair();
        let sig = ed25519_sign(&sk_hex, b"original").unwrap();
        assert!(!ed25519_verify(&vk_hex, b"tampered", &sig).unwrap());
    }

    #[test]
    fn aes256_round_trip() {
        let key_hex = hex::encode([0u8; 32]);
        let plaintext = b"sensitive tenant data";
        let encrypted = aes256_encrypt(&key_hex, plaintext).unwrap();
        let decrypted = aes256_decrypt(&key_hex, &encrypted).unwrap();
        assert_eq!(decrypted, plaintext);
    }

    #[test]
    fn aes256_rejects_wrong_key() {
        let key1 = hex::encode([0u8; 32]);
        let key2 = hex::encode([1u8; 32]);
        let encrypted = aes256_encrypt(&key1, b"data").unwrap();
        assert!(aes256_decrypt(&key2, &encrypted).is_err());
    }

    #[test]
    fn argon2_hash_and_verify() {
        let hash = argon2_hash("hunter2").unwrap();
        assert!(argon2_verify("hunter2", &hash).unwrap());
        assert!(!argon2_verify("wrong", &hash).unwrap());
    }
}