"use client";

/**
 * ─── Flow MCP Panel — Desktop Tools Tab ──────────────────────────────────────
 *
 * Displays MCP availability, server configs list with add/edit/delete,
 * fixture server controls, tool proposal form, permission dialog, and audit log.
 *
 * This is the main container that holds state and delegates rendering
 * to focused sub-components.
 *
 * @module McpPanel
 */

import { useCallback, useEffect, useState } from "react";
import { useMcp } from "@/hooks/use-mcp";
import type {
	McpAuditEntry,
	McpFixtureProcessStatus,
	McpFixtureToolDefinition,
	McpPermissionProposal,
	McpServerConfig,
	McpUpsertServerInput,
} from "@/lib/mcp-types";
import {
	Shield,
	WifiOff,
} from "lucide-react";
import McpServerSection from "./mcp/McpServerSection";
import McpFixtureSection from "./mcp/McpFixtureSection";
import McpToolSection from "./mcp/McpToolSection";
import McpAuditSection from "./mcp/McpAuditSection";
import McpSecurityNotes from "./mcp/McpSecurityNotes";

export default function McpPanel() {
	const {
		availability,
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
	} = useMcp();

	const [servers, setServers] = useState<McpServerConfig[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	// Form state
	const [showForm, setShowForm] = useState(false);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [formData, setFormData] = useState<McpUpsertServerInput>({
		name: "",
		transport: "stdio",
		command: "",
		args: [],
		cwd: "",
		envRefs: [],
		allowedPaths: [],
		enabled: false,
	});
	const [formErrors, setFormErrors] = useState<Record<string, string>>({});

	// Delete confirmation
	const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

	// ── Tool proposal state ─────────────────────────────────────────────
	const [proposalServerId, setProposalServerId] = useState("");
	const [proposalToolName, setProposalToolName] = useState("");
	const [proposalArgsJson, setProposalArgsJson] = useState("{}");
	const [proposalError, setProposalError] = useState<string | null>(null);
	const [proposal, setProposal] = useState<McpPermissionProposal | null>(null);
	const [resolveResult, setResolveResult] = useState<string | null>(null);
	const [preparing, setPreparing] = useState(false);

	// ── Fixture state ───────────────────────────────────────────────────
	const [fixtureTools, setFixtureTools] = useState<McpFixtureToolDefinition[]>(
		[],
	);
	const [fixtureToolLoading, setFixtureToolLoading] = useState(false);
	const [fixtureProcessStatus, setFixtureProcessStatus] =
		useState<McpFixtureProcessStatus | null>(null);
	const [fixtureProcessError, setFixtureProcessError] = useState<string | null>(
		null,
	);
	const [fixtureActionLoading, setFixtureActionLoading] = useState(false);
	const [fixtureActionMessage, setFixtureActionMessage] = useState<
		string | null
	>(null);

	// ── Audit state ─────────────────────────────────────────────────────
	const [auditEntries, setAuditEntries] = useState<McpAuditEntry[]>([]);
	const [auditLoading, setAuditLoading] = useState(false);

	// Load servers
	const loadServers = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const result = await listServers();
			setServers(result);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load servers");
		} finally {
			setLoading(false);
		}
	}, [listServers]);

	// Load audit entries
	const loadAudit = useCallback(async () => {
		setAuditLoading(true);
		try {
			const result = await listAudit(20);
			setAuditEntries(result);
		} catch {
			// ignore
		} finally {
			setAuditLoading(false);
		}
	}, [listAudit]);

	// ── Load fixture tools ──────────────────────────────────────────────
	const loadFixtureTools = useCallback(async () => {
		setFixtureToolLoading(true);
		try {
			const tools = await fixtureListTools();
			setFixtureTools(tools);
			const status = await fixtureStatus();
			// fixtureAvailable tracked by processStatus presence
			if (status.processStatus) {
				setFixtureProcessStatus(status.processStatus);
			}
			if (status.processError) {
				setFixtureProcessError(status.processError);
			}
		} catch {
			setFixtureTools([]);
			// fixtureAvailable cleared implicitly via processStatus
		} finally {
			setFixtureToolLoading(false);
		}
	}, [fixtureListTools, fixtureStatus]);

	// ── Fixture action handlers ─────────────────────────────────────────
	const handleFixtureStart = useCallback(async () => {
		setFixtureActionLoading(true);
		setFixtureActionMessage(null);
		setFixtureProcessError(null);
		try {
			const msg = await fixtureStart();
			setFixtureActionMessage(msg);
			await loadFixtureTools();
		} catch (err) {
			const errMsg = err instanceof Error ? err.message : String(err);
			setFixtureProcessError(errMsg);
			setFixtureActionMessage(null);
		} finally {
			setFixtureActionLoading(false);
		}
	}, [fixtureStart, loadFixtureTools]);

	const handleFixtureStop = useCallback(async () => {
		setFixtureActionLoading(true);
		setFixtureActionMessage(null);
		setFixtureProcessError(null);
		try {
			const msg = await fixtureStop();
			setFixtureActionMessage(msg);
			await loadFixtureTools();
		} catch (err) {
			const errMsg = err instanceof Error ? err.message : String(err);
			setFixtureProcessError(errMsg);
			setFixtureActionMessage(null);
		} finally {
			setFixtureActionLoading(false);
		}
	}, [fixtureStop, loadFixtureTools]);

	const handleFixtureRestart = useCallback(async () => {
		setFixtureActionLoading(true);
		setFixtureActionMessage(null);
		setFixtureProcessError(null);
		try {
			const msg = await fixtureRestart();
			setFixtureActionMessage(msg);
			await loadFixtureTools();
		} catch (err) {
			const errMsg = err instanceof Error ? err.message : String(err);
			setFixtureProcessError(errMsg);
			setFixtureActionMessage(null);
		} finally {
			setFixtureActionLoading(false);
		}
	}, [fixtureRestart, loadFixtureTools]);

	useEffect(() => {
		if (availability.available) {
			loadServers();
			loadAudit();
			loadFixtureTools();
		} else {
			setLoading(false);
		}
	}, [availability.available, loadServers, loadAudit, loadFixtureTools]);

	// ── Form helpers ────────────────────────────────────────────────────

	const openAddForm = () => {
		setEditingId(null);
		setFormData({
			name: "",
			transport: "stdio",
			command: "",
			args: [],
			cwd: "",
			envRefs: [],
			allowedPaths: [],
			enabled: false,
		});
		setFormErrors({});
		setShowForm(true);
	};

	const openEditForm = (server: McpServerConfig) => {
		setEditingId(server.id);
		setFormData({
			id: server.id,
			name: server.name,
			transport: server.transport,
			command: server.command,
			args: server.args,
			cwd: server.cwd || "",
			envRefs: server.envRefs,
			allowedPaths: server.allowedPaths,
			enabled: server.enabled,
		});
		setFormErrors({});
		setShowForm(true);
	};

	const closeForm = () => {
		setShowForm(false);
		setEditingId(null);
		setFormErrors({});
	};

	const handleSave = async () => {
		const errors: Record<string, string> = {};

		if (!formData.name.trim()) {
			errors.name = "Name is required";
		}
		if (!formData.command.trim()) {
			errors.command = "Command is required";
		}
		if (formData.transport !== "stdio") {
			errors.transport = 'Transport must be "stdio"';
		}

		if (Object.keys(errors).length > 0) {
			setFormErrors(errors);
			return;
		}

		try {
			const input: McpUpsertServerInput = {
				...(editingId ? { id: editingId } : {}),
				name: formData.name.trim(),
				transport: "stdio",
				command: formData.command.trim(),
				args: formData.args,
				cwd: formData.cwd?.trim() || undefined,
				envRefs: formData.envRefs,
				allowedPaths: formData.allowedPaths,
				enabled: formData.enabled,
			};

			await upsertServer(input);
			closeForm();
			await loadServers();
		} catch (err) {
			setFormErrors({
				submit: err instanceof Error ? err.message : "Save failed",
			});
		}
	};

	const handleDelete = async (serverId: string) => {
		try {
			await deleteServer(serverId);
			setDeleteConfirm(null);
			await loadServers();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Delete failed");
		}
	};

	// ── Tool proposal handlers ─────────────────────────────────────────

	const handlePrepare = async () => {
		setProposalError(null);
		setProposal(null);
		setResolveResult(null);

		if (!proposalServerId) {
			setProposalError("Please select a server");
			return;
		}
		if (!proposalToolName.trim()) {
			setProposalError("Please enter a tool name");
			return;
		}

		let parsedArgs: Record<string, unknown>;
		try {
			parsedArgs = JSON.parse(proposalArgsJson);
			if (typeof parsedArgs !== "object" || parsedArgs === null) {
				throw new Error("Args must be a JSON object");
			}
		} catch (e) {
			setProposalError(
				`Invalid JSON args: ${e instanceof Error ? e.message : String(e)}`,
			);
			return;
		}

		setPreparing(true);
		try {
			const result = await prepareToolCall({
				serverId: proposalServerId,
				tool: proposalToolName.trim(),
				args: parsedArgs,
				autonomous: false,
				description: `Manual test: ${proposalToolName.trim()}`,
			});
			setProposal(result);
		} catch (err) {
			setProposalError(err instanceof Error ? err.message : "Prepare failed");
		} finally {
			setPreparing(false);
		}
	};

	const handleResolve = async (decision: "deny" | "allow_once") => {
		if (!proposal) return;

		setResolveResult(null);
		try {
			const result = await resolveToolCall({
				proposalId: proposal.id,
				decision,
			});
			setResolveResult(
				`${decision === "deny" ? "Denied" : "Allowed"}: ${result.message}${result.error ? ` (${result.error})` : ""}`,
			);
			setProposal(null);
			await loadAudit();
		} catch (err) {
			setResolveResult(
				`Error: ${err instanceof Error ? err.message : String(err)}`,
			);
		}
	};

	const handleClearProposal = () => {
		setProposal(null);
		setResolveResult(null);
		setProposalError(null);
	};

	// ── Fixture tool selection ─────────────────────────────────────────

	const handleSelectFixtureTool = (
		serverId: string,
		toolName: string,
		defaultArgs: string,
	) => {
		setProposalServerId(serverId);
		setProposalToolName(toolName);
		setProposalArgsJson(defaultArgs);
	};

	// ── Render ──────────────────────────────────────────────────────────

	// Browser mode: unavailable
	if (!availability.available) {
		return (
			<div className="flex flex-col items-center justify-center h-full px-6 text-center">
				<div className="mb-4 w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
					<WifiOff className="h-6 w-6 text-text-tertiary" />
				</div>
				<h3 className="text-sm font-semibold text-text-primary mb-1">Tools</h3>
				<p className="text-xs text-text-tertiary leading-relaxed mb-4">
					{availability.reason}
				</p>
				<div className="w-full border border-border rounded-lg p-3 bg-surface-hover/30">
					<p className="text-[10px] text-text-tertiary leading-relaxed">
						Local tool execution is available only in the Flow Desktop
						application via Tauri. In browser mode, tool access is disabled to
						protect your system.
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className="flex flex-col h-full overflow-y-auto">
			{/* Header warning */}
			<div className="px-4 py-3 border-b border-border shrink-0 space-y-1">
				<div className="flex items-center gap-2">
					<Shield className="h-3.5 w-3.5 text-green-500 shrink-0" />
					<span className="text-xs font-semibold text-text-primary">
						Permission / Execution Layer
					</span>
				</div>
				<p className="text-[10px] text-text-tertiary leading-relaxed">
					Safe fixture tools (<strong>echo</strong>, <strong>get_time</strong>,{" "}
					<strong>add_numbers</strong>) can be executed after explicit{" "}
					<strong>Allow Once</strong> permission. Arbitrary configured MCP
					servers remain config-only and are not executable.
				</p>
			</div>

			<McpServerSection
				servers={servers}
				loading={loading}
				error={error}
				showForm={showForm}
				editingId={editingId}
				formData={formData}
				formErrors={formErrors}
				deleteConfirm={deleteConfirm}
				onOpenAdd={openAddForm}
				onOpenEdit={openEditForm}
				onConfirmDelete={handleDelete}
				onCancelDelete={() => setDeleteConfirm(null)}
				onCloseForm={closeForm}
				onSave={handleSave}
				onFormChange={setFormData}
				onDismissError={() => setError(null)}
			/>

			<McpFixtureSection
				fixtureProcessStatus={fixtureProcessStatus}
				fixtureProcessError={fixtureProcessError}
				fixtureActionLoading={fixtureActionLoading}
				fixtureActionMessage={fixtureActionMessage}
				fixtureToolLoading={fixtureToolLoading}
				fixtureTools={fixtureTools}
				servers={servers}
				onStart={handleFixtureStart}
				onStop={handleFixtureStop}
				onRestart={handleFixtureRestart}
				onSelectTool={handleSelectFixtureTool}
			/>

			<McpToolSection
				servers={servers}
				proposalServerId={proposalServerId}
				proposalToolName={proposalToolName}
				proposalArgsJson={proposalArgsJson}
				proposalError={proposalError}
				preparing={preparing}
				proposal={proposal}
				resolveResult={resolveResult}
				fixtureProcessStatus={fixtureProcessStatus}
				onServerIdChange={setProposalServerId}
				onToolNameChange={setProposalToolName}
				onArgsJsonChange={setProposalArgsJson}
				onPrepare={handlePrepare}
				onClear={handleClearProposal}
				onResolve={handleResolve}
			/>

			<McpAuditSection
				entries={auditEntries}
				loading={auditLoading}
				onRefresh={loadAudit}
			/>

			<McpSecurityNotes />
		</div>
	);
}
