// ─── MCP Fixture Adapter (In-Process) ──────────────────────────────────────
//
// In-process safe fixture adapter for the three built-in tools.
// No process spawning, no network, no filesystem access.
//
// # Safety
// - Only hardcoded tool names execute.
// - Tools are purely computational: echo, time, arithmetic.
// - No secrets are read or printed.
// - Output is capped at 4096 bytes.
// ───────────────────────────────────────────────────────────────────────────

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

// ─── Constants ─────────────────────────────────────────────────────────────

/// Stable server identifier for the built-in safe fixture.
pub const FIXTURE_SERVER_ID: &str = "builtin-safe-fixture";

/// Stable display name.
pub const FIXTURE_SERVER_NAME: &str = "Safe Fixture Server";

/// Maximum output preview length.
const MAX_OUTPUT_LEN: usize = 4096;

// ─── Tool Definitions ──────────────────────────────────────────────────────

/// A single fixture tool definition.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpFixtureToolDefinition {
    pub name: String,
    pub description: String,
    pub input_schema: Value,
}

/// Return the list of safe fixture tool definitions.
pub fn list_tools() -> Vec<McpFixtureToolDefinition> {
    vec![
        McpFixtureToolDefinition {
            name: "echo".into(),
            description: "Echo the input message back to the caller.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "message": {
                        "type": "string",
                        "description": "Text to echo"
                    }
                },
                "required": ["message"]
            }),
        },
        McpFixtureToolDefinition {
            name: "get_time".into(),
            description: "Return the current UTC time as an ISO 8601 string.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "timezone": {
                        "type": "string",
                        "description": "Optional timezone (accepted but ignored)"
                    }
                },
                "required": []
            }),
        },
        McpFixtureToolDefinition {
            name: "add_numbers".into(),
            description: "Add two numbers and return the sum.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "a": {
                        "type": "number",
                        "description": "First number"
                    },
                    "b": {
                        "type": "number",
                        "description": "Second number"
                    }
                },
                "required": ["a", "b"]
            }),
        },
    ]
}

/// Check whether a tool name is a safe fixture tool.
pub fn is_fixture_tool(name: &str) -> bool {
    matches!(name, "echo" | "get_time" | "add_numbers")
}

// ─── Execution ─────────────────────────────────────────────────────────────

/// Result of a fixture tool call.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpFixtureCallResult {
    /// Whether the call succeeded.
    pub success: bool,
    /// Text content of the result.
    pub content: String,
    /// Error message if not successful.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// Call a fixture tool with the given arguments.
///
/// # Arguments
/// * `tool_name` — one of "echo", "get_time", "add_numbers"
/// * `args` — JSON object with the tool's parameters
///
/// # Returns
/// A result with content or error.
pub fn call_tool(tool_name: &str, args: &Value) -> McpFixtureCallResult {
    match tool_name {
        "echo" => call_echo(args),
        "get_time" => call_get_time(args),
        "add_numbers" => call_add_numbers(args),
        _ => McpFixtureCallResult {
            success: false,
            content: String::new(),
            error: Some(format!("Unknown fixture tool: {}", tool_name)),
        },
    }
}

fn call_echo(args: &Value) -> McpFixtureCallResult {
    let message = args
        .get("message")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    McpFixtureCallResult {
        success: true,
        content: truncate_output(&message),
        error: None,
    }
}

fn call_get_time(_args: &Value) -> McpFixtureCallResult {
    let now = iso_now();
    McpFixtureCallResult {
        success: true,
        content: now,
        error: None,
    }
}

fn call_add_numbers(args: &Value) -> McpFixtureCallResult {
    let a = match args.get("a") {
        Some(v) if v.is_number() => v.as_f64().unwrap_or(f64::NAN),
        Some(v) if v.is_string() => v.as_str().unwrap_or("").parse::<f64>().unwrap_or(f64::NAN),
        _ => f64::NAN,
    };
    let b = match args.get("b") {
        Some(v) if v.is_number() => v.as_f64().unwrap_or(f64::NAN),
        Some(v) if v.is_string() => v.as_str().unwrap_or("").parse::<f64>().unwrap_or(f64::NAN),
        _ => f64::NAN,
    };

    if a.is_nan() || b.is_nan() {
        return McpFixtureCallResult {
            success: false,
            content: String::new(),
            error: Some("Parameters 'a' and 'b' must be numbers".into()),
        };
    }

    // Use integer arithmetic if both values are integers
    if a.fract() == 0.0 && b.fract() == 0.0 && a.is_finite() && b.is_finite() {
        let sum = a as i64 + b as i64;
        McpFixtureCallResult {
            success: true,
            content: sum.to_string(),
            error: None,
        }
    } else {
        let sum = a + b;
        McpFixtureCallResult {
            success: true,
            content: format!("{}", sum),
            error: None,
        }
    }
}

// ─── Helpers ───────────────────────────────────────────────────────────────

/// Truncate a string to the maximum output preview length.
fn truncate_output(s: &str) -> String {
    if s.len() <= MAX_OUTPUT_LEN {
        s.to_string()
    } else {
        let mut truncated = s[..MAX_OUTPUT_LEN].to_string();
        truncated.push_str("...");
        truncated
    }
}

/// Return the current time as an ISO 8601 string (UTC).
fn iso_now() -> String {
    let dur = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default();
    let secs = dur.as_secs();
    let days_since_epoch = secs / 86400;
    let time_secs = secs % 86400;
    let hours = time_secs / 3600;
    let minutes = (time_secs % 3600) / 60;
    let seconds = time_secs % 60;

    let (year, month, day) = days_to_date(days_since_epoch as i64);
    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z",
        year, month, day, hours, minutes, seconds
    )
}

/// Convert days since Unix epoch to (year, month, day).
fn days_to_date(days: i64) -> (i64, u32, u32) {
    let z = days + 719468;
    let era = if z >= 0 { z } else { z - 146096 } / 146097;
    let doe = z - era * 146097;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = if m <= 2 { y + 1 } else { y };
    (y, m as u32, d as u32)
}

// ─── Tests ─────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_list_tools_contains_echo() {
        let tools = list_tools();
        assert!(tools.iter().any(|t| t.name == "echo"));
        assert!(tools.iter().any(|t| t.name == "get_time"));
        assert!(tools.iter().any(|t| t.name == "add_numbers"));
        assert_eq!(tools.len(), 3);
    }

    #[test]
    fn test_is_fixture_tool() {
        assert!(is_fixture_tool("echo"));
        assert!(is_fixture_tool("get_time"));
        assert!(is_fixture_tool("add_numbers"));
        assert!(!is_fixture_tool("execute_command"));
        assert!(!is_fixture_tool("read_file"));
    }

    #[test]
    fn test_echo_with_message() {
        let result = call_tool("echo", &json!({"message": "hello world"}));
        assert!(result.success);
        assert_eq!(result.content, "hello world");
        assert!(result.error.is_none());
    }

    #[test]
    fn test_echo_empty_message() {
        let result = call_tool("echo", &json!({}));
        assert!(result.success);
        assert_eq!(result.content, "");
        assert!(result.error.is_none());
    }

    #[test]
    fn test_get_time_returns_iso() {
        let result = call_tool("get_time", &json!({}));
        assert!(result.success);
        // Should look like an ISO 8601 string
        assert!(result.content.contains('T') || result.content.len() > 10);
        assert!(result.error.is_none());
    }

    #[test]
    fn test_get_time_with_timezone() {
        let result = call_tool("get_time", &json!({"timezone": "UTC"}));
        assert!(result.success);
        assert!(result.error.is_none());
    }

    #[test]
    fn test_add_numbers_integer() {
        let result = call_tool("add_numbers", &json!({"a": 3, "b": 4}));
        assert!(result.success);
        assert_eq!(result.content, "7");
        assert!(result.error.is_none());
    }

    #[test]
    fn test_add_numbers_float() {
        let result = call_tool("add_numbers", &json!({"a": 1.5, "b": 2.5}));
        assert!(result.success);
        assert_eq!(result.content, "4");
        assert!(result.error.is_none());
    }

    #[test]
    fn test_add_numbers_missing_field() {
        let result = call_tool("add_numbers", &json!({"a": 3}));
        assert!(!result.success);
        assert!(result.error.is_some());
        assert!(result.error.as_ref().unwrap().contains("must be numbers"));
    }

    #[test]
    fn test_add_numbers_non_number() {
        let result = call_tool("add_numbers", &json!({"a": "foo", "b": 4}));
        assert!(!result.success);
        assert!(result.error.is_some());
    }

    #[test]
    fn test_unknown_tool() {
        let result = call_tool("unknown_tool", &json!({}));
        assert!(!result.success);
        assert!(result.error.is_some());
        assert!(result
            .error
            .as_ref()
            .unwrap()
            .contains("Unknown fixture tool"));
    }

    #[test]
    fn test_truncate_output() {
        let short = "hello";
        assert_eq!(truncate_output(short), "hello");

        let long = "x".repeat(5000);
        let truncated = truncate_output(&long);
        assert_eq!(truncated.len(), MAX_OUTPUT_LEN + 3); // +3 for "..."
        assert!(truncated.ends_with("..."));
    }
}
