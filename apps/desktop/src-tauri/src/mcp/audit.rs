// ─── MCP Audit Store ──────────────────────────────────────────────────────
//
// Persistent audit log for tool call attempts. Entries are stored as JSONL
// (newline-delimited JSON) in `{app_data}/mcp/audit.jsonl`.
//
// Safety:
// - No process spawning, no shell access, no tool execution.
// - Secret field values are redacted before storage.
// - Preview lengths are capped to avoid storing large payloads.
// ───────────────────────────────────────────────────────────────────────────

use crate::mcp::types::McpAuditEntry;
use serde_json::Value;
use std::fs;
use std::io::{self, BufRead, Write};
use std::path::PathBuf;
use std::sync::Mutex;

/// Known field names whose values should be redacted in audit logs.
const SECRET_KEYS: &[&str] = &[
    "key",
    "keys",
    "api_key",
    "apiKey",
    "apikey",
    "token",
    "tokens",
    "api_token",
    "apiToken",
    "secret",
    "secrets",
    "secret_key",
    "secretKey",
    "password",
    "passwd",
    "pass",
    "authorization",
    "auth",
    "access_key",
    "accessKey",
    "accesskey",
    "private_key",
    "privateKey",
    "client_secret",
    "clientSecret",
    "bearer",
];

/// Maximum length of a string preview stored in audit entries.
const MAX_PREVIEW_LEN: usize = 500;

/// Maximum length of an args summary string.
const MAX_ARGS_SUMMARY_LEN: usize = 200;

/// Persistent audit log backed by a JSONL file.
pub struct AuditLog {
    /// Directory where `audit.jsonl` is stored.
    dir: Mutex<Option<PathBuf>>,
    /// In-memory cache of all entries (for fast recent queries).
    entries: Mutex<Vec<McpAuditEntry>>,
}

impl AuditLog {
    /// Create a new empty audit log.
    pub fn new() -> Self {
        Self {
            dir: Mutex::new(None),
            entries: Mutex::new(Vec::new()),
        }
    }

    /// Initialise the audit store with a directory path.
    ///
    /// Creates the directory and loads existing entries from `audit.jsonl`
    /// if the file exists.
    pub fn init(&self, dir: PathBuf) -> Result<(), String> {
        fs::create_dir_all(&dir).map_err(|e| format!("create_audit_dir: {e}"))?;

        let path = dir.join("audit.jsonl");
        let mut loaded = Vec::new();

        if path.exists() {
            let file = fs::File::open(&path).map_err(|e| format!("open_audit: {e}"))?;
            let reader = io::BufReader::new(file);
            for line in reader.lines() {
                match line {
                    Ok(l) if !l.trim().is_empty() => {
                        match serde_json::from_str::<McpAuditEntry>(&l) {
                            Ok(entry) => loaded.push(entry),
                            Err(e) => {
                                log::warn!("Skipping malformed audit line: {e}");
                            }
                        }
                    }
                    Err(e) => {
                        log::warn!("Error reading audit line: {e}");
                    }
                    _ => {}
                }
            }
        }

        *self.dir.lock().unwrap() = Some(dir);
        *self.entries.lock().unwrap() = loaded;
        Ok(())
    }

    /// Return the path to the audit JSONL file.
    fn jsonl_path(&self) -> Option<PathBuf> {
        self.dir
            .lock()
            .unwrap()
            .as_ref()
            .map(|d| d.join("audit.jsonl"))
    }

    /// Append a single entry to the audit log.
    ///
    /// Writes to both the in-memory cache and the JSONL file.
    pub fn append(&self, entry: McpAuditEntry) -> Result<(), String> {
        // Write to file
        let path = match self.jsonl_path() {
            Some(p) => p,
            None => return Err("Audit log not initialised".into()),
        };

        let line =
            serde_json::to_string(&entry).map_err(|e| format!("serialize audit entry: {e}"))?;

        let mut file = fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&path)
            .map_err(|e| format!("open audit.jsonl: {e}"))?;

        writeln!(file, "{}", line).map_err(|e| format!("write audit entry: {e}"))?;

        // Append to in-memory cache
        self.entries.lock().unwrap().push(entry);

        Ok(())
    }

    /// Return the most recent entries up to `limit`.
    ///
    /// Entries are returned newest-first.
    pub fn recent(&self, limit: usize) -> Vec<McpAuditEntry> {
        let log = self.entries.lock().unwrap();
        let len = log.len();
        let start = len.saturating_sub(limit);
        let mut result = log[start..].to_vec();
        result.reverse(); // newest first
        result
    }

    /// Return total entry count.
    pub fn count(&self) -> usize {
        self.entries.lock().unwrap().len()
    }
}

impl Default for AuditLog {
    fn default() -> Self {
        Self::new()
    }
}

// ─── Args Redaction ───────────────────────────────────────────────────────

/// Redact likely secret field values in the given JSON value.
///
/// Recursively walks the JSON object and replaces values for keys whose name
/// matches known secret patterns with `"[REDACTED]"`.
pub fn redact_args(value: &Value) -> Value {
    match value {
        Value::Object(map) => {
            let mut redacted = serde_json::Map::new();
            for (k, v) in map {
                let key_lower = k.to_lowercase();
                if is_secret_key(&key_lower) {
                    redacted.insert(k.clone(), Value::String("[REDACTED]".into()));
                } else {
                    redacted.insert(k.clone(), redact_args(v));
                }
            }
            Value::Object(redacted)
        }
        Value::Array(arr) => {
            let redacted: Vec<Value> = arr.iter().map(redact_args).collect();
            Value::Array(redacted)
        }
        other => other.clone(),
    }
}

/// Check if a lowercased key name matches known secret patterns.
fn is_secret_key(key_lower: &str) -> bool {
    SECRET_KEYS.iter().any(|pattern| {
        key_lower == *pattern
            || key_lower.contains(&format!("_{}", pattern))
            || key_lower.contains(&format!("{}_", pattern))
    })
}

// ─── Truncation helpers ───────────────────────────────────────────────────

/// Truncate a string to the given maximum length, appending `...` if truncated.
pub fn truncate_preview(s: &str, max_len: usize) -> String {
    if s.len() <= max_len {
        s.to_string()
    } else {
        let mut truncated = s[..max_len].to_string();
        truncated.push_str("...");
        truncated
    }
}

/// Build a short summary string from redacted args.
pub fn args_summary(value: &Value) -> String {
    let json_str = serde_json::to_string(value).unwrap_or_default();
    truncate_preview(&json_str, MAX_ARGS_SUMMARY_LEN)
}

/// Truncate output preview to max preview length.
pub fn truncate_output(s: &str) -> String {
    truncate_preview(s, MAX_PREVIEW_LEN)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_redact_api_key() {
        let args = json!({"api_key": "sk-1234567890", "model": "gpt-4"});
        let redacted = redact_args(&args);
        assert_eq!(redacted["api_key"], "[REDACTED]");
        assert_eq!(redacted["model"], "gpt-4");
    }

    #[test]
    fn test_redact_nested_secret() {
        let args = json!({"config": {"password": "hunter2", "user": "alice"}});
        let redacted = redact_args(&args);
        assert_eq!(redacted["config"]["password"], "[REDACTED]");
        assert_eq!(redacted["config"]["user"], "alice");
    }

    #[test]
    fn test_redact_array() {
        let args = json!([{"key": "val1"}, {"key": "val2"}]);
        let redacted = redact_args(&args);
        assert_eq!(redacted[0]["key"], "[REDACTED]");
        assert_eq!(redacted[1]["key"], "[REDACTED]");
    }

    #[test]
    fn test_no_secrets_passthrough() {
        let args = json!({"name": "hello", "count": 42});
        let redacted = redact_args(&args);
        assert_eq!(redacted["name"], "hello");
        assert_eq!(redacted["count"], 42);
    }

    #[test]
    fn test_truncate_preview() {
        assert_eq!(truncate_preview("hello", 10), "hello");
        assert_eq!(truncate_preview("hello world", 5), "hello...");
    }
}
