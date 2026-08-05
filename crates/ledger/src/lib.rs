use sha2::{Digest, Sha256};

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct LedgerEntry {
    pub id: String,
    pub tenant_id: String,
    pub action: String,
    pub amount_minor: i64,
    pub currency: String,
    pub timestamp: u64,
    pub hash: String,
}

impl LedgerEntry {
    pub fn new(
        id: String,
        tenant_id: String,
        action: String,
        amount_minor: i64,
        currency: String,
        timestamp: u64,
    ) -> Self {
        let raw = format!("{}{}{}{}{}", tenant_id, action, amount_minor, currency, timestamp);
        let hash = format!("{:x}", Sha256::digest(raw.as_bytes()));
        Self { id, tenant_id, action, amount_minor, currency, timestamp, hash }
    }

    pub fn verify(&self) -> bool {
        let raw = format!(
            "{}{}{}{}{}",
            self.tenant_id, self.action, self.amount_minor, self.currency, self.timestamp
        );
        let expected = format!("{:x}", Sha256::digest(raw.as_bytes()));
        self.hash == expected
    }
}

pub struct LedgerWriter {
    entries: std::sync::Mutex<Vec<LedgerEntry>>,
}

impl LedgerWriter {
    pub fn new() -> Self {
        Self { entries: std::sync::Mutex::new(Vec::new()) }
    }

    pub fn write(&self, entry: LedgerEntry) {
        self.entries.lock().unwrap().push(entry);
    }

    pub fn flush(&self) -> Vec<LedgerEntry> {
        let mut lock = self.entries.lock().unwrap();
        std::mem::take(&mut *lock)
    }
}
