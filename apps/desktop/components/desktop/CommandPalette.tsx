"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";

// ─── Types ───────────────────────────────────────────────────────────────

export interface CommandItem {
	id: string;
	label: string;
	category: string;
	keywords?: string[];
	shortcutHint?: string;
	onExecute: () => void;
}

interface CommandPaletteProps {
	open: boolean;
	onClose: () => void;
	commands: CommandItem[];
}

// ─── Component ──────────────────────────────────────────────────────────

export default function CommandPalette({
	open,
	onClose,
	commands,
}: CommandPaletteProps) {
	const [query, setQuery] = useState("");
	const [selectedIndex, setSelectedIndex] = useState(0);
	const inputRef = useRef<HTMLInputElement>(null);
	const listRef = useRef<HTMLDivElement>(null);

	// Reset state when opened
	useEffect(() => {
		if (open) {
			setQuery("");
			setSelectedIndex(0);
			// Focus the input after mount
			setTimeout(() => inputRef.current?.focus(), 50);
		}
	}, [open]);

	// Filter commands based on query
	const filtered = useMemo(() => {
		if (!query.trim()) return commands;
		const q = query.toLowerCase();
		return commands.filter((cmd) => {
			if (cmd.label.toLowerCase().includes(q)) return true;
			if (cmd.category.toLowerCase().includes(q)) return true;
			if (cmd.keywords?.some((kw) => kw.toLowerCase().includes(q))) return true;
			return false;
		});
	}, [commands, query]);

	// Clamp selected index when filtered list changes
	useEffect(() => {
		if (selectedIndex >= filtered.length) {
			setSelectedIndex(Math.max(0, filtered.length - 1));
		}
	}, [filtered.length, selectedIndex]);

	// Scroll selected item into view
	useEffect(() => {
		const el = listRef.current?.children[selectedIndex] as
			| HTMLElement
			| undefined;
		el?.scrollIntoView({ block: "nearest" });
	}, [selectedIndex]);

	const executeSelected = useCallback(
		(index: number) => {
			const cmd = filtered[index];
			if (cmd) {
				cmd.onExecute();
				onClose();
			}
		},
		[filtered, onClose],
	);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			switch (e.key) {
				case "ArrowDown":
					e.preventDefault();
					setSelectedIndex((prev) => Math.min(prev + 1, filtered.length - 1));
					break;
				case "ArrowUp":
					e.preventDefault();
					setSelectedIndex((prev) => Math.max(prev - 1, 0));
					break;
				case "Enter":
					e.preventDefault();
					executeSelected(selectedIndex);
					break;
				case "Escape":
					e.preventDefault();
					onClose();
					break;
			}
		},
		[filtered.length, selectedIndex, executeSelected, onClose],
	);

	// Close on click outside
	const handleBackdropClick = useCallback(
		(e: React.MouseEvent) => {
			if (e.target === e.currentTarget) {
				onClose();
			}
		},
		[onClose],
	);

	if (!open) return null;

	return (
		/* Backdrop */
		<div
			className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] bg-black/40"
			onClick={handleBackdropClick}
			role="dialog"
			aria-modal="true"
			aria-label="Command palette"
		>
			{/* Panel */}
			<div
				className="w-full max-w-[540px] bg-surface border border-border rounded-xl shadow-2xl overflow-hidden"
				onKeyDown={handleKeyDown}
			>
				{/* Search input */}
				<div className="flex items-center px-4 border-b border-border">
					<svg
						className="h-4 w-4 text-text-tertiary shrink-0 mr-2"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						strokeWidth={2}
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
						/>
					</svg>
					<input
						ref={inputRef}
						type="text"
						value={query}
						onChange={(e) => {
							setQuery(e.target.value);
							setSelectedIndex(0);
						}}
						onKeyDown={handleKeyDown}
						placeholder="Search commands…"
						aria-label="Search commands"
						aria-activedescendant={
							filtered[selectedIndex]
								? `cmd-${filtered[selectedIndex].id}`
								: undefined
						}
						role="combobox"
						aria-expanded="true"
						aria-controls="command-list"
						className="flex-1 h-12 bg-transparent text-sm text-text-primary placeholder:text-text-tertiary outline-none"
					/>
					<span className="text-[10px] text-text-tertiary shrink-0 ml-2 border border-border rounded px-1.5 py-0.5">
						esc
					</span>
				</div>

				{/* Results list */}
				<div
					id="command-list"
					ref={listRef}
					role="listbox"
					aria-label="Commands"
					className="max-h-[320px] overflow-y-auto py-2"
				>
					{filtered.length === 0 ? (
						<div className="px-4 py-8 text-center text-xs text-text-tertiary">
							No commands found.
						</div>
					) : (
						filtered.map((cmd, i) => (
							<button
								key={cmd.id}
								id={`cmd-${cmd.id}`}
								role="option"
								aria-selected={i === selectedIndex}
								onClick={() => executeSelected(i)}
								onMouseEnter={() => setSelectedIndex(i)}
								className={`w-full flex items-center justify-between px-4 py-2.5 text-left text-sm transition-colors ${
									i === selectedIndex
										? "bg-accent-light text-text-primary"
										: "text-text-secondary hover:bg-surface-hover"
								}`}
							>
								<div className="flex items-center gap-3 min-w-0">
									<span className="text-[10px] font-medium uppercase tracking-wider text-accent/70 shrink-0 w-16 truncate">
										{cmd.category}
									</span>
									<span className="truncate">{cmd.label}</span>
								</div>
								{cmd.shortcutHint && (
									<span className="text-[10px] text-text-tertiary shrink-0 ml-2 border border-border rounded px-1.5 py-0.5">
										{cmd.shortcutHint}
									</span>
								)}
							</button>
						))
					)}
				</div>

				{/* Footer hint */}
				<div className="flex items-center gap-4 px-4 py-2 border-t border-border text-[10px] text-text-tertiary">
					<span>
						<span className="text-accent/70">↑↓</span> Navigate
					</span>
					<span>
						<span className="text-accent/70">⏎</span> Select
					</span>
					<span>
						<span className="text-accent/70">Esc</span> Close
					</span>
				</div>
			</div>
		</div>
	);
}
