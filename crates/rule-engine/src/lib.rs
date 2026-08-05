#[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
pub struct RuleContext {
    pub tenant_id: String,
    pub user_role: String,
    pub amount_minor: i64,
    pub currency: String,
    pub country: String,
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct RuleResult {
    pub passed: bool,
    pub applied_rules: Vec<String>,
    pub adjusted_amount_minor: i64,
    pub tax_minor: i64,
    pub discount_minor: i64,
}

pub fn evaluate(ctx: &RuleContext) -> RuleResult {
    let mut result = RuleResult {
        passed: true,
        applied_rules: vec![],
        adjusted_amount_minor: ctx.amount_minor,
        tax_minor: 0,
        discount_minor: 0,
    };

    // VAT rule
    if ctx.country == "GB" {
        let vat = (ctx.amount_minor as f64 * 0.20) as i64;
        result.tax_minor += vat;
        result.adjusted_amount_minor += vat;
        result.applied_rules.push("vat:GB:20%".into());
    } else if ctx.country == "DE" {
        let vat = (ctx.amount_minor as f64 * 0.19) as i64;
        result.tax_minor += vat;
        result.adjusted_amount_minor += vat;
        result.applied_rules.push("vat:DE:19%".into());
    }

    result
}
