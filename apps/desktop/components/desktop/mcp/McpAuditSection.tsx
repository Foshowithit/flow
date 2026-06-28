"use client";

/**
 * ─── MCP Audit Section — audit log with entries ──────────────────────────────
 */

import { Clock } from "lucide-react";
import type { McpAuditEntry } from "@/lib/mcp-types";

// ─── Props ───────────────────────────────────────────────────────────────

export interface McpAuditSectionProps {
	entries: McpAuditEntry[];
	loading: boolean;
	onRefresh: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────

export default function McpAuditSection({
	entries,
	loading,
	onRefresh,
}: McpAuditSectionProps) {
	return (
		<div className="px-4 py-3 border-b border-border shrink-0">
			<div className="flex items-center justify-between mb-2">
				<div className="flex items-center gap-2">
					<Clock className="h-3.5 w-3.5 text-text-tertiary" />
					<span className="text-xs font-semibold text-text-primary">
						Audit Log
					</span>
				</div>
				<button
					onClick={onRefresh}
					disabled={loading}
					className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium
						bg-surface-hover text-text-tertiary rounded hover:text-text-secondary transition-colors"
				>
					Refresh
				</button>
			</div>

			{loading && (
				<div className="flex items-center justify-center py-3">
					<div className="h-3 w-3 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
				</div>
			)}

			{!loading && entries.length === 0 && (
				<div className="w-full border border-dashed border-border rounded-lg p-3 bg-surface-hover/20">
					<p className="text-xs text-text-tertiary text-center">
						No audit entries.
					</p>
					<p className="text-[10px] text-text-tertiary/60 text-center mt-1">
						Use the &ldquo;Prepare Tool Call&rdquo; form above to create audit records.
					</p>
				</div>
			)}

			{!loading && entries.length > 0 && (
				<div className="space-y-1.5 max-h-48 overflow-y-auto">
					{entries.map((entry) => (
						<AuditEntryCard key={entry.id} entry={entry} />
					))}
				</div>
			)}
		</div>
	);
}

// ─── AuditEntryCard ──────────────────────────────────────────────────────

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
