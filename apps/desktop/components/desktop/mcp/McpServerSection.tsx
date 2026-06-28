"use client";

/**
 * ─── MCP Server Section — server list, cards, and add/edit form ──────────────
 */

import { useMemo } from "react";
import {
	Server,
	Plus,
	Edit,
	Trash2,
	Terminal,
	Folder,
	Variable,
	FolderTree,
	Check,
	X,
} from "lucide-react";
import type { McpServerConfig, McpUpsertServerInput } from "@/lib/mcp-types";
import {
	InputField,
	ToggleField,
	DetailRow,
	parseCommaList,
} from "./helpers";

// ─── Props ───────────────────────────────────────────────────────────────

export interface McpServerSectionProps {
	servers: McpServerConfig[];
	loading: boolean;
	error: string | null;
	showForm: boolean;
	editingId: string | null;
	formData: McpUpsertServerInput;
	formErrors: Record<string, string>;
	deleteConfirm: string | null;
	onOpenAdd: () => void;
	onOpenEdit: (server: McpServerConfig) => void;
	onConfirmDelete: (id: string) => void;
	onCancelDelete: () => void;
	onCloseForm: () => void;
	onSave: () => void;
	onFormChange: (data: McpUpsertServerInput) => void;
	onDismissError: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────

export default function McpServerSection({
	servers,
	loading,
	error,
	showForm,
	editingId,
	formData,
	formErrors,
	deleteConfirm,
	onOpenAdd,
	onOpenEdit,
	onConfirmDelete,
	onCancelDelete,
	onCloseForm,
	onSave,
	onFormChange,
	onDismissError,
}: McpServerSectionProps) {
	return (
		<div className="px-4 py-3 border-b border-border shrink-0">
			{/* Header */}
			<div className="flex items-center justify-between mb-2">
				<div className="flex items-center gap-2">
					<Server className="h-3.5 w-3.5 text-text-tertiary" />
					<span className="text-xs font-semibold text-text-primary">
						MCP Servers ({servers.length})
					</span>
				</div>
				{!showForm && (
					<button
						onClick={onOpenAdd}
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
						onClick={onDismissError}
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
					<span className="ml-2 text-[10px] text-text-tertiary">Loading…</span>
				</div>
			)}

			{/* Empty state */}
			{!loading && servers.length === 0 && !showForm && (
				<div className="w-full border border-dashed border-border rounded-lg p-4 bg-surface-hover/20 text-center">
					<p className="text-xs text-text-tertiary">
						No MCP servers configured.
					</p>
					<p className="text-[10px] text-text-tertiary/60 mt-1">
						Click &ldquo;Add Server&rdquo; to configure your first MCP server. All configs
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
						onEdit={() => onOpenEdit(server)}
						onDelete={() => onConfirmDelete(server.id)}
						confirming={deleteConfirm === server.id}
						onConfirmDelete={() => onConfirmDelete(server.id)}
						onCancelDelete={onCancelDelete}
					/>
				))}

			{/* Form */}
			{showForm && (
				<ServerForm
					editingId={editingId}
					formData={formData}
					formErrors={formErrors}
					onChange={onFormChange}
					onSave={onSave}
					onCancel={onCloseForm}
				/>
			)}
		</div>
	);
}

// ─── ServerCard ──────────────────────────────────────────────────────────

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

// ─── ServerForm ──────────────────────────────────────────────────────────

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
