"use client";

/**
 * ─── Flow MCP — Desktop Availability Hook ──────────────────────────────────
 *
 * Safely detects Tauri availability without breaking SSR / Next.js build.
 * In browser/Vercel mode, returns unavailable state and no-op methods with
 * UI-safe errors. Does NOT import `@tauri-apps/api` at the top level — uses
 * dynamic import / window check to avoid build-time crashes.
 *
 * @module use-mcp
 */

import { useCallback, useSyncExternalStore } from "react";
import type {
	McpAuditEntry,
	McpAvailability,
	McpFixtureStatus,
	McpFixtureToolDefinition,
	McpPermissionProposal,
	McpPrepareToolCallParams,
	McpResolveToolCallParams,
	McpServerConfig,
	McpToolCallResult,
	McpUpsertServerInput,
} from "@/lib/mcp-types";

// ─── Tauri detection (runtime-only, never at import time) ─────────────────

/**
 * Check whether the current runtime looks like Tauri.
 * This runs only on the client (useEffect) and never during SSR.
 */
function isTauriRuntime(): boolean {
	try {
		// window.__TAURI__ is set by the Tauri webview preload
		return typeof window !== "undefined" && window.__TAURI__ !== undefined;
	} catch {
		return false;
	}
}

// ─── Public types ──────────────────────────────────────────────────────────

export interface UseMcpReturn {
	/** Current MCP availability status */
	availability: McpAvailability;

	/** Refresh availability — useful after Tauri IPC becomes ready */
	refreshAvailability: () => void;

	/** List configured MCP server configs */
	listServers: () => Promise<McpServerConfig[]>;

	/** Create or update an MCP server config */
	upsertServer: (input: McpUpsertServerInput) => Promise<McpServerConfig>;

	/** Delete an MCP server config by ID */
	deleteServer: (serverId: string) => Promise<boolean>;

	/** List audit entries from persistent store */
	listAudit: (limit?: number) => Promise<McpAuditEntry[]>;

	/**
	 * Prepare a tool call — creates a permission proposal.
	 * Returns the proposal which can then be resolved via resolveToolCall.
	 */
	prepareToolCall: (
		params: McpPrepareToolCallParams,
	) => Promise<McpPermissionProposal>;

	/**
	 * Resolve a pending tool call proposal with deny or allow_once.
	 * allow_once executes the tool if the proposal targets the built-in
	 * safe fixture server; otherwise returns a disabled/error result.
	 */
	resolveToolCall: (
		params: McpResolveToolCallParams,
	) => Promise<McpToolCallResult>;

	/** List the built-in safe fixture tool definitions */
	fixtureListTools: () => Promise<McpFixtureToolDefinition[]>;

	/** Get the status of the built-in safe fixture server */
	fixtureStatus: () => Promise<McpFixtureStatus>;

	/** Start the safe fixture stdio process */
	fixtureStart: () => Promise<string>;

	/** Stop the safe fixture stdio process */
	fixtureStop: () => Promise<string>;

	/** Restart the safe fixture stdio process */
	fixtureRestart: () => Promise<string>;
}

// ─── External store for availability ───────────────────────────────────────

let currentAvailability: McpAvailability = {
	available: false,
	reason: "checking",
};
const listeners = new Set<() => void>();

function notifyListeners() {
	for (const l of listeners) l();
}

function getSnapshot(): McpAvailability {
	return currentAvailability;
}

function subscribe(callback: () => void): () => void {
	listeners.add(callback);
	return () => listeners.delete(callback);
}

function updateAvailability() {
	const tauri = isTauriRuntime();
	currentAvailability = tauri
		? { available: true, platform: "tauri", version: "0.1.0-permissions-audit" }
		: {
				available: false,
				reason: "MCP is available only in the Flow Desktop app.",
			};
	notifyListeners();
}

// ─── Hook ──────────────────────────────────────────────────────────────────

/**
 * Hook that exposes MCP capabilities.
 *
 * In browser/Vercel mode:
 *   `availability` = `{ available: false, reason: "…" }`
 *   `listServers()` returns `[]`
 *   `upsertServer()` throws
 *   `deleteServer()` returns false
 *   `listAudit()` returns `[]`
 *   `prepareToolCall()` returns a proposal or throws
 *   `resolveToolCall()` returns a result or throws
 *
 * In Tauri desktop mode:
 *   `availability` = `{ available: true, platform: "tauri", version: "0.1.0-fixture-execution" }`
 *   `listServers()` invokes `mcp_list_servers` via `@tauri-apps/api/core`
 *   `upsertServer()` invokes `mcp_upsert_server`
 *   `deleteServer()` invokes `mcp_delete_server`
 *   `listAudit()` invokes `mcp_list_audit`
 *   `prepareToolCall()` invokes `mcp_prepare_tool_call`
 *   `resolveToolCall()` invokes `mcp_resolve_tool_call`
 *   `fixtureListTools()` invokes `mcp_fixture_list_tools`
 *   `fixtureStatus()` invokes `mcp_fixture_status`
 *   `fixtureStart()` invokes `mcp_fixture_start`
 *   `fixtureStop()` invokes `mcp_fixture_stop`
 *   `fixtureRestart()` invokes `mcp_fixture_restart`
 */
export function useMcp(): UseMcpReturn {
	// Subscribe to availability state (client-side only)
	const availability = useSyncExternalStore(subscribe, getSnapshot, () =>
		getSnapshot(),
	);

	// Detect on first mount
	if (availability.available === false && availability.reason === "checking") {
		queueMicrotask(updateAvailability);
	}

	// ── Dynamic invoke helper ────────────────────────────────────────────
	const dynamicInvoke = useCallback(
		async <T>(cmd: string, args?: Record<string, unknown>): Promise<T> => {
			if (!isTauriRuntime()) {
				throw new Error("MCP is not available outside of Tauri desktop.");
			}
			try {
				const { invoke } = await import("@tauri-apps/api/core");
				return await invoke<T>(cmd, args);
			} catch (err) {
				throw new Error(
					`MCP invoke failed: ${err instanceof Error ? err.message : String(err)}`,
				);
			}
		},
		[],
	);

	// ── Methods ──────────────────────────────────────────────────────────

	const refreshAvailability = useCallback(() => {
		updateAvailability();
	}, []);

	const listServers = useCallback(async (): Promise<McpServerConfig[]> => {
		if (!isTauriRuntime()) return [];
		try {
			return await dynamicInvoke<McpServerConfig[]>("mcp_list_servers");
		} catch {
			return [];
		}
	}, [dynamicInvoke]);

	const upsertServer = useCallback(
		async (input: McpUpsertServerInput): Promise<McpServerConfig> => {
			if (!isTauriRuntime()) {
				throw new Error("MCP is not available in browser mode.");
			}
			return await dynamicInvoke<McpServerConfig>("mcp_upsert_server", {
				input,
			});
		},
		[dynamicInvoke],
	);

	const deleteServer = useCallback(
		async (serverId: string): Promise<boolean> => {
			if (!isTauriRuntime()) return false;
			try {
				return await dynamicInvoke<boolean>("mcp_delete_server", {
					serverId,
				});
			} catch {
				return false;
			}
		},
		[dynamicInvoke],
	);

	const listAudit = useCallback(
		async (limit?: number): Promise<McpAuditEntry[]> => {
			if (!isTauriRuntime()) return [];
			try {
				return await dynamicInvoke<McpAuditEntry[]>("mcp_list_audit", {
					limit: limit ?? 50,
				});
			} catch {
				return [];
			}
		},
		[dynamicInvoke],
	);

	const prepareToolCall = useCallback(
		async (
			params: McpPrepareToolCallParams,
		): Promise<McpPermissionProposal> => {
			if (!isTauriRuntime()) {
				throw new Error("MCP is not available in browser mode.");
			}
			// Convert camelCase params to snake_case for Rust
			return await dynamicInvoke<McpPermissionProposal>(
				"mcp_prepare_tool_call",
				{
					params: {
						server_id: params.serverId,
						tool: params.tool,
						args: params.args,
						autonomous: params.autonomous,
						description: params.description,
					},
				},
			);
		},
		[dynamicInvoke],
	);

	const resolveToolCall = useCallback(
		async (params: McpResolveToolCallParams): Promise<McpToolCallResult> => {
			if (!isTauriRuntime()) {
				throw new Error("MCP is not available in browser mode.");
			}
			return await dynamicInvoke<McpToolCallResult>("mcp_resolve_tool_call", {
				params: {
					proposal_id: params.proposalId,
					decision: params.decision,
				},
			});
		},
		[dynamicInvoke],
	);

	const fixtureListTools = useCallback(async (): Promise<
		McpFixtureToolDefinition[]
	> => {
		if (!isTauriRuntime()) return [];
		try {
			return await dynamicInvoke<McpFixtureToolDefinition[]>(
				"mcp_fixture_list_tools",
			);
		} catch {
			return [];
		}
	}, [dynamicInvoke]);

	const fixtureStatus = useCallback(async (): Promise<McpFixtureStatus> => {
		if (!isTauriRuntime()) {
			return { available: false, id: "builtin-safe-fixture" };
		}
		try {
			return await dynamicInvoke<McpFixtureStatus>("mcp_fixture_status");
		} catch {
			return { available: false, id: "builtin-safe-fixture" };
		}
	}, [dynamicInvoke]);

	const fixtureStart = useCallback(async (): Promise<string> => {
		if (!isTauriRuntime()) {
			throw new Error("MCP is not available in browser mode.");
		}
		return await dynamicInvoke<string>("mcp_fixture_start");
	}, [dynamicInvoke]);

	const fixtureStop = useCallback(async (): Promise<string> => {
		if (!isTauriRuntime()) {
			throw new Error("MCP is not available in browser mode.");
		}
		return await dynamicInvoke<string>("mcp_fixture_stop");
	}, [dynamicInvoke]);

	const fixtureRestart = useCallback(async (): Promise<string> => {
		if (!isTauriRuntime()) {
			throw new Error("MCP is not available in browser mode.");
		}
		return await dynamicInvoke<string>("mcp_fixture_restart");
	}, [dynamicInvoke]);

	return {
		availability,
		refreshAvailability,
		listServers,
		upsertServer,
		deleteServer,
		listAudit,
		prepareToolCall,
		resolveToolCall,
		fixtureListTools,
		fixtureStatus,
		fixtureStart,
		fixtureStop,
		fixtureRestart,
	};
}
