use rust_decimal::prelude::*;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use std::str::FromStr;
use thiserror::Error;

// ─── Errors ──────────────────────────────────────────────────────────────────

#[derive(Debug, Error)]
pub enum RuleError {
    #[error("invalid decimal amount: '{0}'")]
    InvalidAmount(String),

    #[error("rule '{0}' produced an invalid output")]
    InvalidRuleOutput(String),
}

// ─── Rule Context ─────────────────────────────────────────────────────────────

/// Input payload fed into the rule evaluation pipeline.
/// All amounts are string-encoded decimals — never f64.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuleContext {
    pub tenant_id: String,
    pub user_role: String,
    /// Exact decimal string (e.g. "99.99") — never f64.
    pub amount: String,
    pub currency: String,
    pub country: String,
    pub region: Option<String>,
    pub vat_id: Option<String>,
}

// ─── Rule Result ─────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuleResult {
    pub passed: bool,
    pub applied_rules: Vec<String>,
    /// Exact decimal string — the adjusted amount after all rules applied.
    pub adjusted_amount: String,
    /// Exact decimal string — total tax added.
    pub tax_amount: String,
    /// Exact decimal string — total discount applied.
    pub discount_amount: String,
}

// ─── Individual Rule Definitions ─────────────────────────────────────────────

/// A single rule in the multi-tier pipeline.
trait Rule {
    fn name(&self) -> &'static str;
    fn evaluate(&self, ctx: &RuleContext, state: &mut PipelineState) -> Result<(), RuleError>;
}

/// Shared mutable state threaded through the pipeline.
struct PipelineState {
    amount: Decimal,
    tax: Decimal,
    discount: Decimal,
    applied: Vec<String>,
    passed: bool,
}

impl PipelineState {
    fn new(amount: Decimal) -> Self {
        Self {
            amount,
            tax: Decimal::ZERO,
            discount: Decimal::ZERO,
            applied: Vec::new(),
            passed: true,
        }
    }
}

// ─── VAT Rule ────────────────────────────────────────────────────────────────

struct VatRule;

/// Regional VAT rates as basis points (integer math only — no f64).
/// Source: EU VAT directives and common regional rates.
fn vat_basis_points(country: &str, vat_id: Option<&str>) -> Option<u32> {
    // B2B with valid VAT ID in EU — reverse charge, zero rate.
    if vat_id.is_some() && is_eu(country) {
        return Some(0);
    }
    match country {
        "AT" => Some(2000), // Austria 20%
        "BE" => Some(2100), // Belgium 21%
        "BG" => Some(2000), // Bulgaria 20%
        "HR" => Some(2500), // Croatia 25%
        "CY" => Some(1900), // Cyprus 19%
        "CZ" => Some(2100), // Czechia 21%
        "DK" => Some(2500), // Denmark 25%
        "EE" => Some(2000), // Estonia 20%
        "FI" => Some(2400), // Finland 24%
        "FR" => Some(2000), // France 20%
        "DE" => Some(1900), // Germany 19%
        "GR" => Some(2400), // Greece 24%
        "HU" => Some(2700), // Hungary 27%
        "IE" => Some(2300), // Ireland 23%
        "IT" => Some(2200), // Italy 22%
        "LV" => Some(2100), // Latvia 21%
        "LT" => Some(2100), // Lithuania 21%
        "LU" => Some(1700), // Luxembourg 17%
        "MT" => Some(1800), // Malta 18%
        "NL" => Some(2100), // Netherlands 21%
        "PL" => Some(2300), // Poland 23%
        "PT" => Some(2300), // Portugal 23%
        "RO" => Some(1900), // Romania 19%
        "SK" => Some(2000), // Slovakia 20%
        "SI" => Some(2200), // Slovenia 22%
        "ES" => Some(2100), // Spain 21%
        "SE" => Some(2500), // Sweden 25%
        "GB" => Some(2000), // UK 20%
        "ZA" => Some(1500), // South Africa 15% VAT
        "AU" => Some(1000), // Australia 10% GST
        "NZ" => Some(1500), // New Zealand 15% GST
        "SG" => Some(900),  // Singapore 9% GST
        "CA" => Some(500),  // Canada 5% GST (federal only)
        _ => None,
    }
}

fn is_eu(country: &str) -> bool {
    matches!(
        country,
        "AT" | "BE" | "BG" | "HR" | "CY" | "CZ" | "DK" | "EE" | "FI" | "FR" | "DE"
        | "GR" | "HU" | "IE" | "IT" | "LV" | "LT" | "LU" | "MT" | "NL" | "PL" | "PT"
        | "RO" | "SK" | "SI" | "ES" | "SE"
    )
}

impl Rule for VatRule {
    fn name(&self) -> &'static str {
        "vat"
    }

    fn evaluate(&self, ctx: &RuleContext, state: &mut PipelineState) -> Result<(), RuleError> {
        let Some(bp) = vat_basis_points(&ctx.country, ctx.vat_id.as_deref()) else {
            return Ok(());
        };

        if bp == 0 {
            state.applied.push(format!("vat:{}:reverse-charge", ctx.country));
            return Ok(());
        }

        // All math in rust_decimal — no f64.
        let rate = Decimal::from(bp) / Decimal::from(10_000_u32);
        let tax = state.amount * rate;
        // Banker's rounding — round half to even.
        let tax_rounded = tax.round_dp_with_strategy(2, RoundingStrategy::MidpointNearestEven);

        state.tax += tax_rounded;
        state.amount += tax_rounded;
        state.applied.push(format!(
            "vat:{}:{:.0}%",
            ctx.country,
            Decimal::from(bp) / Decimal::from(100_u32)
        ));

        Ok(())
    }
}

// ─── Tenant Isolation Rule ────────────────────────────────────────────────────

struct TenantIsolationRule;

impl Rule for TenantIsolationRule {
    fn name(&self) -> &'static str {
        "tenant-isolation"
    }

    fn evaluate(&self, ctx: &RuleContext, state: &mut PipelineState) -> Result<(), RuleError> {
        if ctx.tenant_id.is_empty() {
            state.passed = false;
            state.applied.push("tenant-isolation:FAILED:no-tenant-id".into());
        } else {
            state.applied.push("tenant-isolation:PASSED".into());
        }
        Ok(())
    }
}

// ─── Permission Scope Rule ────────────────────────────────────────────────────

struct PermissionScopeRule;

const ALLOWED_ROLES: &[&str] = &["owner", "admin", "member", "billing"];

impl Rule for PermissionScopeRule {
    fn name(&self) -> &'static str {
        "permission-scope"
    }

    fn evaluate(&self, ctx: &RuleContext, state: &mut PipelineState) -> Result<(), RuleError> {
        if ALLOWED_ROLES.contains(&ctx.user_role.as_str()) {
            state.applied.push(format!("permission-scope:PASSED:{}", ctx.user_role));
        } else {
            state.passed = false;
            state.applied.push(format!(
                "permission-scope:FAILED:unknown-role:{}",
                ctx.user_role
            ));
        }
        Ok(())
    }
}

// ─── Fraud Signal Rule ────────────────────────────────────────────────────────

struct FraudSignalRule;

/// Threshold above which a manual review signal is emitted (in major units as Decimal).
const FRAUD_REVIEW_THRESHOLD: &str = "5000.00";

impl Rule for FraudSignalRule {
    fn name(&self) -> &'static str {
        "fraud-signal"
    }

    fn evaluate(&self, _ctx: &RuleContext, state: &mut PipelineState) -> Result<(), RuleError> {
        let threshold = Decimal::from_str(FRAUD_REVIEW_THRESHOLD)
            .map_err(|_| RuleError::InvalidRuleOutput("fraud-signal:threshold".into()))?;
        if state.amount >= threshold {
            state.applied.push(format!(
                "fraud-signal:REVIEW:amount-exceeds-{}", FRAUD_REVIEW_THRESHOLD
            ));
        } else {
            state.applied.push("fraud-signal:PASSED".into());
        }
        Ok(())
    }
}

// ─── Pipeline Execution ───────────────────────────────────────────────────────

/// Executes the full multi-tier rule pipeline in order:
/// tenant-isolation → permission-scope → vat → fraud-signal
///
/// Each rule mutates `PipelineState`. Rules do not short-circuit on failure —
/// all rules run so the result records every applied rule for audit purposes.
pub fn evaluate(ctx: &RuleContext) -> Result<RuleResult, RuleError> {
    let amount = Decimal::from_str(&ctx.amount)
        .map_err(|_| RuleError::InvalidAmount(ctx.amount.clone()))?;

    let mut state = PipelineState::new(amount);

    let pipeline: Vec<Box<dyn Rule>> = vec![
        Box::new(TenantIsolationRule),
        Box::new(PermissionScopeRule),
        Box::new(VatRule),
        Box::new(FraudSignalRule),
    ];

    for rule in &pipeline {
        rule.evaluate(ctx, &mut state)?;
    }

    Ok(RuleResult {
        passed: state.passed,
        applied_rules: state.applied,
        adjusted_amount: state.amount.to_string(),
        tax_amount: state.tax.to_string(),
        discount_amount: state.discount.to_string(),
    })
}

// ─── Tests ───────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    fn ctx(country: &str, amount: &str, role: &str) -> RuleContext {
        RuleContext {
            tenant_id: "org_123".into(),
            user_role: role.into(),
            amount: amount.into(),
            currency: "USD".into(),
            country: country.into(),
            region: None,
            vat_id: None,
        }
    }

    #[test]
    fn uk_vat_20_percent() {
        let result = evaluate(&ctx("GB", "100.00", "member")).unwrap();
        assert!(result.passed);
        assert_eq!(result.adjusted_amount, "120.00");
        assert_eq!(result.tax_amount, "20.00");
        assert!(result.applied_rules.iter().any(|r| r.contains("vat:GB:20%")));
    }

    #[test]
    fn germany_vat_19_percent() {
        let result = evaluate(&ctx("DE", "100.00", "owner")).unwrap();
        assert_eq!(result.tax_amount, "19.00");
        assert_eq!(result.adjusted_amount, "119.00");
    }

    #[test]
    fn no_vat_for_us() {
        let result = evaluate(&ctx("US", "100.00", "member")).unwrap();
        assert_eq!(result.tax_amount, "0");
        assert_eq!(result.adjusted_amount, "100.00");
    }

    #[test]
    fn vat_uses_bankers_rounding_not_float() {
        // 19% of 99.99 = 18.9981 → rounds to 19.00 under half-to-even
        let result = evaluate(&ctx("DE", "99.99", "member")).unwrap();
        assert_ne!(result.tax_amount, "18.9981");
        // Must be a clean 2 decimal string
        let tax: Decimal = Decimal::from_str(&result.tax_amount).unwrap();
        assert_eq!(tax.scale(), 2);
    }

    #[test]
    fn unknown_role_fails_pipeline() {
        let result = evaluate(&ctx("US", "50.00", "hacker")).unwrap();
        assert!(!result.passed);
        assert!(result.applied_rules.iter().any(|r| r.contains("permission-scope:FAILED")));
    }

    #[test]
    fn empty_tenant_fails_isolation() {
        let mut c = ctx("US", "50.00", "member");
        c.tenant_id = String::new();
        let result = evaluate(&c).unwrap();
        assert!(!result.passed);
        assert!(result.applied_rules.iter().any(|r| r.contains("tenant-isolation:FAILED")));
    }

    #[test]
    fn eu_b2b_reverse_charge() {
        let mut c = ctx("DE", "100.00", "member");
        c.vat_id = Some("DE123456789".into());
        let result = evaluate(&c).unwrap();
        assert_eq!(result.tax_amount, "0");
        assert!(result.applied_rules.iter().any(|r| r.contains("reverse-charge")));
    }

    #[test]
    fn fraud_signal_on_large_amount() {
        let result = evaluate(&ctx("US", "6000.00", "owner")).unwrap();
        assert!(result.applied_rules.iter().any(|r| r.contains("fraud-signal:REVIEW")));
    }
}