use napi_derive::napi;
use intellibiz_ledger::{LedgerEntry, LedgerWriter};
use intellibiz_rule_engine::{RuleContext, evaluate};
use intellibiz_formula_engine::{add, subtract, apply_percentage, minor_to_display};
use intellibiz_crypto::{sha256_hex, generate_license_key, verify_license_key};
use intellibiz_query_planner::QueryPlan;

static LEDGER: std::sync::OnceLock<LedgerWriter> = std::sync::OnceLock::new();

fn ledger() -> &'static LedgerWriter {
    LEDGER.get_or_init(LedgerWriter::new)
}

#[napi]
pub fn ledger_write(
    id: String,
    tenant_id: String,
    action: String,
    amount_minor: i64,
    currency: String,
    timestamp: u64,
) {
    let entry = LedgerEntry::new(id, tenant_id, action, amount_minor, currency, timestamp);
    ledger().write(entry);
}

#[napi]
pub fn ledger_flush() -> String {
    let entries = ledger().flush();
    serde_json::to_string(&entries).unwrap_or_default()
}

#[napi]
pub fn rule_evaluate(
    tenant_id: String,
    user_role: String,
    amount_minor: i64,
    currency: String,
    country: String,
) -> String {
    let ctx = RuleContext { tenant_id, user_role, amount_minor, currency, country };
    let result = evaluate(&ctx);
    serde_json::to_string(&result).unwrap_or_default()
}

#[napi]
pub fn formula_add(a: i64, b: i64) -> i64 {
    add(a, b)
}

#[napi]
pub fn formula_apply_percentage(amount: i64, basis_points: u32) -> i64 {
    apply_percentage(amount, basis_points)
}

#[napi]
pub fn formula_display(minor: i64, decimals: u8) -> String {
    minor_to_display(minor, decimals)
}

#[napi]
pub fn crypto_sha256(input: String) -> String {
    sha256_hex(&input)
}

#[napi]
pub fn crypto_generate_license(tenant_id: String, plan: String, secret: String) -> String {
    generate_license_key(&tenant_id, &plan, &secret)
}

#[napi]
pub fn crypto_verify_license(tenant_id: String, plan: String, secret: String, key: String) -> bool {
    verify_license_key(&tenant_id, &plan, &secret, &key)
}

#[napi]
pub fn query_plan_where(table: String, tenant_id: String) -> String {
    let plan = QueryPlan::new(&table, &tenant_id);
    plan.to_where_clause()
}
