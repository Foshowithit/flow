"use client";

/**
 * ─── MCP Fixture Section — fixture server controls and built-in tool grid ─────
 */

import {
	Shield,
	Square,
	Play,
	RefreshCw,
} from "lucide-react";
import type { McpFixtureProcessStatus, McpFixtureToolDefinition } from "@/lib/mcp-types";

// ─── Props ───────────────────────────────────────────────────────────────

export interface McpFixtureSectionProps {
	fixtureProcessStatus: McpFixtureProcessStatus | null;
	fixtureProcessError: string | null;
	fixtureActionLoading: boolean;
	fixtureActionMessage: string | null;
	fixtureToolLoading: boolean;
	fixtureTools: McpFixtureToolDefinition[];
	servers: { id: string }[];
	onStart: () => void;
	onStop: () => void;
	onRestart: () => void;
	onSelectTool: (serverId: string, toolName: string, defaultArgs: string) => void;
}

// ─── Component ───────────────────────────────────────────────────────────

export default function McpFixtureSection({
	fixtureProcessStatus,
	fixtureProcessError,
	fixtureActionLoading,
	fixtureActionMessage,
	fixtureToolLoading,
	fixtureTools,
	servers,
	onStart,
	onStop,
	onRestart,
	onSelectTool,
}: McpFixtureSectionProps) {
	const statusBadge = () => {
		if (fixtureProcessStatus === "running") {
			return (
				<span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-green-500/15 text-green-400">
					Running
				</span>
			);
		}
		if (fixtureProcessStatus === "stopped") {
			return (
				<span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-yellow-500/15 text-yellow-400">
					Stopped
				</span>
			);
		}
		if (fixtureProcessStatus === "error") {
			return (
				<span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-red-500/15 text-red-400">
					Error
				</span>
			);
		}
		return (
			<span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-surface-hover text-text-tertiary">
				Not Started
			</span>
		);
	};

	const buildDefaultArgs = (toolName: string): string => {
		if (toolName === "echo") {
			return JSON.stringify({ message: "hello" }, null, 2);
		}
		if (toolName === "add_numbers") {
			return JSON.stringify({ a: 3, b: 4 }, null, 2);
		}
		return JSON.stringify({}, null, 2);
	};

	return (
		<div className="px-4 py-3 border-b border-border shrink-0">
			{/* Header */}
			<div className="flex items-center justify-between mb-2">
				<div className="flex items-center gap-2">
					<Shield className="h-3.5 w-3.5 text-green-500" />
					<span className="text-xs font-semibold text-text-primary">
						Safe Fixture Server
					</span>
					{statusBadge()}
				</div>
				<div className="flex items-center gap-1">
					{fixtureProcessStatus === "running" ? (
						<button
							onClick={onStop}
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
							onClick={onStart}
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
						onClick={onRestart}
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

			{/* Tool grid */}
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
					{fixtureTools.map((tool) => {
						const fixtureSrv = servers.find(
							(s) => s.id === "builtin-safe-fixture",
						);
						return (
							<div
								key={tool.name}
								className="border border-border rounded-lg p-2.5 bg-surface-hover/20 hover:bg-surface-hover/40 transition-colors cursor-pointer"
								onClick={() => {
									onSelectTool(
										fixtureSrv?.id ?? "",
										tool.name,
										buildDefaultArgs(tool.name),
									);
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
											onSelectTool(
												fixtureSrv?.id ?? "",
												tool.name,
												buildDefaultArgs(tool.name),
											);
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
						);
					})}
				</div>
			)}
			<div className="mt-2 text-[9px] text-text-tertiary/50">
				Configured arbitrary MCP servers below remain config-only — not
				executable.
			</div>
		</div>
	);
}
