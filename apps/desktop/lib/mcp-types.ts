/**
 * ─── Flow MCP Foundation — Shared Types ─────────────────────────────────────
 *
 * These types define the data structures for the Model Context Protocol (MCP)
 * permission/audit layer.
 *
 * @module mcp-types
 */

// ─── Availability ───────────────────────────────────────────────────────────

export type McpAvailability =
	| { available: false; reason: string }
	| { available: true; platform: "tauri"; version: string };

// ─── Server Config ──────────────────────────────────────────────────────────

export interface McpServerConfig {
	/** Unique server identifier */
	id: string;
	/** Human-readable display name */
	name: string;
	/** Transport type (stdio, sse, etc.) — reserved for future use */
	transport: "stdio" | "sse" | "built-in";
	/** Command to execute (executable name or path) */
	command: string;
	/** Command-line arguments */
	args: string[];
	/** Working directory (optional) */
	cwd?: string;
	/** Environment variable reference names (not values) */
	envRefs: string[];
	/** Allowed filesystem paths (optional allow list) */
	allowedPaths: string[];
	/** Whether this server is enabled */
	enabled: boolean;
	/** ISO 8601 creation timestamp */
	createdAt: string;
	/** ISO 8601 last-update timestamp */
	updatedAt: string;
}

/** Input for creating or updating a server config. */
export interface McpUpsertServerInput {
	/** Server ID for updates; omit for new servers. */
	id?: string;
	/** Human-readable display name (must be non-empty). */
	name: string;
	/** Transport type (must be "stdio"). */
	transport: string;
	/** Command to execute (must be non-empty). */
	command: string;
	/** Command-line arguments. */
	args?: string[];
	/** Working directory (optional). */
	cwd?: string;
	/** Environment variable reference names (not values). */
	envRefs?: string[];
	/** Allowed filesystem paths. */
	allowedPaths?: string[];
	/** Whether this server is enabled. */
	enabled: boolean;
}

/** Input for deleting a server config. */
export interface McpDeleteServerInput {
	serverId: string;
}

// ─── Server Status ──────────────────────────────────────────────────────────

export type McpServerState = "online" | "offline" | "error" | "starting";

export interface McpServerStatus {
	serverId: string;
	state: McpServerState;
	/** Error message when state is "error" */
	error?: string;
	/** Last contact timestamp (ISO 8601) */
	lastContact?: string;
}

// ─── Tool Definition ────────────────────────────────────────────────────────

export interface McpToolDefinition {
	serverId: string;
	name: string;
	description: string;
	/** JSON Schema input schema (optional) */
	inputSchema?: Record<string, unknown>;
}

// ─── Permission Proposal ────────────────────────────────────────────────────

/** Risk level assigned to a tool call proposal. */
export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface McpPermissionProposal {
	/** Unique proposal ID */
	id: string;
	/** Server identifier */
	serverId: string;
	/** Server display name */
	serverName: string;
	/** Tool name */
	toolName: string;
	/** Assessed risk level */
	riskLevel: RiskLevel;
	/** Human-readable reasons for the risk assessment */
	riskReasons: string[];
	/** Redacted arguments for display */
	argsRedacted: Record<string, unknown>;
	/** Whether the call was initiated autonomously (deferred) */
	autonomous: boolean;
	/** ISO 8601 creation timestamp */
	createdAt: string;
}

/** Decision for resolving a tool call proposal. */
export type ResolveDecision = "deny" | "allow_once";

/** Parameters for resolving a tool call proposal. */
export interface McpResolveToolCallParams {
	proposalId: string;
	decision: ResolveDecision;
}

/** Result returned from resolving a tool call proposal. */
export interface McpToolCallResult {
	proposalId: string;
	approved: boolean;
	executed: boolean;
	/** Human-readable message */
	message: string;
	/** Error message when not successful */
	error?: string;
	/** Text content of the result (for fixture execution) */
	content?: string;
	/** Preview of the output (truncated) */
	outputPreview?: string;
	/** Duration in milliseconds */
	durationMs?: number;
}

// ─── Tool Result ────────────────────────────────────────────────────────────

export type McpContentPart =
	| { type: "text"; text: string }
	| { type: "resource"; uri: string; mimeType?: string; text?: string }
	| { type: "error"; message: string };

export interface McpToolResult {
	serverId: string;
	tool: string;
	/** Call ID for correlating with audit */
	callId: string;
	success: boolean;
	content: McpContentPart[];
	/** Human-readable error when not successful */
	error?: string;
}

// ─── Audit Entry ────────────────────────────────────────────────────────────

export type AuditDecision =
	| "prepared"
	| "approved"
	| "denied"
	| "executed"
	| "error";

export type AuditStatus =
	| "pending"
	| "allowed"
	| "denied"
	| "disabled"
	| "error";

export interface McpAuditEntry {
	/** Unique entry ID */
	id: string;
	/** Server identifier */
	serverId: string;
	/** Server display name */
	serverName: string;
	/** Tool name */
	toolName: string;
	/** Redacted arguments (optional) */
	argsRedacted?: Record<string, unknown>;
	/** Human-readable summary of arguments (truncated) */
	argsSummary: string;
	/** User decision */
	decision: AuditDecision;
	/** Overall status */
	status: AuditStatus;
	/** Duration in milliseconds (only for executed calls) */
	durationMs?: number;
	/** Preview of the output (truncated) */
	outputPreview?: string;
	/** Error message if the call failed or was disabled */
	error?: string;
	/** ISO 8601 timestamp when the entry was created */
	createdAt: string;
}

// ─── Command Params (for Tauri invoke) ──────────────────────────────────────

export interface McpListAuditParams {
	limit: number;
}

export interface McpPrepareToolCallParams {
	serverId: string;
	tool: string;
	args: Record<string, unknown>;
	autonomous: boolean;
	description: string;
}

// ─── Fixture Tool Types ───────────────────────────────────────────────────

/** Definition of a fixture tool returned by mcp_fixture_list_tools. */
export interface McpFixtureToolDefinition {
	name: string;
	description: string;
	/** JSON Schema input schema */
	inputSchema: Record<string, unknown>;
}

/** Current process status of the fixture runtime. */
export type McpFixtureProcessStatus =
	| "not_started"
	| "starting"
	| "running"
	| "stopped"
	| "error";

/** Status of the built-in safe fixture server. */
export interface McpFixtureStatus {
	available: boolean;
	id: string;
	server?: McpServerConfig;
	/** Process lifecycle status (not_started, running, stopped, error). */
	processStatus?: McpFixtureProcessStatus;
	/** Error message if process is in error state. */
	processError?: string | null;
}
