"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import ChatMessages from "@/components/ChatMessages";
import ChatInput, { type ChatInputHandle } from "@/components/ChatInput";
import { ChevronDown } from "lucide-react";

interface Attachment {
	filename: string;
	mimeType: string;
	size: number;
	extractedText: string;
}

interface Message {
	role: "user" | "assistant";
	content: string;
	attachments?: Attachment[];
}

interface AttachmentChip {
	file: File;
	extractedText: string;
	error?: string;
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

const MODELS = [
	{ label: "DS Flash", value: "deepseek-chat" },
	{ label: "DS Pro", value: "deepseek-reasoner" },
];

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

async function attemptStreamingSend(
	body: Record<string, unknown>,
	controller: AbortController,
	setMessages: React.Dispatch<React.SetStateAction<Message[]>>,
	setSessionId: React.Dispatch<React.SetStateAction<string | null>>,
): Promise<boolean> {
	const res = await fetch("/api/chat/stream", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
		signal: controller.signal,
	});

	if (!res.ok || !res.body) return false;

	const reader = res.body.getReader();
	const decoder = new TextDecoder();
	let buffer = "";
	let assistantContent = "";
	let hasContent = false;
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

			if (trimmed.startsWith("data: ")) {
				try {
					const jsonStr = trimmed.slice(6);
					const data = JSON.parse(jsonStr);

					if (data.error) {
						console.error("[STREAM] Server error:", data.error);
						return false;
					}

					if (
						!placeholderInserted &&
						(data.sessionId || data.content !== undefined)
					) {
						placeholderInserted = true;
						setMessages((prev) => [
							...prev,
							{ role: "assistant", content: "" },
						]);
					}

					if (data.sessionId) {
						setSessionId(data.sessionId);
					}

					if (data.content !== undefined) {
						assistantContent += data.content;
						hasContent = true;
						setMessages((prev) => {
							const updated = [...prev];
							if (
								updated.length > 0 &&
								updated[updated.length - 1].role === "assistant"
							) {
								updated[updated.length - 1] = {
									role: "assistant",
									content: assistantContent,
								};
							}
							return updated;
						});
					}

					if (data.mock !== undefined || data.model) {
						// done
					}
				} catch (parseErr) {
					console.error("[STREAM] Parse error:", parseErr);
				}
			}
		}
	}

	if (hasContent) return true;

	if (!hasContent) {
		// Streaming ended without content — set fallback message
		setMessages((prev) => {
			const updated = [...prev];
			if (
				updated.length > 0 &&
				updated[updated.length - 1].role === "assistant"
			) {
				updated[updated.length - 1] = {
					role: "assistant",
					content: "I'm sorry, I wasn't able to generate a response.",
				};
			}
			return updated;
		});
		return true;
	}

	return false;
}

async function attemptJsonSend(
	body: Record<string, unknown>,
	controller: AbortController,
	setMessages: React.Dispatch<React.SetStateAction<Message[]>>,
	setSessionId: React.Dispatch<React.SetStateAction<string | null>>,
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

	const serverSessionId = data.sessionId || data.id;
	if (serverSessionId) {
		setSessionId(serverSessionId);
	}

	const assistantContent =
		data?.choices?.[0]?.message?.content ||
		"I'm sorry, I wasn't able to generate a response.";

	const mockSuffix = data.mock
		? "\n\n---\n*Demo response — sign in for the real assistant.*"
		: "";

	setMessages((prev) => [
		...prev,
		{
			role: "assistant",
			content: assistantContent + mockSuffix,
		},
	]);
}

/**
 * Trim server-side messages for a session to keep only the first `keepCount` messages.
 */
async function trimServerMessages(
	sessionId: string,
	keepCount: number,
): Promise<void> {
	try {
		await fetch(`/api/sessions/${sessionId}/messages/trim`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ keepCount }),
		});
	} catch (err) {
		console.error("[TRIM] Failed to trim server messages:", err);
	}
}

/**
 * Reusable send logic: given a set of messages, re-stream with the API.
 * Sets abortRef so the Stop button can cancel the stream.
 */
async function reStreamMessages(
	slicedMessages: Message[],
	externalSessionId: string | null | undefined,
	serverSessionId: string | null,
	setMessages: React.Dispatch<React.SetStateAction<Message[]>>,
	setServerSessionId: React.Dispatch<React.SetStateAction<string | null>>,
	abortRef: React.MutableRefObject<AbortController | null>,
	onSessionCreated?: (sessionId: string) => void,
): Promise<void> {
	const controller = new AbortController();
	abortRef.current = controller;
	const apiMessages: ApiMessage[] = slicedMessages.map((m) => ({
		role: m.role,
		content: m.content,
		attachments: m.attachments,
	}));

	const body: Record<string, unknown> = {
		messages: apiMessages,
	};
	const effectiveSessionId = externalSessionId || serverSessionId;
	if (effectiveSessionId) {
		body.sessionId = effectiveSessionId;
	}

	// Try streaming first
	const streamed = await attemptStreamingSend(
		body,
		controller,
		setMessages,
		setServerSessionId,
	);

	if (!streamed) {
		await attemptJsonSend(body, controller, setMessages, setServerSessionId);
	}

	// Notify parent if a new server session was created
	if (onSessionCreated && serverSessionId) {
		onSessionCreated(serverSessionId);
	}
}

interface ChatPanelProps {
	sessionId?: string | null;
	initialMessages?: Message[];
	onNewChat?: () => void;
	onSessionCreated?: (sessionId: string) => void;
	isLoading?: boolean;
	chatInputRef?: React.RefObject<ChatInputHandle | null>;
}

export default function ChatPanel({
	sessionId: externalSessionId,
	initialMessages,
	onNewChat: _onNewChat,
	onSessionCreated,
	isLoading: externalLoading,
	chatInputRef,
}: ChatPanelProps) {
	const [messages, setMessages] = useState<Message[]>([]);
	const [serverSessionId, setServerSessionId] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [modelOpen, setModelOpen] = useState(false);
	const [selectedModel, setSelectedModel] = useState(MODELS[0]);
	const abortRef = useRef<AbortController | null>(null);
	const messagesRef = useRef<Message[]>(messages);

	// Sync messages when parent loads a different session
	useEffect(() => {
		if (initialMessages && initialMessages.length > 0) {
			setMessages(initialMessages);
			setServerSessionId(externalSessionId || null);
		} else if (externalSessionId) {
			// Session selected but no messages loaded yet — clear
			setMessages([]);
			setServerSessionId(externalSessionId);
		} else {
			// No session selected — clear everything
			setMessages([]);
			setServerSessionId(null);
		}
	}, [externalSessionId, initialMessages]);

	// Keep messages ref in sync
	useEffect(() => {
		messagesRef.current = messages;
	}, [messages]);

	const handleSend = useCallback(
		async (text: string, attachmentChips?: AttachmentChip[]) => {
			// Build attachments from chips
			let userAttachments: Attachment[] | undefined;
			if (attachmentChips && attachmentChips.length > 0) {
				userAttachments = attachmentChips
					.filter((c) => !c.error && c.extractedText)
					.map((c) => ({
						filename: c.file.name,
						mimeType: c.file.type || "text/plain",
						size: c.file.size,
						extractedText: c.extractedText,
					}));
			}

			const userMessage: Message = {
				role: "user",
				content: text || "(file attachment)",
				attachments: userAttachments,
			};
			setMessages((prev) => [...prev, userMessage]);
			setIsLoading(true);

			const currentMessages = messagesRef.current;
			const allMessages = [...currentMessages, userMessage];
			const apiMessages: ApiMessage[] = allMessages.map((m) => ({
				role: m.role,
				content: m.content,
				attachments: m.attachments,
			}));

			try {
				const controller = new AbortController();
				abortRef.current = controller;

				const body: Record<string, unknown> = {
					messages: apiMessages,
				};
				// Use the prop sessionId (from parent) if available, else the internal one
				const effectiveSessionId = externalSessionId || serverSessionId;
				if (effectiveSessionId) {
					body.sessionId = effectiveSessionId;
				}

				// Try streaming first
				const streamed = await attemptStreamingSend(
					body,
					controller,
					setMessages,
					setServerSessionId,
				);

				if (!streamed) {
					await attemptJsonSend(
						body,
						controller,
						setMessages,
						setServerSessionId,
					);
				}

				// Notify parent if a new server session was created
				if (onSessionCreated && serverSessionId) {
					onSessionCreated(serverSessionId);
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
				setMessages((prev) => [...prev, errorMessage]);
				console.error("Chat error:", err);
			} finally {
				setIsLoading(false);
				abortRef.current = null;
			}
		},
		[externalSessionId, serverSessionId, onSessionCreated],
	);

	/**
	 * Regenerate an assistant response at the given message index.
	 * Finds the preceding user message, trims server history, and re-streams.
	 */
	const handleRegenerate = useCallback(
		async (messageIndex: number) => {
			const currentMessages = messagesRef.current;

			// Find the preceding user message
			let precedingUserIndex = -1;
			for (let i = messageIndex - 1; i >= 0; i--) {
				if (currentMessages[i].role === "user") {
					precedingUserIndex = i;
					break;
				}
			}
			if (precedingUserIndex === -1) return; // No preceding user message found

			// Slice to keep messages up to and including the preceding user message
			const keepCount = precedingUserIndex + 1; // number of messages to keep
			const slicedMessages = currentMessages.slice(0, keepCount);

			// If we have a server session, trim server history
			const effectiveSessionId = externalSessionId || serverSessionId;
			if (effectiveSessionId) {
				await trimServerMessages(effectiveSessionId, keepCount);
			}

			// Update local state
			setMessages(slicedMessages);
			setIsLoading(true);

			try {
				await reStreamMessages(
					slicedMessages,
					externalSessionId,
					serverSessionId,
					setMessages,
					setServerSessionId,
					abortRef,
					onSessionCreated,
				);
			} catch (err: unknown) {
				if (err instanceof DOMException && err.name === "AbortError") return;
				console.error("Regenerate error:", err);
			} finally {
				setIsLoading(false);
				abortRef.current = null;
			}
		},
		[externalSessionId, serverSessionId, onSessionCreated],
	);

	/**
	 * Edit a user message at the given index, replacing its content.
	 * Trims server history and re-streams from the edited point.
	 * Preserves attachments from the original user message.
	 */
	const handleEdit = useCallback(
		async (messageIndex: number, nextContent: string) => {
			const currentMessages = messagesRef.current;
			if (messageIndex < 0 || messageIndex >= currentMessages.length) return;
			if (currentMessages[messageIndex].role !== "user") return;
			if (!nextContent.trim()) return;

			// Replace content and keep messages up to and including this user message
			const editedMessages = currentMessages.map((m, i) =>
				i === messageIndex
					? {
							...m,
							content: nextContent.trim(),
							// Preserve attachments from the original message
							attachments: m.attachments,
						}
					: m,
			);
			const keepCount = messageIndex + 1;
			const slicedMessages = editedMessages.slice(0, keepCount);

			// If we have a server session, trim server history
			const effectiveSessionId = externalSessionId || serverSessionId;
			if (effectiveSessionId) {
				await trimServerMessages(effectiveSessionId, keepCount);
			}

			// Update local state
			setMessages(slicedMessages);
			setIsLoading(true);

			try {
				await reStreamMessages(
					slicedMessages,
					externalSessionId,
					serverSessionId,
					setMessages,
					setServerSessionId,
					abortRef,
					onSessionCreated,
				);
			} catch (err: unknown) {
				if (err instanceof DOMException && err.name === "AbortError") return;
				console.error("Edit error:", err);
			} finally {
				setIsLoading(false);
				abortRef.current = null;
			}
		},
		[externalSessionId, serverSessionId, onSessionCreated],
	);

	const handleStop = useCallback(() => {
		abortRef.current?.abort();
	}, []);

	const isLoadingOrExternal = isLoading || externalLoading === true;

	return (
		<div className="flex flex-col h-full bg-background">
			{/* Header bar */}
			<header className="flex items-center justify-between h-12 px-4 border-b border-border shrink-0 bg-surface/50 backdrop-blur-sm">
				<div className="flex items-center gap-2">
					<span className="text-sm font-semibold text-accent tracking-tight">
						Flow
					</span>
					<span className="text-[11px] font-medium text-text-secondary bg-surface-hover px-2 py-0.5 rounded-full">
						Assistant
					</span>
				</div>

				{/* Model selector */}
				<div className="relative">
					<button
						onClick={() => setModelOpen(!modelOpen)}
						className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-text-secondary bg-surface-hover/50 hover:bg-surface-hover border border-border rounded-lg transition-colors"
					>
						{selectedModel.label}
						<ChevronDown className="h-3 w-3" />
					</button>
					{modelOpen && (
						<>
							<div
								className="fixed inset-0 z-10"
								onClick={() => setModelOpen(false)}
							/>
							<div className="absolute right-0 top-full mt-1 z-20 w-36 bg-surface border border-border rounded-lg shadow-lg overflow-hidden">
								{MODELS.map((model) => (
									<button
										key={model.value}
										onClick={() => {
											setSelectedModel(model);
											setModelOpen(false);
										}}
										className={`w-full text-left px-3 py-2 text-xs transition-colors hover:bg-surface-hover ${
											selectedModel.value === model.value
												? "text-accent font-medium"
												: "text-text-secondary"
										}`}
									>
										{model.label}
									</button>
								))}
							</div>
						</>
					)}
				</div>
			</header>

			{/* Messages area */}
			<div className="flex-1 overflow-y-auto">
				{messages.length === 0 && !isLoadingOrExternal ? (
					<div className="flex flex-col items-center justify-center h-full px-6">
						<div className="text-center mb-6">
							<h1 className="text-xl font-bold text-text-primary tracking-tight mb-2">
								Flow Assistant
							</h1>
							<p className="text-sm text-text-secondary">
								A sharper AI for serious work.
							</p>
						</div>
					</div>
				) : (
					<ChatMessages
						messages={messages}
						isLoading={isLoadingOrExternal}
						onRegenerate={handleRegenerate}
						onEdit={handleEdit}
					/>
				)}
			</div>

			{/* Input area */}
			<div className="shrink-0">
				<ChatInput
					ref={chatInputRef}
					onSend={handleSend}
					disabled={isLoadingOrExternal}
					onStop={handleStop}
				/>
			</div>
		</div>
	);
}
