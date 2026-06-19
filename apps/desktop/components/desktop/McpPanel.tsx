"use client";

/**
 * ─── Flow MCP Panel — Desktop Tools Tab ───────────────────────────────────
 *
 * Displays MCP availability, server configs list with add/edit/delete,
 * a manual tool proposal test form, permission dialog, and audit log.
 *
 * No tool execution is wired — proposals must be resolved via deny/allow_once.
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
	RiskLevel,
} from "@/lib/mcp-types";
import {
	Shield,
	Server,
	Clock,
	WifiOff,
	Plus,
	Edit,
	Trash2,
	Check,
	X,
	ToggleLeft,
	ToggleRight,
	Folder,
	Terminal,
	Variable,
	FolderTree,
	Play,
	Ban,
	Search,
	Square,
	RefreshCw,
} from "lucide-react";

// ─── Small UI helpers ──────────────────────────────────────────────────────

function InputField({
	label,
	value,
	onChange,
	placeholder,
	error,
	type = "text",
}: {
	label: string;
	value: string;
	onChange: (v: string) => void;
	placeholder?: string;
	error?: string;
	type?: string;
}) {
	return (
		<div className="space-y-1">
			<label className="text-[11px] font-medium text-text-secondary">
				{label}
			</label>
			<input
				type={type}
				value={value}
				onChange={(e) => onChange(e.target.value)}
				placeholder={placeholder}
				className="w-full px-2 py-1.5 text-xs bg-surface-hover border border-border rounded
					focus:outline-none focus:ring-1 focus:ring-accent/50 text-text-primary
					placeholder:text-text-tertiary/50"
			/>
			{error && <p className="text-[10px] text-red-400">{error}</p>}
		</div>
	);
}

function ToggleField({
	label,
	checked,
	onChange,
}: {
	label: string;
	checked: boolean;
	onChange: (v: boolean) => void;
}) {
	return (
		<div className="flex items-center gap-2">
			<span className="text-[11px] font-medium text-text-secondary">
				{label}
			</span>
			<button
				type="button"
				onClick={() => onChange(!checked)}
				className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
					checked
						? "bg-green-500/20 text-green-400"
						: "bg-surface-hover text-text-tertiary"
				}`}
			>
				{checked ? (
					<>
						<ToggleRight className="h-3 w-3" />
						Enabled
					</>
				) : (
					<>
						<ToggleLeft className="h-3 w-3" />
						Disabled
					</>
				)}
			</button>
		</div>
	);
}

function SelectField({
	label,
	value,
	onChange,
	options,
	placeholder,
}: {
	label: string;
	value: string;
	onChange: (v: string) => void;
	options: { value: string; label: string }[];
	placeholder?: string;
}) {
	return (
		<div className="space-y-1">
			<label className="text-[11px] font-medium text-text-secondary">
				{label}
			</label>
			<select
				value={value}
				onChange={(e) => onChange(e.target.value)}
				className="w-full px-2 py-1.5 text-xs bg-surface-hover border border-border rounded
					focus:outline-none focus:ring-1 focus:ring-accent/50 text-text-primary"
			>
				{placeholder && <option value="">{placeholder}</option>}
				{options.map((opt) => (
					<option key={opt.value} value={opt.value}>
						{opt.label}
					</option>
				))}
			</select>
		</div>
	);
}

function TextAreaField({
	label,
	value,
	onChange,
	placeholder,
	error,
	rows = 3,
}: {
	label: string;
	value: string;
	onChange: (v: string) => void;
	placeholder?: string;
	error?: string;
	rows?: number;
}) {
	return (
		<div className="space-y-1">
			<label className="text-[11px] font-medium text-text-secondary">
				{label}
			</label>
			<textarea
				value={value}
				onChange={(e) => onChange(e.target.value)}
				placeholder={placeholder}
				rows={rows}
				className="w-full px-2 py-1.5 text-xs bg-surface-hover border border-border rounded
					focus:outline-none focus:ring-1 focus:ring-accent/50 text-text-primary
					placeholder:text-text-tertiary/50 font-mono"
			/>
			{error && <p className="text-[10px] text-red-400">{error}</p>}
		</div>
	);
}

// ─── Risk level badge colors ───────────────────────────────────────────────

function RiskBadge({ level }: { level: RiskLevel }) {
	const colors: Record<RiskLevel, string> = {
		low: "bg-green-500/15 text-green-400",
		medium: "bg-yellow-500/15 text-yellow-400",
		high: "bg-orange-500/15 text-orange-400",
		critical: "bg-red-500/15 text-red-400",
	};
	return (
		<span
			className={`text-[10px] px-1.5 py-0.5 rounded font-medium uppercase ${colors[level]}`}
		>
			{level}
		</span>
	);
}

// ─── Main Component ────────────────────────────────────────────────────────

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
	const [fixtureAvailable, setFixtureAvailable] = useState(false);
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
			setFixtureAvailable(status.available);
			if (status.processStatus) {
				setFixtureProcessStatus(status.processStatus);
			}
			if (status.processError) {
				setFixtureProcessError(status.processError);
			}
		} catch {
			setFixtureTools([]);
			setFixtureAvailable(false);
		} finally {
			setFixtureToolLoading(false);
		}
	}, [fixtureListTools, fixtureStatus]);

	// ── Fixture action handlers ───────────────────────────────────────────
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
			// Refresh audit log
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

			{/* Server list */}
			<div className="px-4 py-3 border-b border-border shrink-0">
				<div className="flex items-center justify-between mb-2">
					<div className="flex items-center gap-2">
						<Server className="h-3.5 w-3.5 text-text-tertiary" />
						<span className="text-xs font-semibold text-text-primary">
							MCP Servers ({servers.length})
						</span>
					</div>
					{!showForm && (
						<button
							onClick={openAddForm}
							className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium
								bg-accent/10 text-accent rounded hover:bg-accent/20 transition-colors"
						>
							<Plus className="h-3 w-3" />
							Add Server
						</button>
					)}
				</div>

				{/* Error banner */}
				{error && (
					<div className="mb-2 px-2 py-1.5 bg-red-500/10 border border-red-500/20 rounded text-[10px] text-red-400">
						{error}
						<button
							onClick={() => setError(null)}
							className="ml-2 underline hover:no-underline"
						>
							Dismiss
						</button>
					</div>
				)}

				{/* Loading */}
				{loading && (
					<div className="flex items-center justify-center py-6">
						<div className="h-4 w-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
						<span className="ml-2 text-[10px] text-text-tertiary">
							Loading…
						</span>
					</div>
				)}

				{/* Empty state */}
				{!loading && servers.length === 0 && !showForm && (
					<div className="w-full border border-dashed border-border rounded-lg p-4 bg-surface-hover/20 text-center">
						<p className="text-xs text-text-tertiary">
							No MCP servers configured.
						</p>
						<p className="text-[10px] text-text-tertiary/60 mt-1">
							Click "Add Server" to configure your first MCP server. All configs
							are stored locally.
						</p>
					</div>
				)}

				{/* Server cards */}
				{!loading &&
					servers.map((server) => (
						<ServerCard
							key={server.id}
							server={server}
							onEdit={() => openEditForm(server)}
							onDelete={() => setDeleteConfirm(server.id)}
							confirming={deleteConfirm === server.id}
							onConfirmDelete={() => handleDelete(server.id)}
							onCancelDelete={() => setDeleteConfirm(null)}
						/>
					))}

				{/* Form */}
				{showForm && (
					<ServerForm
						editingId={editingId}
						formData={formData}
						formErrors={formErrors}
						onChange={setFormData}
						onSave={handleSave}
						onCancel={closeForm}
					/>
				)}
			</div>

			{/* ── Safe Fixture Server ─────────────────────────────────────── */}
			<div className="px-4 py-3 border-b border-border shrink-0">
				<div className="flex items-center justify-between mb-2">
					<div className="flex items-center gap-2">
						<Shield className="h-3.5 w-3.5 text-green-500" />
						<span className="text-xs font-semibold text-text-primary">
							Safe Fixture Server
						</span>
						{fixtureProcessStatus === "running" && (
							<span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-green-500/15 text-green-400">
								Running
							</span>
						)}
						{fixtureProcessStatus === "stopped" && (
							<span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-yellow-500/15 text-yellow-400">
								Stopped
							</span>
						)}
						{fixtureProcessStatus === "error" && (
							<span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-red-500/15 text-red-400">
								Error
							</span>
						)}
						{(!fixtureProcessStatus ||
							fixtureProcessStatus === "not_started") && (
							<span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-surface-hover text-text-tertiary">
								Not Started
							</span>
						)}
					</div>
					<div className="flex items-center gap-1">
						{fixtureProcessStatus === "running" ? (
							<button
								onClick={handleFixtureStop}
								disabled={fixtureActionLoading}
								className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium
									bg-red-500/15 text-red-400 rounded hover:bg-red-500/25 transition-colors
									disabled:opacity-50"
							>
								<Square className="h-3 w-3" />
								Stop
							</button>
						) : (
							<button
								onClick={handleFixtureStart}
								disabled={fixtureActionLoading}
								className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium
									bg-green-500/15 text-green-400 rounded hover:bg-green-500/25 transition-colors
									disabled:opacity-50"
							>
								<Play className="h-3 w-3" />
								Start
							</button>
						)}
						<button
							onClick={handleFixtureRestart}
							disabled={
								fixtureActionLoading || fixtureProcessStatus !== "running"
							}
							className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium
								bg-surface-hover text-text-tertiary rounded hover:text-text-secondary transition-colors
								disabled:opacity-50"
						>
							<RefreshCw className="h-3 w-3" />
							Restart
						</button>
					</div>
				</div>

				{/* Process error message */}
				{fixtureProcessError && (
					<div className="mb-2 px-2 py-1.5 bg-red-500/10 border border-red-500/20 rounded text-[10px] text-red-400">
						{fixtureProcessError}
					</div>
				)}

				{/* Action result message */}
				{fixtureActionMessage && (
					<div className="mb-2 px-2 py-1.5 bg-green-500/10 border border-green-500/20 rounded text-[10px] text-green-400">
						{fixtureActionMessage}
					</div>
				)}

				{fixtureActionLoading && (
					<div className="flex items-center justify-center py-2">
						<div className="h-3 w-3 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
					</div>
				)}

				{fixtureToolLoading ? (
					<div className="flex items-center justify-center py-3">
						<div className="h-3 w-3 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
					</div>
				) : fixtureTools.length === 0 ? (
					<div className="w-full border border-dashed border-border rounded-lg p-3 bg-surface-hover/20">
						<p className="text-xs text-text-tertiary text-center">
							Fixture server not available or not started. Click{" "}
							<strong>Start</strong> to launch it.
						</p>
					</div>
				) : (
					<div className="space-y-2">
						<p className="text-[10px] text-text-tertiary leading-relaxed">
							Built-in safe tools — purely computational, no network/fs/shell
							access. Select a tool below to prepare a call through the
							permission dialog. Tools are executed by the running stdio fixture
							process.
						</p>
						{fixtureProcessStatus && fixtureProcessStatus !== "running" && (
							<p className="text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded px-2 py-1 mt-1">
								⚠ Safe fixture server is not running. Start it before executing
								tools.
							</p>
						)}
						{fixtureTools.map((tool) => (
							<div
								key={tool.name}
								className="border border-border rounded-lg p-2.5 bg-surface-hover/20 hover:bg-surface-hover/40 transition-colors cursor-pointer"
								onClick={() => {
									// Find the fixture server in the servers list
									const fixtureSrv = servers.find(
										(s) => s.id === "builtin-safe-fixture",
									);
									setProposalServerId(fixtureSrv?.id ?? "");
									setProposalToolName(tool.name);
									// Build default args based on the tool
									if (tool.name === "echo") {
										setProposalArgsJson(
											JSON.stringify({ message: "hello" }, null, 2),
										);
									} else if (tool.name === "add_numbers") {
										setProposalArgsJson(
											JSON.stringify({ a: 3, b: 4 }, null, 2),
										);
									} else {
										setProposalArgsJson(JSON.stringify({}, null, 2));
									}
								}}
							>
								<div className="flex items-center justify-between mb-1">
									<span className="text-xs font-semibold text-text-primary">
										{tool.name}
									</span>
									<button
										className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium
											bg-accent/10 text-accent rounded hover:bg-accent/20 transition-colors"
										onClick={(e) => {
											e.stopPropagation();
											const fixtureSrv = servers.find(
												(s) => s.id === "builtin-safe-fixture",
											);
											setProposalServerId(fixtureSrv?.id ?? "");
											setProposalToolName(tool.name);
											if (tool.name === "echo") {
												setProposalArgsJson(
													JSON.stringify({ message: "hello" }, null, 2),
												);
											} else if (tool.name === "add_numbers") {
												setProposalArgsJson(
													JSON.stringify({ a: 3, b: 4 }, null, 2),
												);
											} else {
												setProposalArgsJson(JSON.stringify({}, null, 2));
											}
										}}
									>
										<Play className="h-3 w-3" />
										Prepare
									</button>
								</div>
								<p className="text-[10px] text-text-tertiary mb-1">
									{tool.description}
								</p>
								<div className="text-[9px] text-text-tertiary/60 font-mono bg-surface-hover rounded px-1.5 py-1 overflow-x-auto">
									Schema: {JSON.stringify(tool.inputSchema)}
								</div>
							</div>
						))}
					</div>
				)}
				<div className="mt-2 text-[9px] text-text-tertiary/50">
					Configured arbitrary MCP servers below remain config-only — not
					executable.
				</div>
			</div>

			{/* ── Tool Proposal Test Form ─────────────────────────────────── */}
			<div className="px-4 py-3 border-b border-border shrink-0">
				<div className="flex items-center gap-2 mb-2">
					<Play className="h-3.5 w-3.5 text-text-tertiary" />
					<span className="text-xs font-semibold text-text-primary">
						Prepare Tool Call
					</span>
				</div>

				{servers.length === 0 ? (
					<div className="w-full border border-dashed border-border rounded-lg p-3 bg-surface-hover/20">
						<p className="text-xs text-text-tertiary text-center">
							Add a server first to test tool proposals.
						</p>
					</div>
				) : (
					<div className="space-y-2">
						<SelectField
							label="Server"
							value={proposalServerId}
							onChange={setProposalServerId}
							options={servers.map((s) => ({
								value: s.id,
								label: `${s.name}${s.enabled ? "" : " (disabled)"}`,
							}))}
							placeholder="Select a server…"
						/>
						<InputField
							label="Tool Name"
							value={proposalToolName}
							onChange={setProposalToolName}
							placeholder="e.g. read_file, echo, execute_command"
						/>
						<TextAreaField
							label="Arguments (JSON)"
							value={proposalArgsJson}
							onChange={setProposalArgsJson}
							placeholder='{"path": "/tmp/test.txt"}'
							rows={3}
						/>

						{proposalError && (
							<p className="text-[10px] text-red-400">{proposalError}</p>
						)}

						<div className="flex items-center gap-2 pt-1">
							<button
								onClick={handlePrepare}
								disabled={preparing}
								className="flex items-center gap-1 px-3 py-1.5 text-[10px] font-medium
									bg-accent/10 text-accent rounded hover:bg-accent/20 transition-colors
									disabled:opacity-50"
							>
								<Search className="h-3 w-3" />
								{preparing ? "Preparing…" : "Prepare"}
							</button>
							<button
								onClick={handleClearProposal}
								className="flex items-center gap-1 px-3 py-1.5 text-[10px] font-medium
									bg-surface-hover text-text-tertiary rounded hover:text-text-secondary transition-colors"
							>
								<X className="h-3 w-3" />
								Clear
							</button>
						</div>
					</div>
				)}
			</div>

			{/* ── Permission Dialog ───────────────────────────────────────── */}
			{proposal && (
				<div className="px-4 py-3 border-b border-border shrink-0">
					<div className="flex items-center gap-2 mb-2">
						<Shield className="h-3.5 w-3.5 text-amber-500" />
						<span className="text-xs font-semibold text-text-primary">
							Permission Required
						</span>
					</div>
					<div className="border border-border rounded-lg p-3 bg-surface-hover/30 space-y-2">
						<div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[10px]">
							<span className="text-text-tertiary">Server:</span>
							<span className="text-text-primary font-medium">
								{proposal.serverName}
							</span>
							<span className="text-text-tertiary">Tool:</span>
							<span className="text-text-primary font-medium">
								{proposal.toolName}
							</span>
							<span className="text-text-tertiary">Risk:</span>
							<div className="flex items-center gap-2">
								<RiskBadge level={proposal.riskLevel} />
							</div>
							<span className="text-text-tertiary">Created:</span>
							<span className="text-text-primary">{proposal.createdAt}</span>
						</div>

						{proposal.riskReasons.length > 0 && (
							<div>
								<span className="text-[10px] text-text-tertiary block mb-0.5">
									Risk reasons:
								</span>
								<ul className="text-[10px] text-text-secondary space-y-0.5 ml-3 list-disc">
									{proposal.riskReasons.map((r, i) => (
										<li key={i}>{r}</li>
									))}
								</ul>
							</div>
						)}

						<div>
							<span className="text-[10px] text-text-tertiary block mb-0.5">
								Arguments (redacted):
							</span>
							<pre className="text-[10px] bg-surface-hover p-2 rounded border border-border overflow-x-auto max-h-32 overflow-y-auto font-mono">
								{JSON.stringify(proposal.argsRedacted, null, 2)}
							</pre>
						</div>

						<div className="flex items-center gap-2 pt-1">
							<button
								onClick={() => handleResolve("allow_once")}
								disabled={
									fixtureProcessStatus !== "running" &&
									proposal.serverId === "builtin-safe-fixture"
								}
								className="flex items-center gap-1 px-3 py-1.5 text-[10px] font-medium
									bg-green-500/15 text-green-400 rounded hover:bg-green-500/25 transition-colors
									disabled:opacity-50 disabled:cursor-not-allowed"
								title={
									fixtureProcessStatus !== "running" &&
									proposal.serverId === "builtin-safe-fixture"
										? "Start the safe fixture server first"
										: "Allow once"
								}
							>
								<Play className="h-3 w-3" />
								Allow Once
							</button>
							<button
								onClick={() => handleResolve("deny")}
								className="flex items-center gap-1 px-3 py-1.5 text-[10px] font-medium
									bg-red-500/15 text-red-400 rounded hover:bg-red-500/25 transition-colors"
							>
								<Ban className="h-3 w-3" />
								Deny
							</button>
							<button
								onClick={handleClearProposal}
								className="flex items-center gap-1 px-3 py-1.5 text-[10px] font-medium
									bg-surface-hover text-text-tertiary rounded hover:text-text-secondary transition-colors"
							>
								<X className="h-3 w-3" />
								Cancel
							</button>
						</div>
					</div>

					{resolveResult && (
						<div
							className={`mt-2 px-2 py-1.5 rounded text-[10px] ${
								resolveResult.startsWith("Denied")
									? "bg-red-500/10 text-red-400 border border-red-500/20"
									: resolveResult.startsWith("Allowed")
										? "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20"
										: "bg-surface-hover text-text-tertiary border border-border"
							}`}
						>
							{resolveResult}
						</div>
					)}
				</div>
			)}

			{/* ── Audit Log ──────────────────────────────────────────────── */}
			<div className="px-4 py-3 border-b border-border shrink-0">
				<div className="flex items-center justify-between mb-2">
					<div className="flex items-center gap-2">
						<Clock className="h-3.5 w-3.5 text-text-tertiary" />
						<span className="text-xs font-semibold text-text-primary">
							Audit Log
						</span>
					</div>
					<button
						onClick={loadAudit}
						disabled={auditLoading}
						className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium
							bg-surface-hover text-text-tertiary rounded hover:text-text-secondary transition-colors"
					>
						Refresh
					</button>
				</div>

				{auditLoading && (
					<div className="flex items-center justify-center py-3">
						<div className="h-3 w-3 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
					</div>
				)}

				{!auditLoading && auditEntries.length === 0 && (
					<div className="w-full border border-dashed border-border rounded-lg p-3 bg-surface-hover/20">
						<p className="text-xs text-text-tertiary text-center">
							No audit entries.
						</p>
						<p className="text-[10px] text-text-tertiary/60 text-center mt-1">
							Use the "Prepare Tool Call" form above to create audit records.
						</p>
					</div>
				)}

				{!auditLoading && auditEntries.length > 0 && (
					<div className="space-y-1.5 max-h-48 overflow-y-auto">
						{auditEntries.map((entry) => (
							<AuditEntryCard key={entry.id} entry={entry} />
						))}
					</div>
				)}
			</div>

			{/* Security notes */}
			<div className="px-4 py-3 flex-1">
				<div className="flex items-center gap-2 mb-2">
					<Shield className="h-3.5 w-3.5 text-green-500" />
					<span className="text-xs font-semibold text-text-primary">
						Security
					</span>
				</div>
				<ul className="space-y-1.5 text-[10px] text-text-tertiary leading-relaxed">
					<li className="flex items-start gap-1.5">
						<span className="text-green-500 mt-0.5">•</span>
						<span>
							Only built-in safe fixture tools (<strong>echo</strong>,{" "}
							<strong>get_time</strong>, <strong>add_numbers</strong>) can
							execute.
						</span>
					</li>
					<li className="flex items-start gap-1.5">
						<span className="text-green-500 mt-0.5">•</span>
						<span>
							All tool calls require explicit user permission (proposal →
							resolve flow).
						</span>
					</li>
					<li className="flex items-start gap-1.5">
						<span className="text-green-500 mt-0.5">•</span>
						<span>
							Audit log persists to disk — every attempt is recorded with
							server, tool, arguments, and decision.
						</span>
					</li>
					<li className="flex items-start gap-1.5">
						<span className="text-green-500 mt-0.5">•</span>
						<span>
							Secret field values (keys, tokens, passwords) are redacted before
							audit storage.
						</span>
					</li>
					<li className="flex items-start gap-1.5">
						<span className="text-green-500 mt-0.5">•</span>
						<span>
							Configured arbitrary MCP servers remain config-only — not
							executable.
						</span>
					</li>
				</ul>
			</div>
		</div>
	);
}

// ─── Server Card ───────────────────────────────────────────────────────────

function ServerCard({
	server,
	onEdit,
	onDelete,
	confirming,
	onConfirmDelete,
	onCancelDelete,
}: {
	server: McpServerConfig;
	onEdit: () => void;
	onDelete: () => void;
	confirming: boolean;
	onConfirmDelete: () => void;
	onCancelDelete: () => void;
}) {
	return (
		<div className="border border-border rounded-lg p-3 mb-2 bg-surface-hover/20">
			<div className="flex items-start justify-between mb-1.5">
				<div className="flex items-center gap-2 min-w-0">
					<span
						className={`inline-block w-2 h-2 rounded-full shrink-0 ${
							server.enabled ? "bg-green-500" : "bg-text-tertiary/50"
						}`}
					/>
					<span className="text-xs font-semibold text-text-primary truncate">
						{server.name}
					</span>
					<span
						className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
							server.enabled
								? "bg-green-500/15 text-green-400"
								: "bg-surface-hover text-text-tertiary"
						}`}
					>
						{server.enabled ? "Enabled" : "Disabled"}
					</span>
				</div>
				<div className="flex items-center gap-0.5 shrink-0 ml-2">
					<button
						onClick={onEdit}
						className="p-1 rounded hover:bg-accent/10 text-text-tertiary hover:text-accent transition-colors"
						title="Edit server"
					>
						<Edit className="h-3 w-3" />
					</button>
					<button
						onClick={onDelete}
						className="p-1 rounded hover:bg-red-500/10 text-text-tertiary hover:text-red-400 transition-colors"
						title="Delete server"
					>
						<Trash2 className="h-3 w-3" />
					</button>
				</div>
			</div>

			{/* Detail fields */}
			<div className="space-y-1 ml-4">
				<DetailRow icon={<Terminal className="h-3 w-3" />} label="Command">
					<code className="text-[10px] bg-surface-hover px-1 rounded">
						{server.command}
					</code>
					{server.args.length > 0 && (
						<span className="text-[10px] text-text-tertiary">
							{" "}
							{server.args.join(" ")}
						</span>
					)}
				</DetailRow>

				{server.cwd && (
					<DetailRow icon={<Folder className="h-3 w-3" />} label="CWD">
						<code className="text-[10px] bg-surface-hover px-1 rounded">
							{server.cwd}
						</code>
					</DetailRow>
				)}

				{server.envRefs.length > 0 && (
					<DetailRow icon={<Variable className="h-3 w-3" />} label="Env refs">
						<div className="flex flex-wrap gap-1">
							{server.envRefs.map((ref) => (
								<code
									key={ref}
									className="text-[10px] bg-surface-hover px-1 rounded text-text-tertiary"
								>
									{ref}
								</code>
							))}
						</div>
					</DetailRow>
				)}

				{server.allowedPaths.length > 0 && (
					<DetailRow icon={<FolderTree className="h-3 w-3" />} label="Paths">
						<div className="flex flex-wrap gap-1">
							{server.allowedPaths.map((p) => (
								<code
									key={p}
									className="text-[10px] bg-surface-hover px-1 rounded text-text-tertiary"
								>
									{p}
								</code>
							))}
						</div>
					</DetailRow>
				)}
			</div>

			{/* Delete confirmation */}
			{confirming && (
				<div className="mt-2 flex items-center gap-2 px-2 py-1.5 bg-red-500/10 border border-red-500/20 rounded text-[10px]">
					<span className="text-red-400">Delete {server.name}?</span>
					<button
						onClick={onConfirmDelete}
						className="px-2 py-0.5 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 transition-colors font-medium"
					>
						Delete
					</button>
					<button
						onClick={onCancelDelete}
						className="px-2 py-0.5 bg-surface-hover text-text-tertiary rounded hover:text-text-secondary transition-colors"
					>
						Cancel
					</button>
				</div>
			)}
		</div>
	);
}

function DetailRow({
	icon,
	label,
	children,
}: {
	icon: React.ReactNode;
	label: string;
	children: React.ReactNode;
}) {
	return (
		<div className="flex items-start gap-1.5">
			<span className="text-text-tertiary mt-0.5 shrink-0">{icon}</span>
			<span className="text-[10px] text-text-tertiary shrink-0">{label}:</span>
			<div className="min-w-0">{children}</div>
		</div>
	);
}

// ─── Server Form ────────────────────────────────────────────────────────────

function ServerForm({
	editingId,
	formData,
	formErrors,
	onChange,
	onSave,
	onCancel,
}: {
	editingId: string | null;
	formData: McpUpsertServerInput;
	formErrors: Record<string, string>;
	onChange: (data: McpUpsertServerInput) => void;
	onSave: () => void;
	onCancel: () => void;
}) {
	const update = (partial: Partial<McpUpsertServerInput>) => {
		onChange({ ...formData, ...partial });
	};

	return (
		<div className="border border-border rounded-lg p-3 mb-2 bg-surface-hover/30">
			<div className="flex items-center justify-between mb-2">
				<span className="text-xs font-semibold text-text-primary">
					{editingId ? "Edit Server" : "Add Server"}
				</span>
				<span className="text-[10px] text-text-tertiary">
					Configs are local only
				</span>
			</div>

			<div className="space-y-2">
				<InputField
					label="Name *"
					value={formData.name}
					onChange={(v) => update({ name: v })}
					placeholder="My MCP Server"
					error={formErrors.name}
				/>

				<InputField
					label="Command *"
					value={formData.command}
					onChange={(v) => update({ command: v })}
					placeholder="npx, uvx, or absolute path"
					error={formErrors.command}
				/>

				<InputField
					label="Arguments (comma-separated)"
					value={formData.args?.join(", ") ?? ""}
					onChange={(v) => update({ args: parseCommaList(v) })}
					placeholder="--port, 8080"
				/>

				<InputField
					label="Working Directory (optional)"
					value={formData.cwd ?? ""}
					onChange={(v) => update({ cwd: v || undefined })}
					placeholder="/absolute/path/to/project"
				/>

				<InputField
					label="Environment variable names (comma-separated, names only)"
					value={formData.envRefs?.join(", ") ?? ""}
					onChange={(v) => update({ envRefs: parseCommaList(v) })}
					placeholder="API_KEY, DB_URL"
				/>

				<InputField
					label="Allowed paths (comma-separated)"
					value={formData.allowedPaths?.join(", ") ?? ""}
					onChange={(v) => update({ allowedPaths: parseCommaList(v) })}
					placeholder="/path/to/dir, /another/path"
				/>

				<ToggleField
					label="Enabled"
					checked={formData.enabled}
					onChange={(v) => update({ enabled: v })}
				/>

				{formErrors.transport && (
					<p className="text-[10px] text-red-400">{formErrors.transport}</p>
				)}

				{formErrors.submit && (
					<p className="text-[10px] text-red-400">{formErrors.submit}</p>
				)}

				{/* Action buttons */}
				<div className="flex items-center gap-2 pt-1">
					<button
						onClick={onSave}
						className="flex items-center gap-1 px-3 py-1.5 text-[10px] font-medium
							bg-accent/10 text-accent rounded hover:bg-accent/20 transition-colors"
					>
						<Check className="h-3 w-3" />
						{editingId ? "Update" : "Create"}
					</button>
					<button
						onClick={onCancel}
						className="flex items-center gap-1 px-3 py-1.5 text-[10px] font-medium
							bg-surface-hover text-text-tertiary rounded hover:text-text-secondary transition-colors"
					>
						<X className="h-3 w-3" />
						Cancel
					</button>
				</div>
			</div>
		</div>
	);
}

// ─── Audit Entry Card ──────────────────────────────────────────────────────

function AuditEntryCard({ entry }: { entry: McpAuditEntry }) {
	const statusColors: Record<string, string> = {
		denied: "bg-red-500/10 text-red-400 border-red-500/20",
		disabled: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
		allowed: "bg-green-500/10 text-green-400 border-green-500/20",
		pending: "bg-blue-500/10 text-blue-400 border-blue-500/20",
		error: "bg-red-500/10 text-red-400 border-red-500/20",
	};
	const colorClass = statusColors[entry.status] || statusColors.pending;

	return (
		<div
			className={`border rounded px-2 py-1.5 ${colorClass} text-[10px] space-y-0.5`}
		>
			<div className="flex items-center justify-between">
				<span className="font-medium">
					{entry.serverName}/{entry.toolName}
				</span>
				<span className="uppercase opacity-70">{entry.status}</span>
			</div>
			<div className="flex items-center gap-2 text-[9px] opacity-70">
				<span>{entry.createdAt}</span>
				{entry.durationMs !== undefined && entry.durationMs !== null && (
					<span>{entry.durationMs}ms</span>
				)}
			</div>
			{entry.argsSummary && (
				<div className="opacity-70 truncate">{entry.argsSummary}</div>
			)}
			{entry.error && <div className="opacity-70">Error: {entry.error}</div>}
		</div>
	);
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function parseCommaList(val: string): string[] {
	return val
		.split(",")
		.map((s) => s.trim())
		.filter((s) => s.length > 0);
}
