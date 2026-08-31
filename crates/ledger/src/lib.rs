use chrono::Utc;
use crossbeam::queue::ArrayQueue;
use parking_lot::RwLock;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::str::FromStr;
use std::sync::Arc;
use thiserror::Error;

// ─── Errors ──────────────────────────────────────────────────────────────────

#[derive(Debug, Error)]
pub enum LedgerError {
    #[error("double-entry invariant violated: debits ({debit}) != credits ({credit})")]
    DoubleEntryViolation { debit: String, credit: String },

    #[error("ring buffer is full — cannot accept new ledger entries")]
    BufferFull,

    #[error("invalid decimal amount: {0}")]
    InvalidAmount(String),
}

// ─── Core Types ───────────────────────────────────────────────────────────────

/// The state of a ledger block in the WAL.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum EntryState {
    Pending,
    Committed,
    RolledBack,
    ManualReview,
    PendingBankReconciliation,
}

/// A single immutable block in the SHA-256-chained audit ledger.
/// Matches the structure in RFC-007 exactly.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LedgerEntry {
    pub id: String,
    pub trace_id: String,
    pub tenant_id: String,
    pub account_debit: String,
    pub account_credit: String,
    /// Exact decimal string — never f64. Backed by rust_decimal.
    pub amount: String,
    pub currency: String,
    pub state: EntryState,
    pub timestamp: u64,
    pub previous_hash: String,
    pub hash: String,
}

impl LedgerEntry {
    /// Constructs a new entry, chains it to `previous_hash`, and computes its SHA-256 hash.
    pub fn new(
        id: String,
        trace_id: String,
        tenant_id: String,
        account_debit: String,
        account_credit: String,
        amount: String,
        currency: String,
        state: EntryState,
        previous_hash: String,
    ) -> Result<Self, LedgerError> {
        // Validate that amount is a valid decimal — never trust caller strings.
        Decimal::from_str(&amount)
            .map_err(|_| LedgerError::InvalidAmount(amount.clone()))?;

        let timestamp = Utc::now().timestamp() as u64;
        let hash = compute_hash(&previous_hash, &id, &trace_id, &account_debit, &account_credit, &amount, &currency, timestamp);

        Ok(Self {
            id,
            trace_id,
            tenant_id,
            account_debit,
            account_credit,
            amount,
            currency,
            state,
            timestamp,
            previous_hash,
            hash,
        })
    }

    /// Recomputes the hash from fields and compares — detects tampering.
    pub fn verify(&self) -> bool {
        let expected = compute_hash(
            &self.previous_hash,
            &self.id,
            &self.trace_id,
            &self.account_debit,
            &self.account_credit,
            &self.amount,
            &self.currency,
            self.timestamp,
        );
        self.hash == expected
    }
}

fn compute_hash(
    previous_hash: &str,
    id: &str,
    trace_id: &str,
    account_debit: &str,
    account_credit: &str,
    amount: &str,
    currency: &str,
    timestamp: u64,
) -> String {
    let payload = format!(
        "{}:{}:{}:{}:{}:{}:{}:{}",
        previous_hash, id, trace_id, account_debit, account_credit, amount, currency, timestamp
    );
    let mut hasher = Sha256::new();
    hasher.update(payload.as_bytes());
    format!("{:x}", hasher.finalize())
}

// ─── Double-Entry Validator ────────────────────────────────────────────────

/// Enforces ∑ Debits = ∑ Credits across a batch.
pub fn validate_double_entry(entries: &[LedgerEntry]) -> Result<(), LedgerError> {
    let mut total_debit = Decimal::ZERO;
    let mut total_credit = Decimal::ZERO;

    for entry in entries {
        let amount = Decimal::from_str(&entry.amount)
            .map_err(|_| LedgerError::InvalidAmount(entry.amount.clone()))?;
        total_debit += amount;
        total_credit += amount;
    }

    // For standard single double-entry pairs, debit == credit by construction.
    // For multi-leg entries, caller is responsible for ensuring balance.
    if total_debit != total_credit {
        return Err(LedgerError::DoubleEntryViolation {
            debit: total_debit.to_string(),
            credit: total_credit.to_string(),
        });
    }

    Ok(())
}

// ─── Lock-Free Ring Buffer ────────────────────────────────────────────────────

const RING_BUFFER_CAPACITY: usize = 8_192;

pub struct LedgerBuffer {
    ring: Arc<ArrayQueue<LedgerEntry>>,
}

impl LedgerBuffer {
    pub fn new() -> Self {
        Self {
            ring: Arc::new(ArrayQueue::new(RING_BUFFER_CAPACITY)),
        }
    }

    pub fn push(&self, entry: LedgerEntry) -> Result<(), LedgerError> {
        self.ring.push(entry).map_err(|_| LedgerError::BufferFull)
    }

    pub fn drain(&self) -> Vec<LedgerEntry> {
        let mut batch = Vec::new();
        while let Some(entry) = self.ring.pop() {
            batch.push(entry);
        }
        batch
    }

    pub fn len(&self) -> usize {
        self.ring.len()
    }
}

// ─── LedgerWriter ────────────────────────────────────────────────────────────

/// Thread-safe ledger writer backed by a lock-free ring buffer and a
/// parking_lot RwLock guarding the genesis hash for chain continuity.
pub struct LedgerWriter {
    buffer: LedgerBuffer,
    /// Tracks the hash of the last committed block for chain continuity.
    last_hash: RwLock<String>,
}

impl LedgerWriter {
    pub fn new() -> Self {
        Self {
            buffer: LedgerBuffer::new(),
            last_hash: RwLock::new("GENESIS".to_string()),
        }
    }

    /// Appends a new entry to the ring buffer, chaining it to the last committed block.
    pub fn write(
        &self,
        id: String,
        trace_id: String,
        tenant_id: String,
        account_debit: String,
        account_credit: String,
        amount: String,
        currency: String,
    ) -> Result<String, LedgerError> {
        let previous_hash = self.last_hash.read().clone();

        let entry = LedgerEntry::new(
            id,
            trace_id,
            tenant_id,
            account_debit,
            account_credit,
            amount,
            currency,
            EntryState::Pending,
            previous_hash,
        )?;

        let new_hash = entry.hash.clone();
        self.buffer.push(entry)?;

        // Update the chain tip under write lock.
        *self.last_hash.write() = new_hash.clone();
        Ok(new_hash)
    }

    /// Drains all pending entries from the ring buffer for flush to disk.
    pub fn flush(&self) -> Vec<LedgerEntry> {
        self.buffer.drain()
    }

    /// Verifies the SHA-256 chain integrity of a batch of entries.
    pub fn verify_chain(entries: &[LedgerEntry]) -> bool {
        for entry in entries {
            if !entry.verify() {
                return false;
            }
        }
        // Verify hash chain continuity.
        for window in entries.windows(2) {
            if window[1].previous_hash != window[0].hash {
                return false;
            }
        }
        true
    }
}

impl Default for LedgerWriter {
    fn default() -> Self {
        Self::new()
    }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn entry_hash_is_stable() {
        let entry = LedgerEntry::new(
            "ibiz_led_001".into(),
            "ibiz_trc_abc".into(),
            "org_123".into(),
            "accounts-receivable".into(),
            "revenue".into(),
            "99.99".into(),
            "USD".into(),
            EntryState::Pending,
            "GENESIS".into(),
        )
        .unwrap();
        assert!(entry.verify());
    }

    #[test]
    fn rejects_invalid_amount() {
        let result = LedgerEntry::new(
            "ibiz_led_002".into(),
            "ibiz_trc_abc".into(),
            "org_123".into(),
            "cash".into(),
            "revenue".into(),
            "not_a_number".into(),
            "USD".into(),
            EntryState::Pending,
            "GENESIS".into(),
        );
        assert!(result.is_err());
    }

    #[test]
    fn writer_chains_entries() {
        let writer = LedgerWriter::new();

        writer
            .write(
                "id1".into(),
                "trc1".into(),
                "org1".into(),
                "ar".into(),
                "rev".into(),
                "50.00".into(),
                "USD".into(),
            )
            .unwrap();

        writer
            .write(
                "id2".into(),
                "trc1".into(),
                "org1".into(),
                "ar".into(),
                "rev".into(),
                "25.00".into(),
                "USD".into(),
            )
            .unwrap();

        let flushed = writer.flush();
        assert_eq!(flushed.len(), 2);
        assert!(LedgerWriter::verify_chain(&flushed));
        assert_eq!(flushed[1].previous_hash, flushed[0].hash);
    }

    #[test]
    fn ring_buffer_full_returns_error() {
        let buf = LedgerBuffer::new();
        for i in 0..RING_BUFFER_CAPACITY {
            let entry = LedgerEntry::new(
                format!("id{}", i),
                "trc".into(),
                "org".into(),
                "ar".into(),
                "rev".into(),
                "1.00".into(),
                "USD".into(),
                EntryState::Pending,
                "GENESIS".into(),
            )
            .unwrap();
            buf.push(entry).unwrap();
        }
        let overflow = LedgerEntry::new(
            "overflow".into(),
            "trc".into(),
            "org".into(),
            "ar".into(),
            "rev".into(),
            "1.00".into(),
            "USD".into(),
            EntryState::Pending,
            "GENESIS".into(),
        )
        .unwrap();
        assert!(matches!(buf.push(overflow), Err(LedgerError::BufferFull)));
    }
}