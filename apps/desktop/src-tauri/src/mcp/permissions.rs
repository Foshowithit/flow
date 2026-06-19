// ─── MCP Permissions & Proposals ──────────────────────────────────────────
//
// In-memory permission proposal store with risk classification.
// No tool execution occurs here — only proposal creation and resolution.
//
// Safety:
// - No process spawning, no shell access, no tool execution.
// - Risk classification is based on tool name keywords only.
// - Deny/allow_once decisions record audit but never execute tools.
// ───────────────────────────────────────────────────────────────────────────

use std::collections::HashMap;
use std::sync::Mutex;

use super::audit::{args_summary, redact_args};
use super::types::{
    AuditDecision, AuditStatus, McpAuditEntry, McpPermissionProposal, McpToolCallResult,
    ResolveDecision, RiskLevel,
};
use crate::mcp::config::McpConfigStore;

/// A pending proposal awaiting user decision.
#[derive(Debug, Clone)]
pub struct PendingProposal {
    pub proposal: McpPermissionProposal,
    pub raw_args: serde_json::Value,
}

/// In-memory permission proposal store.
pub struct PermissionStore {
    proposals: Mutex<HashMap<String, PendingProposal>>,
}

impl PermissionStore {
    /// Create a new empty permission store.
    pub fn new() -> Self {
        Self {
            proposals: Mutex::new(HashMap::new()),
        }
    }

    /// Store a pending proposal.
    pub fn store_proposal(&self, proposal: PendingProposal) {
        self.proposals
            .lock()
            .unwrap()
            .insert(proposal.proposal.id.clone(), proposal);
    }

    /// Retrieve and remove a pending proposal by ID.
    pub fn take_proposal(&self, id: &str) -> Option<PendingProposal> {
        self.proposals.lock().unwrap().remove(id)
    }

    /// Return the number of pending proposals.
    pub fn proposal_count(&self) -> usize {
        self.proposals.lock().unwrap().len()
    }

    /// List all pending proposals (for debugging/UI).
    pub fn list_proposals(&self) -> Vec<McpPermissionProposal> {
        self.proposals
            .lock()
            .unwrap()
            .values()
            .map(|p| p.proposal.clone())
            .collect()
    }
}

impl Default for PermissionStore {
    fn default() -> Self {
        Self::new()
    }
}

// ─── Risk Classification ──────────────────────────────────────────────────

/// Classify the risk level of a tool call based on the tool name.
///
/// Rules are keyword-based and ordered from highest to lowest severity.
/// The first matching category wins.
pub fn classify_risk(tool_name: &str, _description: &str) -> (RiskLevel, Vec<String>) {
    let name_lower = tool_name.to_lowercase();
    let mut reasons = Vec::new();

    // Critical: shell execution, arbitrary command execution
    let critical_patterns = [
        "shell",
        "bash",
        "sh",
        "zsh",
        "powershell",
        "pwsh",
        "cmd",
        "exec",
        "spawn",
        "run_command",
        "command",
        "system",
        "execute",
        "run_shell",
        "invoke",
    ];
    for p in &critical_patterns {
        if name_lower.contains(p) {
            reasons.push(format!(
                "Tool name contains '{}' — potential shell execution",
                p
            ));
            return (RiskLevel::Critical, reasons);
        }
    }

    // High: filesystem writes, destructive operations, network access
    let high_patterns = [
        "write",
        "create",
        "delete",
        "remove",
        "rm",
        "mv",
        "cp",
        "mkdir",
        "rmdir",
        "chmod",
        "chown",
        "fs",
        "filesystem",
        "file_write",
        "file_delete",
        "network",
        "http",
        "curl",
        "wget",
        "fetch",
        "request",
        "post",
        "put",
        "patch",
        "upload",
        "download",
        "install",
        "apt",
        "brew",
        "npm_install",
        "pip_install",
    ];
    for p in &high_patterns {
        if name_lower.contains(p) {
            reasons.push(format!(
                "Tool name contains '{}' — potentially destructive or network access",
                p
            ));
            return (RiskLevel::High, reasons);
        }
    }

    // Medium: filesystem reads, information gathering
    let medium_patterns = [
        "read", "cat", "ls", "find", "grep", "search", "list", "stat", "head", "tail", "less",
        "more", "info", "describe", "get",
    ];
    for p in &medium_patterns {
        if name_lower.contains(p) {
            reasons.push(format!("Tool name contains '{}' — information access", p));
            return (RiskLevel::Medium, reasons);
        }
    }

    // Low: safe operations
    let low_patterns = [
        "echo",
        "time",
        "add",
        "calculator",
        "sum",
        "math",
        "multiply",
        "divide",
        "subtract",
        "count",
        "print",
        "say",
        "notify",
        "alert",
        "ping",
        "health",
        "status",
        "version",
    ];
    for p in &low_patterns {
        if name_lower.contains(p) {
            reasons.push(format!("Tool name contains '{}' — safe operation", p));
            return (RiskLevel::Low, reasons);
        }
    }

    // Default: medium (unknown tools are treated cautiously)
    reasons.push("Unknown tool — treated with caution".into());
    (RiskLevel::Medium, reasons)
}

// ─── Proposal Creation ────────────────────────────────────────────────────

/// Create a permission proposal for a tool call.
///
/// Validates that the server exists in the config store, classifies risk,
/// redacts args, and stores the pending proposal.
///
/// Returns the proposal for the UI to display.
pub fn create_proposal(
    store: &PermissionStore,
    config_store: &McpConfigStore,
    server_id: &str,
    tool_name: &str,
    raw_args: serde_json::Value,
    autonomous: bool,
) -> Result<McpPermissionProposal, String> {
    // Validate server exists
    let servers = config_store.list_servers();
    let server = servers
        .iter()
        .find(|s| s.id == server_id)
        .ok_or_else(|| format!("Server '{}' not found in config", server_id))?;

    if !server.enabled {
        return Err(format!("Server '{}' is disabled", server.name));
    }

    let (risk_level, risk_reasons) = classify_risk(tool_name, "");

    let args_redacted = redact_args(&raw_args);

    let id = uuid::Uuid::new_v4().to_string();
    let now = iso_now();

    let proposal = McpPermissionProposal {
        id: id.clone(),
        server_id: server_id.to_string(),
        server_name: server.name.clone(),
        tool_name: tool_name.to_string(),
        risk_level,
        risk_reasons,
        args_redacted: args_redacted.clone(),
        autonomous,
        created_at: now.clone(),
    };

    let pending = PendingProposal {
        proposal: proposal.clone(),
        raw_args,
    };

    store.store_proposal(pending);

    Ok(proposal)
}

// ─── Proposal Resolution ──────────────────────────────────────────────────

/// Resolve a pending proposal with a user decision.
///
/// * `Deny` — appends an audit entry with `denied` status and returns a denied result.
/// * `AllowOnce` — if the proposal targets the built-in safe fixture server
///   and a safe tool, executes the tool via the stdio fixture process.
///   The process MUST be running; there is no in-process fallback.
pub fn resolve_proposal(
    store: &PermissionStore,
    audit_log: &super::audit::AuditLog,
    proposal_id: &str,
    decision: &ResolveDecision,
    fixture_process: Option<&super::process::McpFixtureProcess>,
) -> Result<McpToolCallResult, String> {
    let pending = store
        .take_proposal(proposal_id)
        .ok_or_else(|| format!("Proposal '{}' not found or already resolved", proposal_id))?;

    let proposal = &pending.proposal;
    let now = iso_now();

    match decision {
        ResolveDecision::Deny => {
            let entry = McpAuditEntry {
                id: uuid::Uuid::new_v4().to_string(),
                server_id: proposal.server_id.clone(),
                server_name: proposal.server_name.clone(),
                tool_name: proposal.tool_name.clone(),
                args_redacted: Some(proposal.args_redacted.clone()),
                args_summary: args_summary(&proposal.args_redacted),
                decision: AuditDecision::Denied,
                status: AuditStatus::Denied,
                duration_ms: None,
                output_preview: None,
                error: Some("User denied the tool call".into()),
                created_at: now,
            };

            if let Err(e) = audit_log.append(entry) {
                log::error!("Failed to append audit entry: {e}");
            }

            Ok(McpToolCallResult {
                proposal_id: proposal_id.to_string(),
                approved: false,
                executed: false,
                message: "Tool call denied by user.".into(),
                error: None,
                content: None,
                output_preview: None,
                duration_ms: None,
            })
        }
        ResolveDecision::AllowOnce => {
            // ── Fixture execution path ─────────────────────────────────
            if proposal.server_id == super::fixture::FIXTURE_SERVER_ID
                && super::fixture::is_fixture_tool(&proposal.tool_name)
            {
                let start = std::time::Instant::now();

                // ── Require stdio process running (no in-process fallback) ──
                let (fixture_success, fixture_content, fixture_error) = match fixture_process {
                    Some(proc) => {
                        let (status, _) = proc.status();
                        if status == super::process::McpFixtureProcessStatus::Running {
                            match proc.call_tool(&proposal.tool_name, &pending.raw_args) {
                                Ok(json_result) => {
                                    let content =
                                        super::process::McpFixtureProcess::extract_content_preview(
                                            &json_result,
                                        );
                                    (true, content, None)
                                }
                                Err(e) => (false, String::new(), Some(e)),
                            }
                        } else {
                            // Process exists but not running — error, no fallback
                            (
                                false,
                                String::new(),
                                Some(
                                    "Safe fixture server is not running. ".to_string()
                                        + "Start it before executing tools.",
                                ),
                            )
                        }
                    }
                    None => {
                        // No process manager — error, no fallback
                        (
                            false,
                            String::new(),
                            Some(
                                "Safe fixture server is not running. ".to_string()
                                    + "Start it before executing tools.",
                            ),
                        )
                    }
                };
                let duration_ms = start.elapsed().as_millis() as u64;

                let entry_status = if fixture_success {
                    AuditStatus::Allowed
                } else {
                    AuditStatus::Error
                };

                let entry_decision = if fixture_success {
                    AuditDecision::Approved
                } else {
                    AuditDecision::Error
                };

                let entry = McpAuditEntry {
                    id: uuid::Uuid::new_v4().to_string(),
                    server_id: proposal.server_id.clone(),
                    server_name: proposal.server_name.clone(),
                    tool_name: proposal.tool_name.clone(),
                    args_redacted: Some(proposal.args_redacted.clone()),
                    args_summary: args_summary(&proposal.args_redacted),
                    decision: entry_decision,
                    status: entry_status,
                    duration_ms: Some(duration_ms),
                    output_preview: Some(super::audit::truncate_output(&fixture_content)),
                    error: fixture_error.clone(),
                    created_at: now,
                };

                if let Err(e) = audit_log.append(entry) {
                    log::error!("Failed to append audit entry: {e}");
                }

                let output_preview = Some(super::audit::truncate_output(&fixture_content));

                Ok(McpToolCallResult {
                    proposal_id: proposal_id.to_string(),
                    approved: true,
                    executed: fixture_success,
                    message: if fixture_success {
                        "Tool executed successfully.".into()
                    } else {
                        "Tool execution failed.".into()
                    },
                    error: fixture_error.clone(),
                    content: Some(fixture_content),
                    output_preview,
                    duration_ms: Some(duration_ms),
                })
            } else {
                // Non-fixture allow_once — record disabled/error
                let entry = McpAuditEntry {
                    id: uuid::Uuid::new_v4().to_string(),
                    server_id: proposal.server_id.clone(),
                    server_name: proposal.server_name.clone(),
                    tool_name: proposal.tool_name.clone(),
                    args_redacted: Some(proposal.args_redacted.clone()),
                    args_summary: args_summary(&proposal.args_redacted),
                    decision: AuditDecision::Error,
                    status: AuditStatus::Disabled,
                    duration_ms: None,
                    output_preview: None,
                    error: Some("MCP execution is disabled in this build".into()),
                    created_at: now,
                };

                if let Err(e) = audit_log.append(entry) {
                    log::error!("Failed to append audit entry: {e}");
                }

                Ok(McpToolCallResult {
                    proposal_id: proposal_id.to_string(),
                    approved: true,
                    executed: false,
                    message: "MCP execution is disabled in this build. The tool was NOT executed."
                        .into(),
                    error: Some("MCP execution is disabled in this build".into()),
                    content: None,
                    output_preview: None,
                    duration_ms: None,
                })
            }
        }
    }
}

// ─── Helpers ──────────────────────────────────────────────────────────────

/// Return the current time as an ISO 8601 string.
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_classify_critical() {
        let (level, reasons) = classify_risk("execute_command", "");
        assert_eq!(level, RiskLevel::Critical);
        assert!(!reasons.is_empty());
    }

    #[test]
    fn test_classify_high_write() {
        let (level, _) = classify_risk("write_file", "");
        assert_eq!(level, RiskLevel::High);
    }

    #[test]
    fn test_classify_high_network() {
        let (level, _) = classify_risk("http_request", "");
        assert_eq!(level, RiskLevel::High);
    }

    #[test]
    fn test_classify_medium() {
        let (level, _) = classify_risk("read_file", "");
        assert_eq!(level, RiskLevel::Medium);
    }

    #[test]
    fn test_classify_low() {
        let (level, _) = classify_risk("echo", "");
        assert_eq!(level, RiskLevel::Low);
    }

    #[test]
    fn test_classify_unknown_default() {
        let (level, _) = classify_risk("custom_tool_xyz", "");
        assert_eq!(level, RiskLevel::Medium);
    }

    #[test]
    fn test_classify_shell() {
        let (level, _) = classify_risk("bash", "");
        assert_eq!(level, RiskLevel::Critical);
    }
}
