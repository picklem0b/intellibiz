#![deny(clippy::unwrap_used)]

use napi_derive::napi;

use intellibiz_crypto::{
    aes256_decrypt, aes256_encrypt, argon2_hash, argon2_verify, ed25519_generate_keypair,
    ed25519_sign, ed25519_verify, generate_license_key, sha256_hex, verify_license_key,
};
use intellibiz_formula_engine::{
    add, allocate, apply_basis_points, from_minor_units, multiply, subtract, to_minor_units,
    RoundingMode,
};
use intellibiz_ledger::{EntryState, LedgerWriter};
use intellibiz_permissions::{Permission, PermissionRegistry};
use intellibiz_query_planner::{PlannerConfig, QueryOperation, QueryPlanner};
use intellibiz_rule_engine::{evaluate, RuleContext};
use intellibiz_scheduler::{JobPriority, ScheduledJob, Scheduler};
use intellibiz_serializer::{compress, decompress, from_compressed_json, to_compressed_json, to_json};

use std::sync::OnceLock;

// ─── Singletons — loaded once at boot ────────────────────────────────────────

static LEDGER: OnceLock<LedgerWriter> = OnceLock::new();
static PERMISSIONS: OnceLock<PermissionRegistry> = OnceLock::new();
static SCHEDULER: OnceLock<Scheduler> = OnceLock::new();
static QUERY_PLANNER: OnceLock<QueryPlanner> = OnceLock::new();

fn ledger() -> &'static LedgerWriter {
    LEDGER.get_or_init(LedgerWriter::new)
}

fn permissions() -> &'static PermissionRegistry {
    PERMISSIONS.get_or_init(PermissionRegistry::with_defaults)
}

fn scheduler() -> &'static Scheduler {
    SCHEDULER.get_or_init(Scheduler::with_defaults)
}

fn query_planner() -> &'static QueryPlanner {
    QUERY_PLANNER.get_or_init(QueryPlanner::with_defaults)
}

// ─── Build script entrypoint (required by napi-build) ────────────────────────

#[cfg(not(test))]
#[napi::module_init]
fn init() {
    napi_build::setup();
}

// ─── Ledger Bridge ───────────────────────────────────────────────────────────

/// Appends a new ledger entry to the ring buffer.
/// Returns the SHA-256 hash of the new block.
/// All amounts are exact decimal strings — never f64.
///
/// Corresponds to `ledgerWrite(entry)` in docs/architecture/rust-boundary.md §6.
#[napi]
pub fn ledger_write(
    id: String,
    trace_id: String,
    tenant_id: String,
    account_debit: String,
    account_credit: String,
    amount: String,
    currency: String,
) -> napi::Result<String> {
    ledger()
        .write(id, trace_id, tenant_id, account_debit, account_credit, amount, currency)
        .map_err(|e| napi::Error::from_reason(e.to_string()))
}

/// Drains all pending entries from the ring buffer and returns them as a JSON string.
/// Corresponds to `ledgerFlush()` in docs/architecture/rust-boundary.md §6.
#[napi]
pub fn ledger_flush() -> napi::Result<String> {
    let entries = ledger().flush();
    to_json(&entries).map_err(|e| napi::Error::from_reason(e.to_string()))
}

/// Verifies the SHA-256 chain integrity of a batch of ledger entries (JSON string).
#[napi]
pub fn ledger_verify_chain(entries_json: String) -> napi::Result<bool> {
    let entries: Vec<intellibiz_ledger::LedgerEntry> =
        intellibiz_serializer::from_json(&entries_json)
            .map_err(|e| napi::Error::from_reason(e.to_string()))?;
    Ok(LedgerWriter::verify_chain(&entries))
}

// ─── Rule Engine Bridge ───────────────────────────────────────────────────────

/// Evaluates the multi-tier compliance pipeline for a transaction.
/// Returns a JSON string of `RuleResult`.
/// All amounts are exact decimal strings — never f64.
///
/// Corresponds to `ruleEvaluate(ctx)` in docs/architecture/rust-boundary.md §6.
#[napi]
pub async fn rule_evaluate(
    tenant_id: String,
    user_role: String,
    amount: String,
    currency: String,
    country: String,
    region: Option<String>,
    vat_id: Option<String>,
) -> napi::Result<String> {
    tokio::task::spawn_blocking(move || {
        let ctx = RuleContext {
            tenant_id,
            user_role,
            amount,
            currency,
            country,
            region,
            vat_id,
        };
        let result = evaluate(&ctx).map_err(|e| napi::Error::from_reason(e.to_string()))?;
        to_json(&result).map_err(|e| napi::Error::from_reason(e.to_string()))
    })
    .await
    .map_err(|e| napi::Error::from_reason(e.to_string()))?
}

// ─── Formula Engine Bridge ────────────────────────────────────────────────────

/// Converts a decimal string amount to integer minor units.
/// "19.99" + "USD" → 1999
#[napi]
pub fn formula_to_minor_units(amount: String, currency: String) -> napi::Result<i64> {
    to_minor_units(&amount, &currency).map_err(|e| napi::Error::from_reason(e.to_string()))
}

/// Converts integer minor units to a display decimal string.
/// 1999 + "USD" → "19.99"
#[napi]
pub fn formula_from_minor_units(minor: i64, currency: String) -> napi::Result<String> {
    from_minor_units(minor, &currency).map_err(|e| napi::Error::from_reason(e.to_string()))
}

/// Adds two minor-unit amounts.
#[napi]
pub fn formula_add(a: i64, b: i64) -> i64 {
    add(a, b)
}

/// Subtracts b from a in minor units.
#[napi]
pub fn formula_subtract(a: i64, b: i64) -> i64 {
    subtract(a, b)
}

/// Multiplies a minor-unit amount by a decimal factor string.
/// Uses Banker's rounding by default.
#[napi]
pub fn formula_multiply(minor: i64, factor: String, use_bankers_rounding: bool) -> napi::Result<i64> {
    let mode = if use_bankers_rounding {
        RoundingMode::Bankers
    } else {
        RoundingMode::HalfUp
    };
    multiply(minor, &factor, &mode).map_err(|e| napi::Error::from_reason(e.to_string()))
}

/// Applies basis points to a minor-unit amount.
/// 1500 basis points = 15%.
#[napi]
pub fn formula_apply_basis_points(minor: i64, basis_points: u32) -> napi::Result<i64> {
    apply_basis_points(minor, basis_points, &RoundingMode::Bankers)
        .map_err(|e| napi::Error::from_reason(e.to_string()))
}

/// Pro-rata allocation across integer ratios.
/// Returns a JSON array of i64 values.
#[napi]
pub fn formula_allocate(minor: i64, ratios: Vec<u32>) -> napi::Result<Vec<i64>> {
    allocate(minor, &ratios).map_err(|e| napi::Error::from_reason(e.to_string()))
}

// ─── Query Planner Bridge ─────────────────────────────────────────────────────

/// Builds a tenancy-injected WHERE clause string for a table and tenant.
/// Corresponds to `queryPlanWhere(table, tenantId)` in docs/architecture/rust-boundary.md §6.
#[napi]
pub fn query_plan_where(table: String, tenant_id: String) -> napi::Result<String> {
    let plan = query_planner()
        .plan(
            &table,
            QueryOperation::Select,
            Some(&tenant_id),
            None,
            None,
        )
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;
    Ok(QueryPlanner::to_where_clause(&plan))
}

/// Builds a sudo WHERE clause (no tenant injection, all rows including deleted).
/// Emits GovernanceFlag::SudoBypass — caller must log to ledger.
#[napi]
pub fn query_plan_sudo(table: String) -> napi::Result<String> {
    let plan = query_planner()
        .plan_sudo(&table, QueryOperation::Select, None, None)
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;
    Ok(QueryPlanner::to_where_clause(&plan))
}

// ─── Permission Engine Bridge ─────────────────────────────────────────────────

/// Checks if a named role has a named permission.
/// Corresponds to `permissionCheck(role, permission)` in docs/architecture/rust-boundary.md §6.
#[napi]
pub fn permission_check(role: String, permission: String) -> napi::Result<bool> {
    permissions()
        .check_by_name(&role, &permission)
        .map_err(|e| napi::Error::from_reason(e.to_string()))
}

// ─── Crypto Bridge ────────────────────────────────────────────────────────────

/// Computes SHA-256 hex digest of a string.
/// Corresponds to `cryptoSha256(input)` in docs/architecture/rust-boundary.md §6.
#[napi]
pub fn crypto_sha256(input: String) -> String {
    sha256_hex(&input)
}

/// Generates a license key for a tenant and plan.
/// Corresponds to `cryptoGenerateLicense(...)` in docs/architecture/rust-boundary.md §6.
#[napi]
pub fn crypto_generate_license(tenant_id: String, plan: String, secret: String) -> String {
    generate_license_key(&tenant_id, &plan, &secret)
}

/// Verifies a license key.
/// Corresponds to `cryptoVerifyLicense(...)` in docs/architecture/rust-boundary.md §6.
#[napi]
pub fn crypto_verify_license(
    tenant_id: String,
    plan: String,
    secret: String,
    key: String,
) -> bool {
    verify_license_key(&tenant_id, &plan, &secret, &key)
}

/// Hashes a password with Argon2id. Returns the PHC string.
/// Runs on a tokio blocking thread — never blocks the V8 event loop.
#[napi]
pub async fn crypto_argon2_hash(password: String) -> napi::Result<String> {
    tokio::task::spawn_blocking(move || {
        argon2_hash(&password).map_err(|e| napi::Error::from_reason(e.to_string()))
    })
    .await
    .map_err(|e| napi::Error::from_reason(e.to_string()))?
}

/// Verifies a password against an Argon2id PHC hash.
/// Runs on a tokio blocking thread.
#[napi]
pub async fn crypto_argon2_verify(password: String, hash: String) -> napi::Result<bool> {
    tokio::task::spawn_blocking(move || {
        argon2_verify(&password, &hash).map_err(|e| napi::Error::from_reason(e.to_string()))
    })
    .await
    .map_err(|e| napi::Error::from_reason(e.to_string()))?
}

/// Generates a fresh Ed25519 keypair.
/// Returns { signingKey: string, verifyingKey: string } as JSON.
#[napi]
pub fn crypto_ed25519_generate_keypair() -> napi::Result<String> {
    let (sk, vk) = ed25519_generate_keypair();
    to_json(&serde_json::json!({ "signingKey": sk, "verifyingKey": vk }))
        .map_err(|e| napi::Error::from_reason(e.to_string()))
}

/// Signs a message (hex-encoded bytes) with an Ed25519 signing key.
/// Runs on a tokio blocking thread.
#[napi]
pub async fn crypto_ed25519_sign(signing_key_hex: String, message: String) -> napi::Result<String> {
    tokio::task::spawn_blocking(move || {
        let sig = ed25519_sign(&signing_key_hex, message.as_bytes())
            .map_err(|e| napi::Error::from_reason(e.to_string()))?;
        Ok(hex::encode(sig))
    })
    .await
    .map_err(|e| napi::Error::from_reason(e.to_string()))?
}

/// Verifies an Ed25519 signature (hex-encoded).
#[napi]
pub async fn crypto_ed25519_verify(
    verifying_key_hex: String,
    message: String,
    signature_hex: String,
) -> napi::Result<bool> {
    tokio::task::spawn_blocking(move || {
        let sig_bytes = hex::decode(&signature_hex)
            .map_err(|e| napi::Error::from_reason(e.to_string()))?;
        ed25519_verify(&verifying_key_hex, message.as_bytes(), &sig_bytes)
            .map_err(|e| napi::Error::from_reason(e.to_string()))
    })
    .await
    .map_err(|e| napi::Error::from_reason(e.to_string()))?
}

// ─── Scheduler Bridge ─────────────────────────────────────────────────────────

/// Schedules a job to run at a given Unix timestamp (seconds).
#[napi]
pub fn scheduler_enqueue(
    id: String,
    queue: String,
    payload: String,
    run_at_unix: i64,
    tenant_id: String,
    trace_id: String,
) -> napi::Result<()> {
    use chrono::{DateTime, Utc};
    let run_at = DateTime::<Utc>::from_timestamp(run_at_unix, 0)
        .ok_or_else(|| napi::Error::from_reason("invalid unix timestamp"))?;
    let job = ScheduledJob::new(id, queue, payload, run_at, tenant_id, trace_id);
    scheduler()
        .schedule(job)
        .map_err(|e| napi::Error::from_reason(e.to_string()))
}

/// Polls for all jobs that are due at or before the current time.
/// Returns a JSON array of ScheduledJob objects.
#[napi]
pub fn scheduler_poll() -> napi::Result<String> {
    let now = chrono::Utc::now();
    let ready = scheduler().poll(now);
    to_json(&ready).map_err(|e| napi::Error::from_reason(e.to_string()))
}

// ─── Serializer Bridge ────────────────────────────────────────────────────────

/// Compresses raw bytes using zstd.
/// Input and output are base64-encoded strings for safe transport over NAPI.
#[napi]
pub fn serializer_compress(data: Vec<u8>) -> napi::Result<Vec<u8>> {
    compress(&data).map_err(|e| napi::Error::from_reason(e.to_string()))
}

/// Decompresses zstd-compressed bytes.
#[napi]
pub fn serializer_decompress(data: Vec<u8>) -> napi::Result<Vec<u8>> {
    decompress(&data).map_err(|e| napi::Error::from_reason(e.to_string()))
}