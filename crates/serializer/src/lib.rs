use serde::{Deserialize, Serialize};
use thiserror::Error;

// ─── Errors ──────────────────────────────────────────────────────────────────

#[derive(Debug, Error)]
pub enum SerializerError {
    #[error("JSON serialization failed: {0}")]
    JsonSerialize(String),

    #[error("JSON deserialization failed: {0}")]
    JsonDeserialize(String),

    #[error("zstd compression failed: {0}")]
    CompressionFailed(String),

    #[error("zstd decompression failed: {0}")]
    DecompressionFailed(String),

    #[error("input is empty")]
    EmptyInput,
}

// ─── JSON Serialization ───────────────────────────────────────────────────────

/// Serializes a value to a compact JSON string.
pub fn to_json<T: Serialize>(value: &T) -> Result<String, SerializerError> {
    serde_json::to_string(value).map_err(|e| SerializerError::JsonSerialize(e.to_string()))
}

/// Serializes a value to a pretty-printed JSON string.
pub fn to_json_pretty<T: Serialize>(value: &T) -> Result<String, SerializerError> {
    serde_json::to_string_pretty(value)
        .map_err(|e| SerializerError::JsonSerialize(e.to_string()))
}

/// Deserializes a JSON string into a value.
pub fn from_json<T: for<'de> Deserialize<'de>>(s: &str) -> Result<T, SerializerError> {
    serde_json::from_str(s).map_err(|e| SerializerError::JsonDeserialize(e.to_string()))
}

/// Serializes to raw JSON bytes.
pub fn to_json_bytes<T: Serialize>(value: &T) -> Result<Vec<u8>, SerializerError> {
    serde_json::to_vec(value).map_err(|e| SerializerError::JsonSerialize(e.to_string()))
}

/// Deserializes from raw JSON bytes.
pub fn from_json_bytes<T: for<'de> Deserialize<'de>>(bytes: &[u8]) -> Result<T, SerializerError> {
    serde_json::from_slice(bytes).map_err(|e| SerializerError::JsonDeserialize(e.to_string()))
}

// ─── zstd Compression ─────────────────────────────────────────────────────────

/// Default compression level — balances speed and ratio for ledger snapshots.
const ZSTD_LEVEL: i32 = 3;

/// Compresses bytes using zstd at the default level.
/// Used for long-term cold storage of ledger snapshots per docs/architecture/internals.md §3.7.
pub fn compress(input: &[u8]) -> Result<Vec<u8>, SerializerError> {
    if input.is_empty() {
        return Err(SerializerError::EmptyInput);
    }
    zstd::encode_all(input, ZSTD_LEVEL)
        .map_err(|e| SerializerError::CompressionFailed(e.to_string()))
}

/// Decompresses zstd-compressed bytes.
pub fn decompress(input: &[u8]) -> Result<Vec<u8>, SerializerError> {
    if input.is_empty() {
        return Err(SerializerError::EmptyInput);
    }
    zstd::decode_all(input)
        .map_err(|e| SerializerError::DecompressionFailed(e.to_string()))
}

// ─── Compressed JSON (Combined Pipeline) ─────────────────────────────────────

/// Serializes a value to JSON, then compresses with zstd.
/// This is the ledger snapshot pipeline: value → JSON bytes → zstd bytes.
pub fn to_compressed_json<T: Serialize>(value: &T) -> Result<Vec<u8>, SerializerError> {
    let json_bytes = to_json_bytes(value)?;
    compress(&json_bytes)
}

/// Decompresses zstd bytes, then deserializes from JSON.
pub fn from_compressed_json<T: for<'de> Deserialize<'de>>(
    compressed: &[u8],
) -> Result<T, SerializerError> {
    let json_bytes = decompress(compressed)?;
    from_json_bytes(&json_bytes)
}

// ─── Tests ───────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use serde::{Deserialize, Serialize};

    #[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
    struct TestEntry {
        id: String,
        amount: String,
        currency: String,
    }

    fn entry() -> TestEntry {
        TestEntry {
            id: "ibiz_led_001".into(),
            amount: "99.99".into(),
            currency: "USD".into(),
        }
    }

    #[test]
    fn json_round_trip() {
        let original = entry();
        let json = to_json(&original).unwrap();
        let restored: TestEntry = from_json(&json).unwrap();
        assert_eq!(original, restored);
    }

    #[test]
    fn json_bytes_round_trip() {
        let original = entry();
        let bytes = to_json_bytes(&original).unwrap();
        let restored: TestEntry = from_json_bytes(&bytes).unwrap();
        assert_eq!(original, restored);
    }

    #[test]
    fn compress_reduces_size_for_repetitive_data() {
        // Ledger entries are repetitive JSON — zstd should always produce smaller output.
        let data = to_json_bytes(&vec![entry(); 100]).unwrap();
        let compressed = compress(&data).unwrap();
        assert!(compressed.len() < data.len(), "zstd should compress repetitive JSON");
    }

    #[test]
    fn compress_decompress_round_trip() {
        let input = b"intellibiz ledger snapshot payload";
        let compressed = compress(input).unwrap();
        let decompressed = decompress(&compressed).unwrap();
        assert_eq!(decompressed, input);
    }

    #[test]
    fn compressed_json_round_trip() {
        let original = vec![entry(); 50];
        let compressed = to_compressed_json(&original).unwrap();
        let restored: Vec<TestEntry> = from_compressed_json(&compressed).unwrap();
        assert_eq!(original, restored);
    }

    #[test]
    fn empty_input_returns_error() {
        assert!(matches!(compress(&[]), Err(SerializerError::EmptyInput)));
        assert!(matches!(decompress(&[]), Err(SerializerError::EmptyInput)));
    }

    #[test]
    fn pretty_json_is_valid_json() {
        let pretty = to_json_pretty(&entry()).unwrap();
        assert!(pretty.contains('\n'));
        let restored: TestEntry = from_json(&pretty).unwrap();
        assert_eq!(restored, entry());
    }
}