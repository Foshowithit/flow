// ─── MCP Commands — Explicit Safe IPC Handlers ────────────────────────────
//
// All Tauri invoke commands for MCP. These commands are registered in lib.rs
// and exposed via the capabilities file.
//
// SAFETY: No process spawning, no filesystem reads/writes outside the
// designated app-data directories. Tool execution is restricted to the
// in-process fixture adapter for built-in safe tools only.
// The `mcp_prepare_tool_call` command creates a permission proposal and NEVER
// executes the tool directly. `mcp_resolve_tool_call` records audit and may
// execute only the built-in safe fixture tools when the proposal targets the
// fixture server and the user allows.
// ───────────────────────────────────────────────────────────────────────────
use super::fixture::{McpFixtureToolDefinition, FIXTURE_SERVER_ID};
use super::types::{
    McpAuditEntry, McpAvailability, McpListAuditParams, McpPermissionProposal,
    McpPrepareToolCallParams, McpResolveToolCallParams, McpServerConfig, McpToolCallResult,
};
use super::McpState;
use tauri::State;

/// Return the current MCP availability status.
#[tauri::command]
pub fn mcp_availability() -> McpAvailability {
    McpAvailability {
        available: true,
        platform: "tauri".to_string(),
        version: "0.1.0-fixture-execution".to_string(),
        reason: Some(
            "MCP has built-in safe fixture execution for echo, get_time, add_numbers.".to_string(),
        ),
    }
}

/// List configured MCP server configs.
#[tauri::command]
pub fn mcp_list_servers(state: State<'_, McpState>) -> Vec<McpServerConfig> {
    state.config_store.list_servers()
}

/// Create or update an MCP server configuration.
#[tauri::command]
pub fn mcp_upsert_server(
    input: super::types::McpUpsertServerInput,
    state: State<'_, McpState>,
) -> Result<McpServerConfig, String> {
    state
        .config_store
        .upsert_server(input)
        .map_err(|e| e.to_string())
}

/// Delete an MCP server configuration by ID.
#[tauri::command]
pub fn mcp_delete_server(server_id: String, state: State<'_, McpState>) -> Result<bool, String> {
    state
        .config_store
        .delete_server(&server_id)
        .map_err(|e| e.to_string())
}

/// List recent audit entries.
///
/// Returns the most recent entries from the persistent audit store,
/// newest first, bounded by the requested limit.
#[tauri::command]
pub fn mcp_list_audit(
    params: McpListAuditParams,
    state: State<'_, McpState>,
) -> Vec<McpAuditEntry> {
    state.audit_log.recent(params.limit as usize)
}

/// Prepare (but do not execute) a tool call.
///
/// Validates the server exists in the config store, classifies risk,
/// redacts arguments, creates a permission proposal, and returns it.
///
/// The tool is NEVER executed. The caller must use `mcp_resolve_tool_call`
/// with the returned proposal ID to deny or allow_once the call.
#[tauri::command]
pub fn mcp_prepare_tool_call(
    params: McpPrepareToolCallParams,
    state: State<'_, McpState>,
) -> Result<McpPermissionProposal, String> {
    super::permissions::create_proposal(
        &state.permission_store,
        &state.config_store,
        &params.server_id,
        &params.tool,
        params.args,
        params.autonomous,
    )
}

/// Resolve a pending tool call proposal.
///
/// * `deny` — records an audit entry with `denied` status, returns denied result.
/// * `allow_once` — if the proposal targets the built-in safe fixture server
///   and one of the safe tools (echo, get_time, add_numbers), the tool is
///   executed via the stdio fixture process (must be running). No in-process
///   fallback. Otherwise, records a `disabled` audit entry and returns an error.
#[tauri::command]
pub fn mcp_resolve_tool_call(
    params: McpResolveToolCallParams,
    state: State<'_, McpState>,
) -> Result<McpToolCallResult, String> {
    let (fixture_status, _) = state.fixture_process.status();
    let fixture_is_running = fixture_status == super::process::McpFixtureProcessStatus::Running;
    let fixture_process_ref = if fixture_is_running {
        Some(&state.fixture_process)
    } else {
        None
    };
    super::permissions::resolve_proposal(
        &state.permission_store,
        &state.audit_log,
        &params.proposal_id,
        &params.decision,
        fixture_process_ref,
    )
}

/// List the built-in safe fixture tool definitions.
///
/// Returns the three hardcoded safe tools: echo, get_time, add_numbers.
/// These are always available without a configured server.
/// When the stdio fixture process is running, queries it via protocol.
/// Otherwise returns the static tool definitions (list-only, no execution).
#[tauri::command]
pub fn mcp_fixture_list_tools(state: State<'_, McpState>) -> Vec<McpFixtureToolDefinition> {
    // Try to get tools from the stdio process first
    let (status, _) = state.fixture_process.status();
    if status == super::process::McpFixtureProcessStatus::Running {
        match state.fixture_process.list_tools() {
            Ok(result) => {
                if let Some(tools) = result.get("result").and_then(|r| r.get("tools")) {
                    if let Some(arr) = tools.as_array() {
                        let defs: Vec<McpFixtureToolDefinition> = arr
                            .iter()
                            .filter_map(|t| {
                                Some(McpFixtureToolDefinition {
                                    name: t.get("name")?.as_str()?.to_string(),
                                    description: t.get("description")?.as_str()?.to_string(),
                                    input_schema: t.get("inputSchema")?.clone(),
                                })
                            })
                            .collect();
                        if !defs.is_empty() {
                            return defs;
                        }
                    }
                }
            }
            Err(_e) => {
                // Fall through to in-process fallback
            }
        }
    }
    // Fallback: return in-process fixture tool definitions
    super::fixture::list_tools()
}

/// Return the status of the built-in safe fixture server.
/// Includes process status (not_started, running, stopped, error).
#[tauri::command]
pub fn mcp_fixture_status(state: State<'_, McpState>) -> serde_json::Value {
    let servers = state.config_store.list_servers();
    let fixture = servers.iter().find(|s| s.id == FIXTURE_SERVER_ID);
    let (status, error) = state.fixture_process.status();
    serde_json::json!({
        "available": fixture.is_some(),
        "id": FIXTURE_SERVER_ID,
        "server": fixture,
        "process_status": status,
        "process_error": error,
    })
}

/// Start the safe fixture stdio process.
/// Spawns `node` with the hardcoded fixture script path only.
#[tauri::command]
pub fn mcp_fixture_start(state: State<'_, McpState>) -> Result<String, String> {
    state.fixture_process.start()?;
    // After starting, run initialize to verify the fixture is responsive
    match state.fixture_process.initialize() {
        Ok(_) => Ok("Fixture process started and initialized successfully.".to_string()),
        Err(e) => {
            // Initialization failed but process is running; return warning
            Ok(format!(
                "Fixture process started but initialize warning: {}",
                e
            ))
        }
    }
}

/// Stop the safe fixture stdio process.
/// Kills the child process and cleans up resources.
#[tauri::command]
pub fn mcp_fixture_stop(state: State<'_, McpState>) -> Result<String, String> {
    state.fixture_process.stop()?;
    Ok("Fixture process stopped.".to_string())
}

/// Restart the safe fixture stdio process (stop then start).
#[tauri::command]
pub fn mcp_fixture_restart(state: State<'_, McpState>) -> Result<String, String> {
    state.fixture_process.restart()?;
    // Run initialize on restart
    match state.fixture_process.initialize() {
        Ok(_) => Ok("Fixture process restarted and initialized successfully.".to_string()),
        Err(e) => Ok(format!(
            "Fixture process restarted but initialize warning: {}",
            e
        )),
    }
}
