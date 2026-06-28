"use client";

/**
 * ─── MCP Security Notes — static info about security model ──────────────────
 */

import { Shield } from "lucide-react";

export default function McpSecurityNotes() {
	return (
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
	);
}
