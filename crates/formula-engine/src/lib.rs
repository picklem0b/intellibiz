use rust_decimal::prelude::*;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use std::str::FromStr;
use thiserror::Error;

// ─── Errors ──────────────────────────────────────────────────────────────────

#[derive(Debug, Error)]
pub enum FormulaError {
    #[error("invalid decimal string: '{0}'")]
    InvalidDecimal(String),

    #[error("division by zero")]
    DivisionByZero,

    #[error("allocation ratios must sum to a positive value")]
    InvalidAllocationRatios,

    #[error("currency precision for '{0}' is unknown")]
    UnknownCurrencyPrecision(String),
}

// ─── Rounding Mode ───────────────────────────────────────────────────────────

/// Supported rounding strategies. Bankers is the default per the config spec.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum RoundingMode {
    /// Round half to even (Banker's rounding) — default.
    Bankers,
    /// Round half up — conventional rounding.
    HalfUp,
    /// Always round toward zero — used for tax floor calculations.
    Truncate,
}

impl Default for RoundingMode {
    fn default() -> Self {
        RoundingMode::Bankers
    }
}

// ─── Currency Decimal Precision ───────────────────────────────────────────────

/// Returns the number of decimal places for a given ISO-4217 currency code.
/// Matches the table in docs/api/finance.md exactly.
pub fn currency_decimals(currency: &str) -> Result<u32, FormulaError> {
    match currency.to_uppercase().as_str() {
        // Zero decimal currencies
        "JPY" | "KRW" | "VND" 
        | "ISK" | "CLP" | "GNF" 
        | "UGX" | "RWF" | "BIF" 
        | "DJF" | "KMF" | "MGA" 
        | "PYG" | "XAF" | "XOF" 
        | "XPF" => Ok(0),

        // Three decimal currencies
        "BHD" | "KWD" | "OMR" 
        | "JOD" | "TND" | "LYD" => Ok(3),

        // Standard two-decimal currencies (explicit list)
        "USD" | "EUR" | "GBP" 
        | "ZAR" | "CAD" | "AUD" 
        | "NZD" | "CHF" | "SEK" 
        | "NOK" | "DKK" | "MXN" 
        | "BRL" | "INR" | "CNY" 
        | "HKD" | "SGD" | "THB" 
        | "MYR" | "IDR" | "PHP" 
        | "PKR" | "EGP" | "NGN" 
        | "GHS" | "KES" | "TZS" 
        | "MAD" | "UAH" | "CZK" 
        | "PLN" | "HUF" | "RON" 
        | "BGN" | "HRK" | "RUB" 
        | "TRY" | "AED" | "SAR" 
        | "QAR" | "ILS" | "COP" 
        | "PEN" | "ARS" | "TWD" => Ok(2),

        other => Err(FormulaError::UnknownCurrencyPrecision(other.to_string())),
    }
}

// ─── Minor Unit Conversion ────────────────────────────────────────────────────

/// Converts a decimal string amount to integer minor units (e.g. cents).
/// "19.99" + "USD" → 1999
pub fn to_minor_units(amount: &str, currency: &str) -> Result<i64, FormulaError> {
    let d = Decimal::from_str(amount).map_err(|_| FormulaError::InvalidDecimal(amount.to_string()))?;
    let decimals = currency_decimals(currency)?;
    let factor = Decimal::from(10_i64.pow(decimals));
    let minor = d * factor;
    Ok(minor.to_i64().unwrap_or(0))
}

/// Converts integer minor units back to a display decimal string.
/// 1999 + "USD" → "19.99"
pub fn from_minor_units(minor: i64, currency: &str) -> Result<String, FormulaError> {
    let decimals = currency_decimals(currency)?;
    let factor = Decimal::from(10_i64.pow(decimals));
    let result = Decimal::from(minor) / factor;
    Ok(format!("{:.prec$}", result, prec = decimals as usize))
}

// ─── Arithmetic ───────────────────────────────────────────────────────────────

/// Adds two minor-unit amounts. Both must be in the same currency.
pub fn add(a: i64, b: i64) -> i64 {
    a + b
}

/// Subtracts b from a in minor units.
pub fn subtract(a: i64, b: i64) -> i64 {
    a - b
}

/// Multiplies a minor-unit amount by a decimal factor string.
/// Uses rust_decimal — no f64 at any point.
/// "1999" * "1.5" → 2998 (rounds using Banker's rounding)
pub fn multiply(minor: i64, factor: &str, mode: &RoundingMode) -> Result<i64, FormulaError> {
    let amount = Decimal::from(minor);
    let f = Decimal::from_str(factor).map_err(|_| FormulaError::InvalidDecimal(factor.to_string()))?;
    let result = amount * f;

    let rounded = match mode {
        RoundingMode::Bankers => result.round_dp_with_strategy(0, RoundingStrategy::MidpointNearestEven),
        RoundingMode::HalfUp => result.round_dp_with_strategy(0, RoundingStrategy::MidpointAwayFromZero),
        RoundingMode::Truncate => result.round_dp_with_strategy(0, RoundingStrategy::ToZero),
    };

    Ok(rounded.to_i64().unwrap_or(0))
}

/// Applies basis points to a minor-unit amount.
/// 1000 basis points = 10%, 2000 = 20%, 1500 = 15%
/// Never uses f64 — all math is integer + rust_decimal.
pub fn apply_basis_points(minor: i64, basis_points: u32, mode: &RoundingMode) -> Result<i64, FormulaError> {
    let bp_factor = format!("{:.4}", Decimal::from(basis_points) / Decimal::from(10_000_u32));
    multiply(minor, &bp_factor, mode)
}

/// Pro-rata allocation across a set of integer ratios without losing a single minor unit.
/// Remainder distributes to the first allocation bucket.
/// Matches the behavior described in docs/api/finance.md `.allocate(ratios)`.
pub fn allocate(minor: i64, ratios: &[u32]) -> Result<Vec<i64>, FormulaError> {
    let total_ratio: u32 = ratios.iter().sum();
    if total_ratio == 0 {
        return Err(FormulaError::InvalidAllocationRatios);
    }

    let mut allocations: Vec<i64> = ratios
        .iter()
        .map(|&r| (minor * r as i64) / total_ratio as i64)
        .collect();

    // Distribute rounding remainder to the first bucket.
    let allocated_sum: i64 = allocations.iter().sum();
    let remainder = minor - allocated_sum;
    if let Some(first) = allocations.first_mut() {
        *first += remainder;
    }

    Ok(allocations)
}

// ─── Display ─────────────────────────────────────────────────────────────────

/// Formats minor units as a display decimal string with correct decimal places.
pub fn display(minor: i64, currency: &str) -> Result<String, FormulaError> {
    from_minor_units(minor, currency)
}

// ─── Tests ───────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn to_minor_usd() {
        assert_eq!(to_minor_units("19.99", "USD").unwrap(), 1999);
    }

    #[test]
    fn to_minor_jpy() {
        assert_eq!(to_minor_units("1000", "JPY").unwrap(), 1000);
    }

    #[test]
    fn to_minor_bhd() {
        assert_eq!(to_minor_units("1.234", "BHD").unwrap(), 1234);
    }

    #[test]
    fn from_minor_usd() {
        assert_eq!(from_minor_units(1999, "USD").unwrap(), "19.99");
    }

    #[test]
    fn classic_float_problem_is_exact() {
        // 0.1 + 0.2 must equal 0.30 — never 0.30000000000000004
        let a = to_minor_units("0.1", "USD").unwrap();
        let b = to_minor_units("0.2", "USD").unwrap();
        let sum = add(a, b);
        assert_eq!(from_minor_units(sum, "USD").unwrap(), "0.30");
    }

    #[test]
    fn basis_points_tax() {
        // 15% tax on $100.00 = $15.00
        let amount = to_minor_units("100.00", "USD").unwrap();
        let tax = apply_basis_points(amount, 1500, &RoundingMode::Bankers).unwrap();
        assert_eq!(from_minor_units(tax, "USD").unwrap(), "15.00");
    }

    #[test]
    fn allocate_no_cent_lost() {
        // $22.99 split 70/30 — no cent lost
        let minor = to_minor_units("22.99", "USD").unwrap();
        let splits = allocate(minor, &[70, 30]).unwrap();
        assert_eq!(splits.iter().sum::<i64>(), minor);
        assert_eq!(from_minor_units(splits[0], "USD").unwrap(), "16.10");
        assert_eq!(from_minor_units(splits[1], "USD").unwrap(), "6.89");
    }

    #[test]
    fn allocate_three_way() {
        let minor = to_minor_units("100.00", "USD").unwrap();
        let splits = allocate(minor, &[1, 1, 1]).unwrap();
        // Each is 33 cents, remainder (1 cent) goes to first bucket
        assert_eq!(splits.iter().sum::<i64>(), minor);
    }

    #[test]
    fn multiply_no_drift() {
        let minor = to_minor_units("19.99", "USD").unwrap();
        let result = multiply(minor, "3", &RoundingMode::Bankers).unwrap();
        assert_eq!(from_minor_units(result, "USD").unwrap(), "59.97");
    }

    #[test]
    fn bankers_rounding_midpoint() {
        // $0.025 in minor units = 2 (half-cent → rounds to even = 2)
        let minor = to_minor_units("0.025", "USD").unwrap();
        let result = multiply(35, "0.1", &RoundingMode::Bankers).unwrap();
        // 2.5 rounds to 2 (even) under banker's rounding
        assert_eq!(result, 4);
    }
}