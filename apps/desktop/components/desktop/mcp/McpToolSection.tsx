"use client";

/**
 * ─── MCP Tool Section — proposal form and permission dialog ──────────────────
 */

import { Play, Search, X, Ban, Shield } from "lucide-react";
import type { McpPermissionProposal } from "@/lib/mcp-types";
import { InputField, TextAreaField, SelectField, RiskBadge } from "./helpers";

// ─── Props ───────────────────────────────────────────────────────────────

export interface McpToolSectionProps {
	servers: { id: string; name: string; enabled: boolean }[];
	proposalServerId: string;
	proposalToolName: string;
	proposalArgsJson: string;
	proposalError: string | null;
	preparing: boolean;
	proposal: McpPermissionProposal | null;
	resolveResult: string | null;
	fixtureProcessStatus: string | null;
	onServerIdChange: (v: string) => void;
	onToolNameChange: (v: string) => void;
	onArgsJsonChange: (v: string) => void;
	onPrepare: () => void;
	onClear: () => void;
	onResolve: (decision: "deny" | "allow_once") => void;
}

// ─── Component ───────────────────────────────────────────────────────────

export default function McpToolSection({
	servers,
	proposalServerId,
	proposalToolName,
	proposalArgsJson,
	proposalError,
	preparing,
	proposal,
	resolveResult,
	fixtureProcessStatus,
	onServerIdChange,
	onToolNameChange,
	onArgsJsonChange,
	onPrepare,
	onClear,
	onResolve,
}: McpToolSectionProps) {
	return (
		<>
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
							onChange={onServerIdChange}
							options={servers.map((s) => ({
								value: s.id,
								label: `${s.name}${s.enabled ? "" : " (disabled)"}`,
							}))}
							placeholder="Select a server…"
						/>
						<InputField
							label="Tool Name"
							value={proposalToolName}
							onChange={onToolNameChange}
							placeholder="e.g. read_file, echo, execute_command"
						/>
						<TextAreaField
							label="Arguments (JSON)"
							value={proposalArgsJson}
							onChange={onArgsJsonChange}
							placeholder='{"path": "/tmp/test.txt"}'
							rows={3}
						/>

						{proposalError && (
							<p className="text-[10px] text-red-400">{proposalError}</p>
						)}

						<div className="flex items-center gap-2 pt-1">
							<button
								onClick={onPrepare}
								disabled={preparing}
								className="flex items-center gap-1 px-3 py-1.5 text-[10px] font-medium
									bg-accent/10 text-accent rounded hover:bg-accent/20 transition-colors
									disabled:opacity-50"
							>
								<Search className="h-3 w-3" />
								{preparing ? "Preparing…" : "Prepare"}
							</button>
							<button
								onClick={onClear}
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
								onClick={() => onResolve("allow_once")}
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
								onClick={() => onResolve("deny")}
								className="flex items-center gap-1 px-3 py-1.5 text-[10px] font-medium
									bg-red-500/15 text-red-400 rounded hover:bg-red-500/25 transition-colors"
							>
								<Ban className="h-3 w-3" />
								Deny
							</button>
							<button
								onClick={onClear}
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
		</>
	);
}
