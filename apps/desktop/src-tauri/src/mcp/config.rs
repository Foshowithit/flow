// ─── MCP Config Store ──────────────────────────────────────────────────────
//
// Persistent MCP server configuration management using atomic file writes.
// Configs are stored as JSON in `app_data_dir()/mcp/servers.json`.
//
// Safety:
// - No process spawning, no tool execution, no filesystem access outside the
//   designated config directory.
// - No raw secret values are stored; `env_refs` are reference names only.
// - Validation rejects empty names/commands and non-stdio transports.
// ───────────────────────────────────────────────────────────────────────────

use crate::mcp::types::{McpServerConfig, McpUpsertServerInput};
use std::fs;
use std::io;
use std::path::PathBuf;
use std::sync::Mutex;

/// Config validation error.
#[derive(Debug)]
pub enum ConfigError {
    Validation(String),
    Io(String),
}

impl std::fmt::Display for ConfigError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ConfigError::Validation(msg) => write!(f, "Validation error: {}", msg),
            ConfigError::Io(msg) => write!(f, "IO error: {}", msg),
        }
    }
}

impl From<io::Error> for ConfigError {
    fn from(e: io::Error) -> Self {
        ConfigError::Io(e.to_string())
    }
}

/// In-memory MCP server configuration store backed by a JSON file.
pub struct McpConfigStore {
    /// Directory where `servers.json` is stored.
    dir: Mutex<Option<PathBuf>>,
    /// In-memory list of server configs.
    servers: Mutex<Vec<McpServerConfig>>,
}

impl McpConfigStore {
    /// Create a new empty config store.
    pub fn new() -> Self {
        Self {
            dir: Mutex::new(None),
            servers: Mutex::new(Vec::new()),
        }
    }

    /// Initialise the store with a directory path.
    ///
    /// Loads existing configs from `{dir}/servers.json` if the file exists.
    /// Creates the directory if it does not exist.
    pub fn init(&self, dir: PathBuf) -> Result<(), ConfigError> {
        fs::create_dir_all(&dir).map_err(|e| ConfigError::Io(format!("create_dir_all: {e}")))?;

        let path = dir.join("servers.json");
        if path.exists() {
            let data = fs::read_to_string(&path)?;
            if !data.trim().is_empty() {
                let servers: Vec<McpServerConfig> = serde_json::from_str(&data)
                    .map_err(|e| ConfigError::Io(format!("parse servers.json: {e}")))?;
                *self.servers.lock().unwrap() = servers;
            }
        }

        *self.dir.lock().unwrap() = Some(dir);
        Ok(())
    }

    /// Return the file path for `servers.json`.
    fn json_path(&self) -> Option<PathBuf> {
        let dir = self.dir.lock().unwrap();
        dir.as_ref().map(|d| d.join("servers.json"))
    }

    /// Write the current server list to the JSON file atomically.
    fn save(&self) -> Result<(), ConfigError> {
        let path = match self.json_path() {
            Some(p) => p,
            None => return Ok(()), // not initialised yet — skip
        };
        let parent = path.parent().unwrap();
        fs::create_dir_all(parent)?;

        let data = serde_json::to_string_pretty(&*self.servers.lock().unwrap())
            .map_err(|e| ConfigError::Io(format!("serialize: {e}")))?;

        // Atomic write: write to .tmp, then rename
        let tmp_path = path.with_extension("tmp");
        fs::write(&tmp_path, &data)?;
        fs::rename(&tmp_path, &path)?;
        Ok(())
    }

    /// Return the list of configured servers.
    pub fn list_servers(&self) -> Vec<McpServerConfig> {
        self.servers.lock().unwrap().clone()
    }

    /// Add or update a server configuration.
    ///
    /// # Validation
    /// - `name` must be non-empty.
    /// - `command` must be non-empty.
    /// - `transport` must be `"stdio"`.
    /// - `args` max 50 entries, each ≤500 chars.
    /// - `env_refs` max 50 entries, each ≤500 chars.
    /// - `allowed_paths` max 20 entries, each ≤2000 chars.
    pub fn upsert_server(
        &self,
        input: McpUpsertServerInput,
    ) -> Result<McpServerConfig, ConfigError> {
        // ── Validate ─────────────────────────────────────────────────────
        let name = input.name.trim().to_string();
        if name.is_empty() {
            return Err(ConfigError::Validation("name must be non-empty".into()));
        }
        let command = input.command.trim().to_string();
        if command.is_empty() {
            return Err(ConfigError::Validation("command must be non-empty".into()));
        }
        let transport = input.transport.trim().to_lowercase();
        if transport != "stdio" {
            return Err(ConfigError::Validation(
                "transport must be \"stdio\"".into(),
            ));
        }
        if input.args.len() > 50 {
            return Err(ConfigError::Validation(
                "args exceeds max 50 entries".into(),
            ));
        }
        for arg in &input.args {
            if arg.len() > 500 {
                return Err(ConfigError::Validation(
                    "arg exceeds max 500 characters".into(),
                ));
            }
        }
        if input.env_refs.len() > 50 {
            return Err(ConfigError::Validation(
                "env_refs exceeds max 50 entries".into(),
            ));
        }
        for r in &input.env_refs {
            if r.len() > 500 {
                return Err(ConfigError::Validation(
                    "env_ref exceeds max 500 characters".into(),
                ));
            }
        }
        if input.allowed_paths.len() > 20 {
            return Err(ConfigError::Validation(
                "allowed_paths exceeds max 20 entries".into(),
            ));
        }
        for p in &input.allowed_paths {
            if p.len() > 2000 {
                return Err(ConfigError::Validation(
                    "allowed_path entry exceeds max 2000 characters".into(),
                ));
            }
        }

        // ── Build config ─────────────────────────────────────────────────
        let now = iso_now();
        let mut servers = self.servers.lock().unwrap();

        if let Some(ref existing_id) = input.id {
            // Update existing
            if let Some(existing) = servers.iter_mut().find(|s| s.id == *existing_id) {
                existing.name = name;
                existing.transport = transport;
                existing.command = command;
                existing.args = input.args;
                existing.cwd = input.cwd;
                existing.env_refs = input.env_refs;
                existing.allowed_paths = input.allowed_paths;
                existing.enabled = input.enabled;
                existing.updated_at = now.clone();
                let config = existing.clone();
                drop(servers);
                self.save()?;
                return Ok(config);
            }
            // ID not found — treat as create
        }

        // Create new
        let id = uuid::Uuid::new_v4().to_string();
        let config = McpServerConfig {
            id: id.clone(),
            name,
            transport,
            command,
            args: input.args,
            cwd: input.cwd,
            env_refs: input.env_refs,
            allowed_paths: input.allowed_paths,
            enabled: input.enabled,
            created_at: now.clone(),
            updated_at: now,
        };
        servers.push(config.clone());
        drop(servers);
        self.save()?;
        Ok(config)
    }

    /// Remove a server configuration by ID.
    /// Returns `true` if a server was removed, `false` if not found.
    pub fn delete_server(&self, server_id: &str) -> Result<bool, ConfigError> {
        let mut servers = self.servers.lock().unwrap();
        let len_before = servers.len();
        servers.retain(|s| s.id != server_id);
        let removed = servers.len() < len_before;
        drop(servers);
        if removed {
            self.save()?;
        }
        Ok(removed)
    }

    /// Ensure the built-in safe fixture server exists in the config store.
    /// Creates it with a stable id `builtin-safe-fixture` if not present.
    pub fn ensure_fixture_server(&self) -> Result<(), ConfigError> {
        let fixture_id = super::fixture::FIXTURE_SERVER_ID;
        let servers = self.servers.lock().unwrap();
        if servers.iter().any(|s| s.id == fixture_id) {
            return Ok(());
        }
        drop(servers);

        let now = iso_now();
        let config = McpServerConfig {
            id: fixture_id.to_string(),
            name: super::fixture::FIXTURE_SERVER_NAME.to_string(),
            transport: "built-in".into(),
            command: "built-in".into(),
            args: Vec::new(),
            cwd: None,
            env_refs: Vec::new(),
            allowed_paths: Vec::new(),
            enabled: true,
            created_at: now.clone(),
            updated_at: now,
        };
        self.servers.lock().unwrap().push(config);
        self.save()
    }
}

impl Default for McpConfigStore {
    fn default() -> Self {
        Self::new()
    }
}

/// Return the current time as an ISO 8601 string.
fn iso_now() -> String {
    // We use a simple approach without pulling in chrono.
    // This gives UTC in ISO 8601 format.
    let dur = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default();
    let secs = dur.as_secs();
    // Format: 2026-06-16T12:34:56Z
    let days_since_epoch = secs / 86400;
    let time_secs = secs % 86400;
    let hours = time_secs / 3600;
    let minutes = (time_secs % 3600) / 60;
    let seconds = time_secs % 60;

    // Calculate year/month/day from days since epoch (1970-01-01)
    let (year, month, day) = days_to_date(days_since_epoch as i64);
    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z",
        year, month, day, hours, minutes, seconds
    )
}

/// Convert days since Unix epoch to (year, month, day).
/// Algorithm from civil_from_days (Howard Hinnant).
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
