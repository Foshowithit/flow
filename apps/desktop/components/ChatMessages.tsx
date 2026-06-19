"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Paperclip } from "lucide-react";
import ArtifactBlock from "./artifacts/ArtifactBlock";

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

interface ChatMessagesProps {
	messages: Message[];
	isLoading: boolean;
	onRegenerate?: (messageIndex: number) => void;
	onEdit?: (messageIndex: number, nextContent: string) => void;
}

/**
 * HTML-escape a string.
 */
function escapeHtml(s: string): string {
	return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Parse inline text with **bold** and `inline code` into React nodes.
 * All user content is HTML-escaped first to prevent XSS.
 */
function renderInline(text: string): React.ReactNode[] {
	const escaped = escapeHtml(text);
	const parts: React.ReactNode[] = [];
	// Match either `code` or **bold** or plain text segments
	const regex = /`([^`]+)`|\*\*(.+?)\*\*/g;
	let lastIndex = 0;
	let match: RegExpExecArray | null;

	while ((match = regex.exec(escaped)) !== null) {
		// Push plain text before this match
		if (match.index > lastIndex) {
			parts.push(escaped.slice(lastIndex, match.index));
		}

		if (match[1] !== undefined) {
			// Inline code
			parts.push(
				<code
					key={`code-${match.index}`}
					className="bg-background px-1 py-0.5 rounded text-sm font-mono"
				>
					{match[1]}
				</code>,
			);
		} else if (match[2] !== undefined) {
			// Bold
			parts.push(<strong key={`bold-${match.index}`}>{match[2]}</strong>);
		}

		lastIndex = regex.lastIndex;
	}

	// Push remaining plain text
	if (lastIndex < escaped.length) {
		parts.push(escaped.slice(lastIndex));
	}

	return parts;
}

/**
 * Simple markdown-ish rendering for headings, bold, lists, code, newlines.
 * No external dependency — safe and minimal.
 */
function renderSimpleMarkdown(text: string): React.ReactNode[] {
	const nodes: React.ReactNode[] = [];
	const lines = text.split("\n");
	const listItems: React.ReactNode[] = [];

	function flushList() {
		if (listItems.length > 0) {
			nodes.push(
				<ul
					key={`ul-${nodes.length}`}
					className="list-disc list-inside space-y-1 my-2"
				>
					{listItems}
				</ul>,
			);
			listItems.length = 0;
		}
	}

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];

		// Headings
		if (/^#{1,3}\s/.test(line)) {
			flushList();
			const level = line.match(/^#+/)![0].length;
			const content = escapeHtml(line.replace(/^#+\s*/, ""));
			const Tag = level === 1 ? "h1" : level === 2 ? "h2" : "h3";
			const sizeClass =
				level === 1
					? "text-lg font-bold"
					: level === 2
						? "text-base font-semibold"
						: "text-sm font-semibold";
			nodes.push(
				<Tag key={`h-${i}`} className={`${sizeClass} mt-4 mb-2`}>
					{content}
				</Tag>,
			);
			continue;
		}

		// Code block (```)
		if (line.startsWith("```")) {
			flushList();
			// Parse fence language
			const fenceMatch = line.match(/^```(\w+)?/);
			const language = fenceMatch?.[1] || "";
			const codeLines: string[] = [];
			i++;
			while (i < lines.length && !lines[i].startsWith("```")) {
				codeLines.push(lines[i]);
				i++;
			}
			const code = codeLines.join("\n");
			nodes.push(
				<ArtifactBlock key={`code-${i}`} language={language} code={code} />,
			);
			continue;
		}

		// List item
		if (/^[-*+]\s/.test(line)) {
			const content = escapeHtml(line.replace(/^[-*+]\s*/, ""));
			listItems.push(<li key={`li-${i}`}>{content}</li>);
			continue;
		}

		flushList();

		// Empty line → paragraph break
		if (line.trim() === "") {
			nodes.push(<br key={`br-${i}`} />);
			continue;
		}

		// Regular paragraph line with inline formatting
		nodes.push(
			<p key={`p-${i}`} className="mb-2 last:mb-0">
				{renderInline(line)}
			</p>,
		);
	}

	flushList();
	return nodes;
}

function MessageContent({ content }: { content: string }) {
	return <>{renderSimpleMarkdown(content)}</>;
}

/* ─── Copy button ─────────────────────────────────────── */

function CopyButton({ content }: { content: string }) {
	const [copied, setCopied] = useState(false);

	const handleCopy = useCallback(async () => {
		try {
			await navigator.clipboard.writeText(content);
			setCopied(true);
			setTimeout(() => setCopied(false), 1500);
		} catch {
			// Clipboard write failed — silently ignore
		}
	}, [content]);

	return (
		<button
			onClick={handleCopy}
			className="opacity-0 group-hover/message:opacity-100 transition-opacity p-1 rounded-md hover:bg-surface-hover text-text-tertiary hover:text-text-secondary"
			aria-label={copied ? "Copied" : "Copy message"}
			title={copied ? "Copied" : "Copy"}
		>
			{copied ? (
				<svg
					className="h-3.5 w-3.5"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					strokeWidth={2}
				>
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						d="M5 13l4 4L19 7"
					/>
				</svg>
			) : (
				<svg
					className="h-3.5 w-3.5"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					strokeWidth={2}
				>
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
					/>
				</svg>
			)}
		</button>
	);
}

// (Action buttons are inlined below per message type)

/* ─── Inline edit mode ────────────────────────────────── */

function InlineEdit({
	initialContent,
	onSave,
	onCancel,
}: {
	initialContent: string;
	onSave: (content: string) => void;
	onCancel: () => void;
}) {
	const [value, setValue] = useState(initialContent);
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	// Focus the textarea on mount
	useEffect(() => {
		textareaRef.current?.focus();
	}, []);

	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSave();
		}
		if (e.key === "Escape") {
			onCancel();
		}
	};

	const handleSave = () => {
		const trimmed = value.trim();
		if (!trimmed) return;
		onSave(trimmed);
	};

	return (
		<div className="w-full">
			<textarea
				ref={textareaRef}
				value={value}
				onChange={(e) => setValue(e.target.value)}
				onKeyDown={handleKeyDown}
				className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary resize-none outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 min-h-[60px]"
				aria-label="Edit message content"
				rows={3}
			/>
			<div className="flex items-center gap-2 mt-1.5">
				<button
					onClick={handleSave}
					disabled={!value.trim()}
					className="px-3 py-1 text-xs font-medium bg-accent text-white rounded-md hover:bg-accent-hover disabled:opacity-50 disabled:pointer-events-none transition-colors"
					aria-label="Save edit"
				>
					Save
				</button>
				<button
					onClick={onCancel}
					className="px-3 py-1 text-xs font-medium text-text-secondary bg-surface-hover rounded-md hover:bg-border transition-colors"
					aria-label="Cancel edit"
				>
					Cancel
				</button>
			</div>
		</div>
	);
}

/* ─── Main component ──────────────────────────────────── */

export default function ChatMessages({
	messages,
	isLoading,
	onRegenerate,
	onEdit,
}: ChatMessagesProps) {
	const [editingIndex, setEditingIndex] = useState<number | null>(null);

	if (messages.length === 0) {
		return null;
	}

	const handleStartEdit = (index: number) => {
		setEditingIndex(index);
	};

	const handleCancelEdit = () => {
		setEditingIndex(null);
	};

	const handleSaveEdit = (index: number, nextContent: string) => {
		setEditingIndex(null);
		onEdit?.(index, nextContent);
	};

	return (
		<div
			className="flex-1 overflow-y-auto px-4 py-4"
			role="log"
			aria-label="Chat messages"
			aria-live={isLoading ? "polite" : "off"}
		>
			<div className="mx-auto max-w-[760px] space-y-4">
				{messages.map((msg, i) => (
					<div
						key={i}
						className={cn(
							"flex w-full group/message",
							msg.role === "user" ? "justify-end" : "justify-start",
						)}
					>
						{msg.role === "assistant" ? (
							/* Assistant: clean white card */
							<div className="w-full max-w-[90%]">
								<div className="bg-surface border border-border rounded-xl px-5 py-4 shadow-sm">
									<div className="text-sm leading-relaxed text-text-primary">
										<MessageContent content={msg.content} />
									</div>
								</div>
								{/* Action bar for assistant messages */}
								<div className="flex items-center gap-0.5 pl-1">
									<CopyButton content={msg.content} />
									{onRegenerate && !isLoading && (
										<button
											onClick={() => onRegenerate(i)}
											className="opacity-0 group-hover/message:opacity-100 transition-opacity p-1 rounded-md hover:bg-surface-hover text-text-tertiary hover:text-text-secondary"
											aria-label="Regenerate response"
											title="Regenerate"
										>
											<svg
												className="h-3.5 w-3.5"
												fill="none"
												viewBox="0 0 24 24"
												stroke="currentColor"
												strokeWidth={2}
											>
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
												/>
											</svg>
										</button>
									)}
								</div>
							</div>
						) : (
							/* User: compact subtle bubble */
							<div className="max-w-[75%]">
								{editingIndex === i ? (
									<InlineEdit
										initialContent={msg.content}
										onSave={(nextContent) => handleSaveEdit(i, nextContent)}
										onCancel={handleCancelEdit}
									/>
								) : (
									<>
										{/* Attachment chips */}
										{msg.attachments && msg.attachments.length > 0 && (
											<div className="flex flex-wrap gap-1.5 mb-2">
												{msg.attachments.map((att, ai) => (
													<div
														key={ai}
														className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] bg-accent/10 border border-accent/20 text-text-secondary"
													>
														<Paperclip className="h-2.5 w-2.5 shrink-0" />
														<span className="truncate max-w-[100px]">
															{att.filename}
														</span>
														<span className="text-text-tertiary">
															{att.size >= 1024
																? `${(att.size / 1024).toFixed(0)} KB`
																: `${att.size} B`}
														</span>
													</div>
												))}
											</div>
										)}
										<div className="bg-surface-hover text-text-primary rounded-xl px-4 py-2.5 text-sm leading-relaxed">
											<MessageContent content={msg.content} />
										</div>
									</>
								)}
								{/* Action bar for user messages */}
								<div className="flex items-center gap-0.5 justify-end pr-1">
									<CopyButton content={msg.content} />
									{onEdit && !isLoading && (
										<button
											onClick={() => handleStartEdit(i)}
											className="opacity-0 group-hover/message:opacity-100 transition-opacity p-1 rounded-md hover:bg-surface-hover text-text-tertiary hover:text-text-secondary"
											aria-label="Edit message"
											title="Edit"
										>
											<svg
												className="h-3.5 w-3.5"
												fill="none"
												viewBox="0 0 24 24"
												stroke="currentColor"
												strokeWidth={2}
											>
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
												/>
											</svg>
										</button>
									)}
								</div>
							</div>
						)}
					</div>
				))}

				{/* Typing indicator */}
				{isLoading && (
					<div
						className="flex w-full justify-start"
						aria-label="Assistant is typing"
					>
						<div className="w-full max-w-[90%]">
							<div className="bg-surface border border-border rounded-xl px-5 py-4 shadow-sm">
								<div className="flex gap-1.5">
									<span className="h-2 w-2 rounded-full bg-accent/60 animate-bounce [animation-delay:0ms]" />
									<span className="h-2 w-2 rounded-full bg-accent/60 animate-bounce [animation-delay:200ms]" />
									<span className="h-2 w-2 rounded-full bg-accent/60 animate-bounce [animation-delay:400ms]" />
								</div>
							</div>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
