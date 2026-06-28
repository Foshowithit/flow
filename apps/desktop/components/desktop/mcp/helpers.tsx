"use client";

/**
 * ─── Shared UI primitives for MCP panel components ────────────────────────────
 */

import type { RiskLevel } from "@/lib/mcp-types";

// ─── InputField ───────────────────────────────────────────────────────────

export function InputField({
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
		<div>
			<label className="block text-[10px] text-text-tertiary mb-0.5">
				{label}
			</label>
			<input
				type={type}
				value={value}
				onChange={(e) => onChange(e.target.value)}
				placeholder={placeholder}
				className={`w-full px-2 py-1.5 text-[11px] bg-surface border rounded
					${error ? "border-red-500/50 focus:border-red-500" : "border-border focus:border-accent"}
					text-text-primary placeholder:text-text-tertiary/50 outline-none transition-colors`}
			/>
			{error && (
				<p className="text-[9px] text-red-400 mt-0.5">{error}</p>
			)}
		</div>
	);
}

// ─── ToggleField ──────────────────────────────────────────────────────────

export function ToggleField({
	label,
	checked,
	onChange,
}: {
	label: string;
	checked: boolean;
	onChange: (v: boolean) => void;
}) {
	return (
		<div className="flex items-center justify-between">
			<span className="text-[10px] text-text-tertiary">{label}</span>
			<button
				onClick={() => onChange(!checked)}
				className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${
					checked ? "bg-accent" : "bg-surface-hover"
				}`}
			>
				<span
					className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
						checked ? "translate-x-[14px]" : "translate-x-[2px]"
					}`}
				/>
			</button>
		</div>
	);
}

// ─── SelectField ──────────────────────────────────────────────────────────

export function SelectField({
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
		<div>
			<label className="block text-[10px] text-text-tertiary mb-0.5">
				{label}
			</label>
			<select
				value={value}
				onChange={(e) => onChange(e.target.value)}
				className="w-full px-2 py-1.5 text-[11px] bg-surface border border-border rounded
					text-text-primary outline-none focus:border-accent transition-colors appearance-none"
			>
				{placeholder && (
					<option value="" disabled>
						{placeholder}
					</option>
				)}
				{options.map((opt) => (
					<option key={opt.value} value={opt.value}>
						{opt.label}
					</option>
				))}
			</select>
		</div>
	);
}

// ─── TextAreaField ────────────────────────────────────────────────────────

export function TextAreaField({
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
		<div>
			<label className="block text-[10px] text-text-tertiary mb-0.5">
				{label}
			</label>
			<textarea
				value={value}
				onChange={(e) => onChange(e.target.value)}
				placeholder={placeholder}
				rows={rows}
				className={`w-full px-2 py-1.5 text-[11px] bg-surface border rounded resize-none
					${error ? "border-red-500/50 focus:border-red-500" : "border-border focus:border-accent"}
					text-text-primary placeholder:text-text-tertiary/50 outline-none transition-colors font-mono`}
			/>
			{error && (
				<p className="text-[9px] text-red-400 mt-0.5">{error}</p>
			)}
		</div>
	);
}

// ─── RiskBadge ────────────────────────────────────────────────────────────

export function RiskBadge({ level }: { level: RiskLevel }) {
	const colors: Record<string, string> = {
		none: "bg-green-500/15 text-green-400",
		low: "bg-blue-500/15 text-blue-400",
		medium: "bg-yellow-500/15 text-yellow-400",
		high: "bg-orange-500/15 text-orange-400",
		critical: "bg-red-500/15 text-red-400",
	};
	return (
		<span
			className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${colors[level] || colors["none"]}`}
		>
			{level}
		</span>
	);
}

// ─── DetailRow ────────────────────────────────────────────────────────────

export function DetailRow({
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

// ─── parseCommaList ───────────────────────────────────────────────────────

export function parseCommaList(val: string): string[] {
	return val
		.split(",")
		.map((s) => s.trim())
		.filter((s) => s.length > 0);
}
