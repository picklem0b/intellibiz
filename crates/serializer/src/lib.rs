pub fn to_json<T: serde::Serialize>(value: &T) -> Result<String, serde_json::Error> {
    serde_json::to_string(value)
}

pub fn from_json<T: serde::de::DeserializeOwned>(s: &str) -> Result<T, serde_json::Error> {
    serde_json::from_str(s)
}

pub fn to_json_pretty<T: serde::Serialize>(value: &T) -> Result<String, serde_json::Error> {
    serde_json::to_string_pretty(value)
}
