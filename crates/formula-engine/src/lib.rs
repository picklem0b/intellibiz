// All amounts are in minor units (cents) to avoid floating point

pub fn add(a: i64, b: i64) -> i64 {
    a + b
}

pub fn subtract(a: i64, b: i64) -> i64 {
    a - b
}

pub fn apply_percentage(amount: i64, basis_points: u32) -> i64 {
    // basis_points: 1000 = 10%, 2000 = 20%
    (amount * basis_points as i64) / 10_000
}

pub fn apply_discount(amount: i64, discount_basis_points: u32) -> i64 {
    let discount = apply_percentage(amount, discount_basis_points);
    subtract(amount, discount)
}

pub fn minor_to_display(minor: i64, decimals: u8) -> String {
    let factor = 10_i64.pow(decimals as u32);
    let major = minor / factor;
    let remainder = (minor % factor).abs();
    format!("{}.{:0>width$}", major, remainder, width = decimals as usize)
}
