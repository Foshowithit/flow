"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import DesktopSidebar from "@/components/desktop/DesktopSidebar";
import ChatPanel from "@/components/desktop/ChatPanel";
import RightPanel from "@/components/desktop/RightPanel";
import StatusBar from "@/components/desktop/StatusBar";
import CommandPalette from "@/components/desktop/CommandPalette";
import type { CommandItem } from "@/components/desktop/CommandPalette";
import {
	useKeyboardShortcuts,
	type ShortcutDef,
} from "@/hooks/use-keyboard-shortcuts";
import type { ChatInputHandle } from "@/components/ChatInput";

// ─── Types ───────────────────────────────────────────────────

interface Message {
	role: "user" | "assistant";
	content: string;
}

interface ServerSession {
	id: string;
	title: string;
	created_at: string;
	updated_at?: string;
	archived_at?: string | null;
}

interface ServerMessage {
	role: string;
	content: string;
	created_at: string;
}

// ─── Page Component ──────────────────────────────────────────

export default function DesktopPage() {
	// ── Auth state (guest-mode friendly, no Clerk) ─────────
	const [isSignedIn, setIsSignedIn] = useState(false);

	const onSignInClick = useCallback(() => {
		window.location.href = "/sign-in";
	}, []);

	// ── State ──────────────────────────────────────────────

	const [sessions, setSessions] = useState<ServerSession[]>([]);
	const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
	const [messageCache, setMessageCache] = useState<Record<string, Message[]>>(
		{},
	);
	const [isLoadingSessions, setIsLoadingSessions] = useState(false);
	const [isLoadingMessages, setIsLoadingMessages] = useState(false);

	// ── Layout state ───────────────────────────────────────
	const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
	const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);
	const [rightPanelOpen, setRightPanelOpen] = useState(true);

	const chatInputRef = useRef<ChatInputHandle | null>(null);

	// ── Load sessions on mount (signed-in only) ────────────

	useEffect(() => {
		if (!isSignedIn) return;

		const controller = new AbortController();
		setIsLoadingSessions(true);

		(async () => {
			try {
				const res = await fetch("/api/sessions", {
					signal: controller.signal,
				});
				if (!res.ok) return;
				const data = (await res.json()) as ServerSession[];
				if (Array.isArray(data)) {
					setSessions(data);
				}
			} catch {
				// Silently fail
			} finally {
				setIsLoadingSessions(false);
			}
		})();

		return () => controller.abort();
	}, [isSignedIn]);

	// ── Load messages when selecting a session ─────────────

	const loadSessionMessages = useCallback(
		async (sessionId: string) => {
			// Already cached — skip
			if (messageCache[sessionId]) return;

			setIsLoadingMessages(true);
			const controller = new AbortController();

			try {
				const res = await fetch(`/api/sessions/${sessionId}/messages`, {
					signal: controller.signal,
				});
				if (!res.ok) return;
				const serverMessages = (await res.json()) as ServerMessage[];
				if (!Array.isArray(serverMessages)) return;

				const msgs: Message[] = serverMessages.map((m) => ({
					role: m.role as "user" | "assistant",
					content: m.content,
				}));

				setMessageCache((prev) => ({
					...prev,
					[sessionId]: msgs,
				}));
			} catch {
				// Silently fail
			} finally {
				setIsLoadingMessages(false);
			}
		},
		[messageCache],
	);

	// ── Handlers ───────────────────────────────────────────

	const handleSelectSession = useCallback(
		(id: string) => {
			setActiveSessionId(id);
			loadSessionMessages(id);
		},
		[loadSessionMessages],
	);

	const handleNewChat = useCallback(async () => {
		if (!isSignedIn) {
			setActiveSessionId(null);
			return;
		}

		try {
			const res = await fetch("/api/sessions", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ title: "New Chat" }),
			});
			if (!res.ok) return;
			const session = (await res.json()) as ServerSession;
			setSessions((prev) => [session, ...prev]);
			setActiveSessionId(session.id);
			setMessageCache((prev) => ({ ...prev, [session.id]: [] }));
		} catch {
			// Silently fail
		}
	}, [isSignedIn]);

	const handleRenameSession = useCallback(
		async (id: string, currentTitle: string) => {
			const newTitle = prompt("Rename conversation", currentTitle);
			if (
				!newTitle ||
				newTitle.trim() === "" ||
				newTitle.trim() === currentTitle
			)
				return;

			const trimmed = newTitle.trim();

			// Update local state immediately
			setSessions((prev) =>
				prev.map((s) => (s.id === id ? { ...s, title: trimmed } : s)),
			);

			// Persist to server
			try {
				await fetch(`/api/sessions/${id}`, {
					method: "PATCH",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ title: trimmed }),
				});
			} catch {
				// Silently fail — local state is already updated
			}
		},
		[],
	);

	const handleDeleteSession = useCallback(
		async (id: string) => {
			if (!confirm("Delete this conversation? It can't be undone.")) return;

			// Server-side delete first
			try {
				const res = await fetch(`/api/sessions/${id}`, {
					method: "DELETE",
				});
				if (!res.ok) return;
			} catch {
				return;
			}

			// Remove from state
			setSessions((prev) => prev.filter((s) => s.id !== id));

			// Clean up message cache
			setMessageCache((prev) => {
				const next = { ...prev };
				delete next[id];
				return next;
			});

			// If deleted session was active, select next or null
			setActiveSessionId((prevId) => {
				if (prevId !== id) return prevId;
				// Find next session in list
				const remaining = sessions.filter((s) => s.id !== id);
				return remaining.length > 0 ? remaining[0].id : null;
			});
		},
		[sessions],
	);

	// ── Clipboard helper ───────────────────────────────────

	const copyLastAssistantResponse = useCallback(() => {
		const activeMessages = activeSessionId
			? messageCache[activeSessionId] || []
			: [];
		const lastAssistant = [...activeMessages]
			.reverse()
			.find((m) => m.role === "assistant");
		const text = lastAssistant?.content;
		if (!text) return;

		if (navigator.clipboard?.writeText) {
			navigator.clipboard.writeText(text).catch(() => {
				// Clipboard write failed — silently ignore
			});
		} else {
			// Fallback: use a temporary textarea
			try {
				const ta = document.createElement("textarea");
				ta.value = text;
				ta.style.position = "fixed";
				ta.style.opacity = "0";
				document.body.appendChild(ta);
				ta.select();
				document.execCommand("copy");
				document.body.removeChild(ta);
			} catch {
				// Silently fail
			}
		}
	}, [activeSessionId, messageCache]);

	// ── Command palette commands ───────────────────────────

	const commandItems: CommandItem[] = [
		{
			id: "new-chat",
			label: "New Chat",
			category: "Chat",
			keywords: ["new", "conversation"],
			shortcutHint: "⌘N",
			onExecute: handleNewChat,
		},
		{
			id: "toggle-sidebar",
			label: "Toggle Sidebar",
			category: "Layout",
			keywords: ["sidebar", "left", "panel"],
			shortcutHint: "⌘B",
			onExecute: () => setLeftSidebarOpen((v) => !v),
		},
		{
			id: "toggle-right-panel",
			label: "Toggle Right Panel",
			category: "Layout",
			keywords: ["right", "panel"],
			shortcutHint: "⌘E",
			onExecute: () => setRightPanelOpen((v) => !v),
		},
		{
			id: "open-settings",
			label: "Open Settings",
			category: "Navigation",
			keywords: ["settings", "preferences"],
			shortcutHint: "⌘,",
			onExecute: () => {
				window.location.href = "/settings";
			},
		},
		{
			id: "copy-last-response",
			label: "Copy Last Response",
			category: "Chat",
			keywords: ["copy", "response", "clipboard"],
			shortcutHint: "⌘⇧C",
			onExecute: copyLastAssistantResponse,
		},
		{
			id: "focus-input",
			label: "Focus Chat Input",
			category: "Chat",
			keywords: ["input", "focus", "chat"],
			shortcutHint: "⌘L",
			onExecute: () => {
				chatInputRef.current?.focus();
			},
		},
	];

	// ── Keyboard shortcuts ─────────────────────────────────

	const shortcuts: ShortcutDef[] = [
		{
			label: "Open Command Palette",
			category: "Layout",
			keys: "mod+k",
			handler: () => setCommandPaletteOpen((v) => !v),
		},
		{
			label: "New Chat",
			category: "Chat",
			keys: "mod+n",
			handler: handleNewChat,
		},
		{
			label: "Toggle Sidebar",
			category: "Layout",
			keys: "mod+b",
			handler: () => setLeftSidebarOpen((v) => !v),
		},
		{
			label: "Toggle Right Panel",
			category: "Layout",
			keys: "mod+e",
			handler: () => setRightPanelOpen((v) => !v),
		},
		{
			label: "Open Settings",
			category: "Navigation",
			keys: "mod+,",
			handler: () => {
				window.location.href = "/settings";
			},
		},
		{
			label: "Copy Last Response",
			category: "Chat",
			keys: "mod+shift+c",
			handler: copyLastAssistantResponse,
		},
		{
			label: "Focus Chat Input",
			category: "Chat",
			keys: "mod+l",
			handler: () => {
				chatInputRef.current?.focus();
			},
		},
		{
			label: "Close Palette",
			category: "Layout",
			keys: "escape",
			handler: () => setCommandPaletteOpen(false),
			global: true, // Escape works even in inputs
		},
	];

	useKeyboardShortcuts(shortcuts);

	// ── Render ─────────────────────────────────────────────

	return (
		<div className="flex flex-col h-dvh w-screen overflow-hidden bg-background">
			{/* Guest-mode banner — shown instead of blocking the whole UI */}
			{!isSignedIn && (
				<div className="flex items-center justify-between h-9 px-4 bg-accent/10 border-b border-accent/20 shrink-0">
					<span className="text-xs text-text-secondary">
						You're in guest mode. Sign in to save your conversations.
					</span>
					<button
						onClick={onSignInClick}
						className="text-xs font-medium text-accent hover:text-accent/80 transition-colors"
					>
						Sign in →
					</button>
				</div>
			)}
			<div className="flex flex-1 overflow-hidden">
				{/* Left sidebar — fixed 280px, toggleable */}
				<div
					className={`${
						leftSidebarOpen ? "w-[280px]" : "w-0"
					} shrink-0 overflow-hidden transition-[width] duration-200`}
				>
					<DesktopSidebar
						sessions={sessions}
						activeId={activeSessionId}
						onSelect={handleSelectSession}
						onNew={handleNewChat}
						onRename={handleRenameSession}
						onDelete={handleDeleteSession}
						isLoading={isLoadingSessions}
						open={leftSidebarOpen}
					/>
				</div>

				{/* Center chat panel — flex-1 with min-width */}
				<div className="flex-1 min-w-[480px] overflow-hidden">
					<ChatPanel
						sessionId={activeSessionId}
						initialMessages={
							activeSessionId ? messageCache[activeSessionId] || [] : []
						}
						isLoading={isLoadingMessages}
						chatInputRef={chatInputRef}
					/>
				</div>

				{/* Right panel — fixed 320px, toggleable */}
				<div
					className={`${
						rightPanelOpen ? "w-[320px]" : "w-0"
					} shrink-0 overflow-hidden transition-[width] duration-200`}
				>
					<RightPanel open={rightPanelOpen} />
				</div>
			</div>

			{/* Status bar at the bottom */}
			<StatusBar />

			{/* Command palette overlay */}
			<CommandPalette
				open={commandPaletteOpen}
				onClose={() => setCommandPaletteOpen(false)}
				commands={commandItems}
			/>
		</div>
	);
}
