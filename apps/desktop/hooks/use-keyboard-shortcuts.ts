"use client";

import { useEffect, useCallback } from "react";

// ─── Types ───────────────────────────────────────────────────────────────

export type ShortcutAction =
	| { id: string; label: string; category: string; keywords?: string[] }
	| (() => void);

export interface ShortcutDef {
	/** Human-readable label for the command palette */
	label: string;
	/** Category for grouping in the palette */
	category: string;
	/** Search keywords (optional) */
	keywords?: string[];
	/** Key combo: e.g. "mod+k", "mod+shift+c", "escape" */
	keys: string;
	/** Callback */
	handler: () => void;
	/** Whether the shortcut should work even inside input elements */
	global?: boolean;
}

type NormalizedCombo = {
	mod: boolean;
	shift: boolean;
	alt: boolean;
	key: string;
};

// ─── Normalisation ──────────────────────────────────────────────────────

function normalizeKeys(keys: string): NormalizedCombo {
	const parts = keys.toLowerCase().split("+");
	return {
		mod: parts.includes("mod"),
		shift: parts.includes("shift"),
		alt: parts.includes("alt"),
		key:
			parts
				.filter(
					(p) => !["mod", "shift", "alt", "ctrl", "cmd", "meta"].includes(p),
				)
				.join("+") || "",
	};
}

function eventMatchesCombo(e: KeyboardEvent, combo: NormalizedCombo): boolean {
	const isMod = e.metaKey || e.ctrlKey;
	if (combo.mod && !isMod) return false;
	if (!combo.mod && isMod) return false;
	if (combo.shift && !e.shiftKey) return false;
	if (!combo.shift && e.shiftKey) return false;
	if (combo.alt && !e.altKey) return false;
	if (!combo.alt && e.altKey) return false;

	const eventKey = e.key.toLowerCase();
	const expectedKey = combo.key;

	// Escape handles both "escape" and "Escape"
	if (expectedKey === "escape" && eventKey === "escape") return true;
	if (expectedKey === eventKey) return true;

	return false;
}

// ─── Should-skip helper ─────────────────────────────────────────────────

function isEditableTarget(target: EventTarget | null): boolean {
	if (!target || !(target instanceof HTMLElement)) return false;
	const tag = target.tagName.toLowerCase();
	if (tag === "input" || tag === "textarea" || tag === "select") return true;
	if (target.isContentEditable) return true;
	if (target.getAttribute("role") === "textbox") return true;
	return false;
}

// ─── Hook ───────────────────────────────────────────────────────────────

export function useKeyboardShortcuts(
	shortcuts: ShortcutDef[],
	deps?: React.DependencyList,
) {
	const handler = useCallback(
		(e: KeyboardEvent) => {
			const isEscape = e.key === "Escape";

			for (const shortcut of shortcuts) {
				const combo = normalizeKeys(shortcut.keys);

				// Skip editable targets unless global or Escape
				if (!shortcut.global && !isEscape && isEditableTarget(e.target)) {
					continue;
				}

				if (eventMatchesCombo(e, combo)) {
					e.preventDefault();
					e.stopPropagation();
					shortcut.handler();
					return;
				}
			}
		},
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[shortcuts, ...(deps || [])],
	);

	useEffect(() => {
		document.addEventListener("keydown", handler);
		return () => document.removeEventListener("keydown", handler);
	}, [handler]);
}
