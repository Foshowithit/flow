// ─── MCP Foundation — Rust Types ──────────────────────────────────────────
//
// Shared data structures for the MCP skeleton. No execution logic.
// ───────────────────────────────────────────────────────────────────────────

use serde::{Deserialize, Serialize};

/// Current availability status of the MCP runtime.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpAvailability {
    pub available: bool,
    pub platform: String,
    pub version: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
}

/// MCP server configuration (persisted).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpServerConfig {
    /// Unique server identifier (UUID v4).
    pub id: String,
    /// Human-readable display name.
    pub name: String,
    /// Transport type. Must be "stdio" in this phase.
    pub transport: String,
    /// Command to execute (executable name or path).
    pub command: String,
    /// Command-line arguments.
    #[serde(default)]
    pub args: Vec<String>,
    /// Working directory (optional).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cwd: Option<String>,
    /// Environment variable reference names (not values).
    #[serde(default)]
    pub env_refs: Vec<String>,
    /// Allowed filesystem paths (optional allow list).
    #[serde(default)]
    pub allowed_paths: Vec<String>,
    /// Whether this server is enabled.
    pub enabled: bool,
    /// ISO 8601 creation timestamp.
    pub created_at: String,
    /// ISO 8601 last-update timestamp.
    pub updated_at: String,
}

/// Input for creating or updating a server config.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpUpsertServerInput {
    pub id: Option<String>,
    pub name: String,
    pub transport: String,
    pub command: String,
    #[serde(default)]
    pub args: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cwd: Option<String>,
    #[serde(default)]
    pub env_refs: Vec<String>,
    #[serde(default)]
    pub allowed_paths: Vec<String>,
    pub enabled: bool,
}

/// Input for deleting a server config.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpDeleteServerInput {
    pub server_id: String,
}

/// Current state of an MCP server connection.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpServerStatus {
    pub server_id: String,
    pub state: String, // "online" | "offline" | "error" | "starting"
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_contact: Option<String>,
}

/// Definition of a tool exposed by an MCP server.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpToolDefinition {
    pub server_id: String,
    pub name: String,
    pub description: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub input_schema: Option<serde_json::Value>,
}

// ─── Permission / Proposal Types ───────────────────────────────────────────

/// Risk level assigned to a tool call proposal.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum RiskLevel {
    #[serde(rename = "low")]
    Low,
    #[serde(rename = "medium")]
    Medium,
    #[serde(rename = "high")]
    High,
    #[serde(rename = "critical")]
    Critical,
}

/// A permission proposal presented to the user before tool execution.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpPermissionProposal {
    /// Unique proposal ID (UUID v4).
    pub id: String,
    /// Server identifier.
    pub server_id: String,
    /// Server display name.
    pub server_name: String,
    /// Tool name.
    pub tool_name: String,
    /// Assessed risk level.
    pub risk_level: RiskLevel,
    /// Human-readable reasons for the risk assessment.
    #[serde(default)]
    pub risk_reasons: Vec<String>,
    /// Redacted arguments for display.
    pub args_redacted: serde_json::Value,
    /// Whether the call was initiated autonomously (deferred).
    pub autonomous: bool,
    /// ISO 8601 creation timestamp.
    pub created_at: String,
}

/// Decision for resolving a tool call proposal.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ResolveDecision {
    #[serde(rename = "deny")]
    Deny,
    #[serde(rename = "allow_once")]
    AllowOnce,
}

/// Parameters for resolving a tool call proposal.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpResolveToolCallParams {
    pub proposal_id: String,
    pub decision: ResolveDecision,
}

/// Parameters for listing audit entries.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpListAuditParams {
    pub limit: u32,
}

/// Parameters for preparing a tool call.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpPrepareToolCallParams {
    pub server_id: String,
    pub tool: String,
    pub args: serde_json::Value,
    pub autonomous: bool,
    pub description: String,
}

// ─── Audit Types ──────────────────────────────────────────────────────────

/// Decision recorded in the audit log.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum AuditDecision {
    #[serde(rename = "prepared")]
    Prepared,
    #[serde(rename = "approved")]
    Approved,
    #[serde(rename = "denied")]
    Denied,
    #[serde(rename = "executed")]
    Executed,
    #[serde(rename = "error")]
    Error,
}

/// Status of a tool call attempt.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum AuditStatus {
    #[serde(rename = "pending")]
    Pending,
    #[serde(rename = "allowed")]
    Allowed,
    #[serde(rename = "denied")]
    Denied,
    #[serde(rename = "disabled")]
    Disabled,
    #[serde(rename = "error")]
    Error,
}

/// A single audit entry recording a tool call attempt.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpAuditEntry {
    pub id: String,
    pub server_id: String,
    pub server_name: String,
    pub tool_name: String,
    /// Redacted copy of the arguments for audit.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub args_redacted: Option<serde_json::Value>,
    /// Human-readable summary of arguments (truncated).
    #[serde(default)]
    pub args_summary: String,
    /// User decision (deny/allow_once/etc).
    pub decision: AuditDecision,
    /// Overall status.
    pub status: AuditStatus,
    /// Duration in milliseconds (only for executed calls).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub duration_ms: Option<u64>,
    /// Preview of the output (truncated).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub output_preview: Option<String>,
    /// Error message if the call failed or was disabled.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    /// ISO 8601 timestamp when the entry was created.
    pub created_at: String,
}

/// ─── Tool Call Result ──────────────────────────────────────────────────────
///
/// Result returned from resolving a tool call proposal.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpToolCallResult {
    pub proposal_id: String,
    pub approved: bool,
    pub executed: bool,
    /// Human-readable message.
    pub message: String,
    /// Error message when not successful.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    /// Text content of the result (for fixture execution).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content: Option<String>,
    /// Preview of the output (truncated).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub output_preview: Option<String>,
    /// Duration in milliseconds.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub duration_ms: Option<u64>,
}
