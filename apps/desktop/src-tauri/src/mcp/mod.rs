// ─── MCP Module ────────────────────────────────────────────────────────────
//
// Model Context Protocol (MCP) permission/audit layer for Flow Desktop.
//
// This module provides:
// - `types` — Shared data structures
// - `config` — Persistent server configuration store
// - `audit` — Persistent audit log (JSONL) with secret redaction
// - `permissions` — Permission proposal store with risk classification
// - `process` — Safe fixture stdio process lifecycle (spawns node, not user input)
// - `commands` — Tauri IPC command handlers
//
// ## Safety
// All commands are explicitly safe:
// - `mcp_availability()` — returns platform/version info
// - `mcp_list_servers()` — returns configured server list
// - `mcp_upsert_server()` — creates/updates a server config
// - `mcp_delete_server()` — deletes a server config
// - `mcp_list_audit()` — returns recent audit entries from persistent store
// - `mcp_prepare_tool_call()` — creates a permission proposal, never executes
// - `mcp_resolve_tool_call()` — resolves a proposal (deny/allow_once)
// - `mcp_fixture_start()` — starts the safe fixture stdio process
// - `mcp_fixture_stop()` — stops the safe fixture stdio process
// - `mcp_fixture_restart()` — restarts the safe fixture stdio process
//
// Process spawning is restricted to the hardcoded fixture path only.
// ───────────────────────────────────────────────────────────────────────────

pub mod audit;
pub mod commands;
pub mod config;
pub mod fixture;
pub mod permissions;
pub mod process;
pub mod types;

use std::path::PathBuf;

/// Shared application state for the MCP subsystem.
pub struct McpState {
    pub audit_log: audit::AuditLog,
    pub permission_store: permissions::PermissionStore,
    pub config_store: config::McpConfigStore,
    pub fixture_process: process::McpFixtureProcess,
}

impl McpState {
    pub fn new() -> Self {
        Self {
            audit_log: audit::AuditLog::new(),
            permission_store: permissions::PermissionStore::new(),
            config_store: config::McpConfigStore::new(),
            fixture_process: process::McpFixtureProcess::new(),
        }
    }

    /// Initialise the config store with a directory path.
    /// Must be called once during app setup.
    /// Also ensures the built-in safe fixture server exists.
    pub fn init_config_store(&self, dir: PathBuf) -> Result<(), config::ConfigError> {
        self.config_store.init(dir)?;
        self.config_store.ensure_fixture_server()?;
        Ok(())
    }

    /// Initialise the audit store with a directory path.
    /// Must be called once during app setup.
    pub fn init_audit_store(&self, dir: PathBuf) -> Result<(), String> {
        self.audit_log.init(dir)
    }
}

impl Default for McpState {
    fn default() -> Self {
        Self::new()
    }
}
