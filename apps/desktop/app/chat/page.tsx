"use client";

import { useState, useCallback, useRef, useEffect, Suspense } from "react";
import { useUser, useAuth, SignInButton } from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import ChatMessages from "@/components/ChatMessages";
import ChatInput from "@/components/ChatInput";
import { Button } from "@/components/ui/button";
import { Menu, ArrowUp, LogIn } from "lucide-react";
import Link from "next/link";
import type { Attachment } from "@/lib/attachments";

// ─── Types ───────────────────────────────────────────────────────

interface Message {
	role: "user" | "assistant";
	content: string;
	attachments?: Attachment[];
}

interface Conversation {
	id: string;
	title: string;
}

interface ApiMessage {
	role: string;
	content: string;
	attachments?: Attachment[];
}

interface ChatApiResponse {
	id?: string;
	sessionId?: string;
	choices?: Array<{
		index: number;
		message: { role: string; content: string };
	}>;
	usage?: {
		prompt_tokens: number;
		completion_tokens: number;
		total_tokens: number;
	};
	model?: string;
	error?: string;
	mock?: boolean;
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
	attachments: any;
	created_at: string;
}

// ─── Example prompts ─────────────────────────────────────────────

const EXAMPLE_PROMPTS = [
	"Help me think through this decision…",
	"Explain this concept simply…",
	"Compare these approaches…",
	"What's the latest on…",
];

// ─── Helpers ─────────────────────────────────────────────────────

let convoCounter = 0;

function createConversation(title?: string): Conversation {
	convoCounter += 1;
	return {
		id: `conv-${Date.now()}-${convoCounter}`,
		title: title || `Chat ${convoCounter}`,
	};
}

function isServerSession(id: string): boolean {
	return !id.startsWith("conv-");
}

/**
 * Get a user-friendly error message based on HTTP status.
 */
function getUserFacingError(status: number, bodyError?: string): string {
	if (status === 401) return "Please sign in to continue.";
	if (status === 402 || status === 429)
		return "You've hit the usage limit. Please try again later or upgrade your plan.";
	if (status === 503)
		return "The AI provider is temporarily unavailable. Please try again.";
	if (status >= 500)
		return "Something went wrong on our end. Please try again.";
	return bodyError || `Request failed (${status}). Please try again.`;
}

// ─── Streaming / Fallback helpers ─────────────────────────────────

/**
 * attemptStreamingSend — tries `/api/chat/stream` SSE endpoint.
 * Returns true if streaming succeeded, false to trigger JSON fallback.
 */
async function attemptStreamingSend(
	body: Record<string, unknown>,
	controller: AbortController,
	activeConvoId: string,
	setMessagesByConvo: React.Dispatch<
		React.SetStateAction<Record<string, Message[]>>
	>,
	setSessionIdByConvo: React.Dispatch<
		React.SetStateAction<Record<string, string | null>>
	>,
): Promise<boolean> {
	const res = await fetch("/api/chat/stream", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
		signal: controller.signal,
	});

	if (!res.ok) {
		return false;
	}

	if (!res.body) {
		return false;
	}

	// Parse SSE stream
	const reader = res.body.getReader();
	const decoder = new TextDecoder();
	let buffer = "";
	let assistantContent = "";
	let hasContent = false;
	let done = false;
	let sessionId: string | null = null;

	// Insert placeholder on first session or delta event to avoid
	// duplicates on error path
	let placeholderInserted = false;
	while (true) {
		const { done: readerDone, value } = await reader.read();
		if (readerDone) break;

		buffer += decoder.decode(value, { stream: true });
		const lines = buffer.split("\n");
		buffer = lines.pop() || "";

		for (const line of lines) {
			const trimmed = line.trim();
			if (!trimmed) continue;

			// Parse SSE format: "event: xxx" / "data: {...}"
			if (trimmed.startsWith("event: ")) {
				continue;
			}

			if (trimmed.startsWith("data: ")) {
				try {
					const jsonStr = trimmed.slice(6);
					const data = JSON.parse(jsonStr);
					if (data.error) {
						// Error event — abort streaming, fallback to JSON
						console.error("[STREAM] Server error:", data.error);
						return false;
					}

					// Insert placeholder on first meaningful event
					if (
						!placeholderInserted &&
						(data.sessionId || data.content !== undefined)
					) {
						placeholderInserted = true;
						setMessagesByConvo((prev) => ({
							...prev,
							[activeConvoId]: [
								...(prev[activeConvoId] || []),
								{ role: "assistant", content: "" },
							],
						}));
					}

					if (data.sessionId) {
						sessionId = data.sessionId;
						setSessionIdByConvo((prev) => ({
							...prev,
							[activeConvoId]: sessionId,
						}));
					}

					if (data.content !== undefined) {
						assistantContent += data.content;
						hasContent = true;
						setMessagesByConvo((prev) => {
							const msgs = prev[activeConvoId] || [];
							const updated = [...msgs];
							if (
								updated.length > 0 &&
								updated[updated.length - 1].role === "assistant"
							) {
								updated[updated.length - 1] = {
									role: "assistant",
									content: assistantContent,
								};
							}
							return { ...prev, [activeConvoId]: updated };
						});
					}

					if (data.mock !== undefined || data.model) {
						done = true;
					}
				} catch (parseErr) {
					console.error("[STREAM] Parse error:", parseErr);
				}
			}
		}
	}

	// If we got content, streaming succeeded
	if (hasContent || done) {
		if (!hasContent) {
			assistantContent = "I'm sorry, I wasn't able to generate a response.";
			setMessagesByConvo((prev) => {
				const msgs = prev[activeConvoId] || [];
				const updated = [...msgs];
				if (
					updated.length > 0 &&
					updated[updated.length - 1].role === "assistant"
				) {
					updated[updated.length - 1] = {
						role: "assistant",
						content: assistantContent,
					};
				}
				return { ...prev, [activeConvoId]: updated };
			});
		}
		return true;
	}

	return false;
}

/**
 * attemptJsonSend — fallback to `/api/chat` JSON endpoint.
 */
async function attemptJsonSend(
	body: Record<string, unknown>,
	controller: AbortController,
	activeConvoId: string,
	setMessagesByConvo: React.Dispatch<
		React.SetStateAction<Record<string, Message[]>>
	>,
	setSessionIdByConvo: React.Dispatch<
		React.SetStateAction<Record<string, string | null>>
	>,
): Promise<void> {
	const res = await fetch("/api/chat", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
		signal: controller.signal,
	});
	const data: ChatApiResponse = await res
		.json()
		.catch(() => ({ error: "Unknown error" }));
	if (!res.ok) {
		throw new Error(
			getUserFacingError(res.status, data.error) ||
				`Request failed (${res.status})`,
		);
	}
	// Track server sessionId
	const serverSessionId = data.sessionId || data.id;
	if (serverSessionId) {
		setSessionIdByConvo((prev) => ({
			...prev,
			[activeConvoId]: serverSessionId,
		}));
	}
	const assistantContent =
		data?.choices?.[0]?.message?.content ||
		"I'm sorry, I wasn't able to generate a response.";
	// Add mock indicator if present
	const mockSuffix = data.mock
		? "\n\n---\n*Demo response — sign in for the real assistant.*"
		: "";
	const assistantMessage: Message = {
		role: "assistant",
		content: assistantContent + mockSuffix,
	};
	setMessagesByConvo((prev) => ({
		...prev,
		[activeConvoId]: [...(prev[activeConvoId] || []), assistantMessage],
	}));
}

// ─── Page Component ──────────────────────────────────────────────
function ChatPageContent() {
	const { user, isLoaded: userLoaded } = useUser();
	const { isSignedIn } = useAuth();
	const searchParams = useSearchParams();

	const [conversations, setConversations] = useState<Conversation[]>(() => [
		createConversation(),
	]);
	const [activeConvoId, setActiveConvoId] = useState<string>(
		() => conversations[0]?.id || "",
	);
	const [messagesByConvo, setMessagesByConvo] = useState<
		Record<string, Message[]>
	>(() => ({ [conversations[0]?.id]: [] }));
	const [sessionIdByConvo, setSessionIdByConvo] = useState<
		Record<string, string | null>
	>({});
	const [isLoading, setIsLoading] = useState(false);
	const [sidebarOpen, setSidebarOpen] = useState(false);
	const [emptyQuery, setEmptyQuery] = useState("");
	const abortRef = useRef<AbortController | null>(null);

	const messagesByConvoRef = useRef(messagesByConvo);

	useEffect(() => {
		messagesByConvoRef.current = messagesByConvo;
	}, [messagesByConvo]);

	const activeMessages = messagesByConvo[activeConvoId] || [];

	// ── Load server sessions on mount (signed-in only) ────────────

	useEffect(() => {
		if (!isSignedIn) return;
		const controller = new AbortController();
		(async () => {
			try {
				const res = await fetch("/api/sessions", { signal: controller.signal });
				if (!res.ok) return;
				const sessions = (await res.json()) as ServerSession[];
				if (!Array.isArray(sessions) || sessions.length === 0) return;

				// Merge server sessions into conversations and map sessionId
				const serverConvos: Conversation[] = sessions.map((s) => ({
					id: s.id,
					title: s.title,
				}));

				// Mark each server session as having a known sessionId
				const sessionMap: Record<string, string> = {};
				for (const s of sessions) {
					sessionMap[s.id] = s.id;
				}
				setSessionIdByConvo((prev) => ({
					...prev,
					...sessionMap,
				}));

				setConversations((prev) => {
					const existingIds = new Set(prev.map((c) => c.id));
					const newConvos = serverConvos.filter((c) => !existingIds.has(c.id));
					if (newConvos.length === 0) return prev;
					return [...newConvos, ...prev];
				});
			} catch {
				// Silently fail — local conversations still work
			}
		})();
		return () => controller.abort();
	}, [isSignedIn]);

	// ── Load session from ?session= URL param ─────────────────────

	useEffect(() => {
		const sessionId = searchParams.get("session");
		if (!sessionId || !isServerSession(sessionId)) return;
		if (!isSignedIn) return;

		// Set active conversation to the session
		setActiveConvoId(sessionId);

		// Ensure the session exists in the conversations list
		setConversations((prev) => {
			if (prev.some((c) => c.id === sessionId)) return prev;
			return [{ id: sessionId, title: "Loading…" }, ...prev];
		});

		// Load messages for this session
		const controller = new AbortController();
		(async () => {
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
				attachments: m.attachments || undefined,
			}));

				setMessagesByConvo((prev) => ({
					...prev,
					[sessionId]: msgs,
				}));

				// Update title from server
				const session = await fetch(`/api/sessions/${sessionId}`, {
					signal: controller.signal,
				});
				if (session.ok) {
					const s = (await session.json()) as ServerSession;
					if (s?.title) {
						setConversations((prev) =>
							prev.map((c) =>
								c.id === sessionId ? { ...c, title: s.title } : c,
							),
						);
					}
				}

				// Mark sessionId mapping
				setSessionIdByConvo((prev) => ({
					...prev,
					[sessionId]: sessionId,
				}));
			} catch {
				// Silently fail
			}
		})();
		return () => controller.abort();
	}, [searchParams, isSignedIn]);

	// ── Load messages when selecting a server session ─────────────

	const loadSessionMessages = useCallback(async (sessionId: string) => {
		try {
			const controller = new AbortController();
			const res = await fetch(`/api/sessions/${sessionId}/messages`, {
				signal: controller.signal,
			});
			if (!res.ok) return;
			const serverMessages = (await res.json()) as ServerMessage[];
			if (!Array.isArray(serverMessages)) return;

			const msgs: Message[] = serverMessages.map((m) => ({
				role: m.role as "user" | "assistant",
				content: m.content,
				attachments: m.attachments || undefined,
			}));

			setMessagesByConvo((prev) => ({
				...prev,
				[sessionId]: msgs,
			}));
		} catch {
			// Silently fail
		}
	}, []);

	// ── New conversation ──────────────────────────────────────────

	const handleNew = useCallback(() => {
		const conv = createConversation();
		setConversations((prev) => [conv, ...prev]);
		setActiveConvoId(conv.id);
		setMessagesByConvo((prev) => ({ ...prev, [conv.id]: [] }));
		setSidebarOpen(false);
	}, []);

	// ── Rename conversation ───────────────────────────────────────

	const handleRename = useCallback(async (id: string, currentTitle: string) => {
		const newTitle = prompt("Rename conversation", currentTitle);
		if (!newTitle || newTitle.trim() === "" || newTitle.trim() === currentTitle)
			return;

		const trimmed = newTitle.trim();

		// Update local state immediately
		setConversations((prev) =>
			prev.map((c) => (c.id === id ? { ...c, title: trimmed } : c)),
		);

		// Persist to server if this is a server-backed session
		if (isServerSession(id)) {
			try {
				await fetch(`/api/sessions/${id}`, {
					method: "PATCH",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ title: trimmed }),
				});
			} catch {
				// Silently fail — local state is already updated
			}
		}
	}, []);

	// ── Delete/archive conversation ───────────────────────────────

	const handleDelete = useCallback(
		async (id: string) => {
			if (!confirm("Delete this conversation? It can't be undone.")) return;

			// Server-side delete first (before state update)
			if (isServerSession(id)) {
				try {
					const res = await fetch(`/api/sessions/${id}`, {
						method: "DELETE",
					});
					if (!res.ok) return;
				} catch {
					return; // Don't update state if server delete fails
				}
			}

			// Remove the conversation from state immediately —
			// the filter runs and returns a new array directly.
			setConversations((prev) => prev.filter((c) => c.id !== id));

			// Remove associated messages and session mapping
			setMessagesByConvo((prev) => {
				const next = { ...prev };
				delete next[id];
				return next;
			});
			setSessionIdByConvo((prev) => {
				const next = { ...prev };
				delete next[id];
				return next;
			});

			// If the deleted convo was active, select the next available one.
			// Use the closure snapshot to compute remaining conversations.
			if (id === activeConvoId) {
				const remaining = conversations.filter((c) => c.id !== id);
				if (remaining.length > 0) {
					const nextId = remaining[0].id;
					setActiveConvoId(nextId);
					// Ensure messages exist for the new active convo
					setMessagesByConvo((prevMsgs) => ({
						...prevMsgs,
						[nextId]: prevMsgs[nextId] || [],
					}));
				} else {
					// No conversations left — create a new one
					const conv = createConversation();
					setConversations([conv]);
					setActiveConvoId(conv.id);
					setMessagesByConvo({ [conv.id]: [] });
				}
			}
		},
		[activeConvoId, conversations],
	);

	// ── Send message ──────────────────────────────────────────────

	const handleSend = useCallback(
		async (text: string) => {
			if (!activeConvoId) return;
			const userMessage: Message = { role: "user", content: text, attachments: undefined };
			// Read latest messages from ref (avoids stale closure bug)
			const currentMessages = messagesByConvoRef.current[activeConvoId] || [];
			const allMessages = [...currentMessages, userMessage];
			// Update messages immediately with user message (state + ref)
			setMessagesByConvo((prev) => ({
				...prev,
				[activeConvoId]: [...(prev[activeConvoId] || []), userMessage],
			}));
			messagesByConvoRef.current = {
				...messagesByConvoRef.current,
				[activeConvoId]: allMessages,
			};
			setIsLoading(true);
			setEmptyQuery("");
			// Build the full message list for this conversation
			const apiMessages: ApiMessage[] = allMessages.map((m) => ({
				role: m.role,
				content: m.content,
				attachments: m.attachments,
			}));
			// Update conversation title from first user message
			if (currentMessages.length === 0) {
				const shortTitle = text.length > 40 ? text.slice(0, 40) + "…" : text;
				setConversations((prev) =>
					prev.map((c) =>
						c.id === activeConvoId ? { ...c, title: shortTitle } : c,
					),
				);
			}
			try {
				const controller = new AbortController();
				abortRef.current = controller;
				const body: Record<string, unknown> = {
					messages: apiMessages,
				};
				const currentSessionId = sessionIdByConvo[activeConvoId];
				if (currentSessionId) {
					body.sessionId = currentSessionId;
				}

				// Try streaming first for signed-in users (no mock)
				let streamed = false;
				if (isSignedIn) {
					streamed = await attemptStreamingSend(
						body,
						controller,
						activeConvoId,
						setMessagesByConvo,
						setSessionIdByConvo,
					);
				}

				if (!streamed) {
					// Fallback to JSON endpoint
					await attemptJsonSend(
						body,
						controller,
						activeConvoId,
						setMessagesByConvo,
						setSessionIdByConvo,
					);
				}
			} catch (err: unknown) {
				if (err instanceof DOMException && err.name === "AbortError") return;
				const errorMessage: Message = {
					role: "assistant",
					content:
						err instanceof Error
							? err.message
							: "Sorry, something went wrong. Please try again.",
				};
				setMessagesByConvo((prev) => ({
					...prev,
					[activeConvoId]: [...(prev[activeConvoId] || []), errorMessage],
				}));
				console.error("Chat error:", err);
			} finally {
				setIsLoading(false);
				abortRef.current = null;
			}
		},
		[activeConvoId, sessionIdByConvo, isSignedIn], // messagesByConvo removed — ref avoids stale closure
	);

	// ── Select example prompt ─────────────────────────────────────

	const handleExampleClick = useCallback(
		(prompt: string) => {
			handleSend(prompt);
		},
		[handleSend],
	);

	// ── Select conversation (local or server) ─────────────────────

	const handleSelectConvo = useCallback(
		(id: string) => {
			setActiveConvoId(id);
			// If this is a server session and has no messages loaded, load them
			if (
				isServerSession(id) &&
				!(messagesByConvo[id] && messagesByConvo[id].length > 0)
			) {
				loadSessionMessages(id);
			}
		},
		[messagesByConvo, loadSessionMessages],
	);

	// ── Render: Clerk loading state (avoid flash of signed-in UI) ──

	if (!userLoaded) {
		return (
			<div className="flex h-dvh w-screen overflow-hidden bg-background">
				<div className="flex-1 flex flex-col">
					<header className="flex items-center h-12 px-4 border-b border-border bg-surface/80 backdrop-blur-sm">
						<div className="flex items-center gap-2 ml-1 md:ml-0">
							<span className="text-sm font-semibold text-accent tracking-tight">
								Flow
							</span>
							<span className="text-[11px] font-medium text-text-secondary bg-surface-hover px-2 py-0.5 rounded-full">
								Assistant
							</span>
						</div>
					</header>
					<div className="flex-1 flex items-center justify-center">
						<div className="flex flex-col items-center gap-4">
							<div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
							<p className="text-sm text-text-secondary">Loading…</p>
						</div>
					</div>
				</div>
			</div>
		);
	}

	// ── Render: signed-out state ──────────────────────────────────

	if (userLoaded && !isSignedIn) {
		return (
			<div className="flex h-dvh w-screen overflow-hidden bg-background">
				{/* Sidebar (simplified for signed-out) */}
				<Sidebar
					conversations={[]}
					activeId={null}
					onSelect={() => {}}
					onNew={() => {}}
					onRename={() => {}}
					onDelete={() => {}}
					isOpen={sidebarOpen}
					onClose={() => setSidebarOpen(false)}
				/>
				<div className="flex flex-1 flex-col min-w-0 relative">
					<header className="flex items-center h-12 px-4 border-b border-border bg-surface/80 backdrop-blur-sm sticky top-0 z-10">
						<Button
							variant="ghost"
							size="icon"
							onClick={() => setSidebarOpen(true)}
							aria-label="Open conversations"
							className="md:hidden -ml-2 h-8 w-8"
						>
							<Menu className="h-4 w-4" />
						</Button>
						<div className="flex items-center gap-2 ml-1 md:ml-0">
							<Link
								href="/"
								className="text-sm font-semibold text-accent tracking-tight hover:text-accent-hover transition-colors"
							>
								Flow
							</Link>
							<span className="text-[11px] font-medium text-text-secondary bg-surface-hover px-2 py-0.5 rounded-full">
								Assistant
							</span>
						</div>
					</header>
					<div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
						<h1 className="text-2xl font-bold text-text-primary tracking-tight mb-3">
							Flow Assistant
						</h1>
						<p className="text-sm text-text-secondary mb-6 max-w-[400px] leading-relaxed">
							Private beta — sign in to try the real assistant.
						</p>
						<div className="flex gap-3 mb-8">
							<SignInButton mode="modal">
								<button className="inline-flex items-center justify-center gap-2 h-10 px-6 rounded-xl bg-accent text-black font-semibold text-sm hover:bg-accent-hover transition-all">
									<LogIn className="h-4 w-4" />
									Sign in
								</button>
							</SignInButton>
						</div>
						{/* Demo prompt chips — non-clickable previews for signed-out visitors */}
						<div className="flex flex-wrap justify-center gap-2 max-w-[560px] mb-6">
							{EXAMPLE_PROMPTS.map((prompt, i) => (
								<span
									key={i}
									className="px-3.5 py-2 rounded-lg border border-border bg-surface text-xs text-text-secondary cursor-default select-none"
								>
									{prompt}
								</span>
							))}
						</div>
						{activeMessages.length > 0 && (
							<ChatMessages messages={activeMessages} isLoading={isLoading} />
						)}
					</div>
				</div>
			</div>
		);
	}

	// ── Render: signed-in state ───────────────────────────────────

	return (
		<div className="flex h-dvh w-screen overflow-hidden bg-background">
			{/* Sidebar */}
			<Sidebar
				conversations={conversations}
				activeId={activeConvoId}
				onSelect={handleSelectConvo}
				onNew={handleNew}
				onRename={handleRename}
				onDelete={handleDelete}
				isOpen={sidebarOpen}
				onClose={() => setSidebarOpen(false)}
			/>

			{/* Main chat area */}
			<div className="flex flex-1 flex-col min-w-0 relative">
				{/* Top bar */}
				<header className="flex items-center h-12 px-4 border-b border-border bg-surface/80 backdrop-blur-sm sticky top-0 z-10">
					<Button
						variant="ghost"
						size="icon"
						onClick={() => setSidebarOpen(true)}
						aria-label="Open conversations"
						className="md:hidden -ml-2 h-8 w-8"
					>
						<Menu className="h-4 w-4" />
					</Button>
					<div className="flex items-center gap-2 ml-1 md:ml-0">
						<Link
							href="/"
							className="text-sm font-semibold text-accent tracking-tight hover:text-accent-hover transition-colors"
						>
							Flow
						</Link>
						<span className="text-[11px] font-medium text-text-secondary bg-surface-hover px-2 py-0.5 rounded-full">
							Assistant
						</span>
					</div>
				</header>

				{/* Messages or empty state */}
				{activeMessages.length === 0 && !isLoading ? (
					<div className="flex-1 flex flex-col items-center justify-center px-6 overflow-y-auto">
						{/* Wordmark */}
						<div className="text-center mb-6">
							<h1 className="text-2xl font-bold text-text-primary tracking-tight mb-2">
								{user?.firstName
									? `${user.firstName}'s Assistant`
									: "Flow Assistant"}
							</h1>
							<p className="text-sm text-text-secondary">
								A sharper AI for serious work.
							</p>
						</div>

						{/* Large search-like composer */}
						<div className="w-full max-w-[640px] mb-6">
							<div className="flex items-end gap-2 bg-surface border border-border rounded-xl px-4 py-2.5 shadow-sm transition-all focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20">
								<input
									value={emptyQuery}
									onChange={(e) => setEmptyQuery(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === "Enter" && !e.shiftKey) {
											e.preventDefault();
											const val = emptyQuery.trim();
											if (val) {
												handleSend(val);
											}
										}
									}}
									placeholder="Ask anything…"
									aria-label="Ask anything"
									className="flex-1 border-0 bg-transparent text-sm text-text-primary placeholder:text-text-tertiary outline-none min-h-[24px]"
								/>
								<Button
									variant="primary"
									size="icon"
									onClick={() => {
										const val = emptyQuery.trim();
										if (val) handleSend(val);
									}}
									disabled={!emptyQuery.trim()}
									aria-label="Send"
									className="shrink-0 rounded-full h-8 w-8"
								>
									<ArrowUp className="h-3.5 w-3.5" />
								</Button>
							</div>
						</div>

						{/* Compact prompt chips */}
						<div className="flex flex-wrap justify-center gap-2 max-w-[560px]">
							{EXAMPLE_PROMPTS.map((prompt, i) => (
								<button
									key={i}
									onClick={() => handleExampleClick(prompt)}
									className="px-3.5 py-2 rounded-lg border border-border bg-surface text-xs text-text-secondary hover:text-text-primary hover:border-accent/40 hover:bg-accent-light transition-all"
								>
									{prompt}
								</button>
							))}
						</div>
					</div>
				) : (
					<ChatMessages messages={activeMessages} isLoading={isLoading} />
				)}

				{/* Composer (shown when there are messages) */}
				{activeMessages.length > 0 && (
					<ChatInput
						onSend={handleSend}
						disabled={isLoading}
						onStop={() => {
							abortRef.current?.abort();
						}}
					/>
				)}
			</div>
		</div>
	);
}

// Wrap in Suspense for useSearchParams support
export default function ChatPage() {
	return (
		<Suspense
			fallback={
				<div className="flex h-dvh w-screen overflow-hidden bg-background items-center justify-center">
					<div className="flex flex-col items-center gap-4">
						<div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
						<p className="text-sm text-text-secondary">Loading…</p>
					</div>
				</div>
			}
		>
			<ChatPageContent />
		</Suspense>
	);
}
