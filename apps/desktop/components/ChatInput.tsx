"use client";

import {
	useState,
	useRef,
	useEffect,
	forwardRef,
	useImperativeHandle,
	type KeyboardEvent,
	type DragEvent,
} from "react";
import { Button } from "@/components/ui/button";
import { ArrowUp, Square, Paperclip, X } from "lucide-react";
import {
	ATTACHMENT_LIMITS,
	ACCEPTED_EXTENSIONS,
	processExtractedText,
	sanitizeText,
} from "@/lib/attachments";

export interface ChatInputHandle {
	focus: () => void;
}

interface AttachmentChip {
	file: File;
	extractedText: string;
	error?: string;
}

interface ChatInputProps {
	onSend: (message: string, attachments?: AttachmentChip[]) => void;
	disabled: boolean;
	onStop?: () => void;
}

const ChatInput = forwardRef<ChatInputHandle, ChatInputProps>(
	function ChatInput({ onSend, disabled, onStop }, ref) {
		const [input, setInput] = useState("");
		const [attachmentChips, setAttachmentChips] = useState<AttachmentChip[]>(
			[],
		);
		const [dragOver, setDragOver] = useState(false);
		const [clientError, setClientError] = useState<string | null>(null);
		const textareaRef = useRef<HTMLTextAreaElement>(null);
		const fileInputRef = useRef<HTMLInputElement>(null);

		// Expose focus method
		useImperativeHandle(ref, () => ({
			focus: () => {
				textareaRef.current?.focus();
			},
		}));

		// Auto-resize textarea
		useEffect(() => {
			const el = textareaRef.current;
			if (el) {
				el.style.height = "auto";
				el.style.height = Math.min(el.scrollHeight, 160) + "px";
			}
		}, [input]);

		// Focus on mount
		useEffect(() => {
			textareaRef.current?.focus();
		}, []);

		// ── File processing ───────────────────────────────────────────

		const readFileAsText = (file: File): Promise<string> => {
			return new Promise((resolve, reject) => {
				const reader = new FileReader();
				reader.onload = () => resolve(reader.result as string);
				reader.onerror = () => reject(new Error("Failed to read file"));
				reader.readAsText(file);
			});
		};

		const isAcceptedFile = (file: File): boolean => {
			// Check by extension (more reliable than MIME type for code files)
			const name = file.name.toLowerCase();
			const extMatch = ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext));
			if (extMatch) return true;

			// Also check common MIME types
			const acceptedMimes = [
				"text/plain",
				"text/html",
				"text/xml",
				"text/markdown",
				"text/css",
				"text/csv",
				"application/json",
				"application/javascript",
				"text/javascript",
				"application/typescript",
				"text/x-sh",
				"text/x-python",
				"text/x-rust",
				"text/x-go",
				"text/x-java",
				"text/x-c",
				"text/x-c++",
				"text/x-sql",
			];
			return acceptedMimes.includes(file.type);
		};

		const processFiles = async (files: FileList | File[]) => {
			setClientError(null);
			const fileArray = Array.from(files);
			const existingCount = attachmentChips.length;

			if (existingCount + fileArray.length > ATTACHMENT_LIMITS.MAX_COUNT) {
				setClientError(
					`You can attach at most ${ATTACHMENT_LIMITS.MAX_COUNT} files per message.`,
				);
				return;
			}

			const newChips: AttachmentChip[] = [];

			for (const file of fileArray) {
				// Check size first
				if (file.size > ATTACHMENT_LIMITS.MAX_FILE_SIZE_BYTES) {
					newChips.push({
						file,
						extractedText: "",
						error: `File exceeds 1 MB limit (${(file.size / 1024 / 1024).toFixed(2)} MB)`,
					});
					continue;
				}

				// Check if accepted
				if (!isAcceptedFile(file)) {
					newChips.push({
						file,
						extractedText: "",
						error: `Unsupported file type. Accepted: text, code, markdown, etc.`,
					});
					continue;
				}

				try {
					const text = await readFileAsText(file);
					const processed = processExtractedText(text);
					newChips.push({ file, extractedText: processed });
				} catch {
					newChips.push({
						file,
						extractedText: "",
						error: "Failed to read file content.",
					});
				}
			}

			setAttachmentChips((prev) => [...prev, ...newChips]);
		};

		// ── File picker ──────────────────────────────────────────────

		const handleFilePickerClick = () => {
			fileInputRef.current?.click();
		};

		const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
			if (e.target.files && e.target.files.length > 0) {
				processFiles(e.target.files);
			}
			// Reset so the same file can be re-selected
			e.target.value = "";
		};

		// ── Drag / drop ─────────────────────────────────────────────

		const handleDragOver = (e: DragEvent) => {
			e.preventDefault();
			e.stopPropagation();
			setDragOver(true);
		};

		const handleDragLeave = (e: DragEvent) => {
			e.preventDefault();
			e.stopPropagation();
			setDragOver(false);
		};

		const handleDrop = (e: DragEvent) => {
			e.preventDefault();
			e.stopPropagation();
			setDragOver(false);
			if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
				processFiles(e.dataTransfer.files);
			}
		};

		// ── Chip removal ────────────────────────────────────────────

		const removeChip = (index: number) => {
			setAttachmentChips((prev) => prev.filter((_, i) => i !== index));
			setClientError(null);
		};

		// ── Submit ──────────────────────────────────────────────────

		function handleSubmit() {
			const trimmed = input.trim();
			if ((!trimmed && attachmentChips.length === 0) || disabled) return;

			// Validate no errors on chips
			const hasErrors = attachmentChips.some((c) => c.error);
			if (hasErrors) {
				setClientError(
					"Please remove files with errors before sending.",
				);
				return;
			}

			onSend(trimmed, attachmentChips.length > 0 ? attachmentChips : undefined);
			setInput("");
			setAttachmentChips([]);
			setClientError(null);
		}

		function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
			if (e.key === "Enter" && !e.shiftKey) {
				e.preventDefault();
				handleSubmit();
			}
		}

		if (disabled) {
			return (
				<div className="sticky bottom-0 px-4 pb-4 pt-2 bg-gradient-to-t from-background via-background to-transparent pointer-events-none">
					<div className="mx-auto w-full max-w-[760px] pointer-events-auto">
						<div className="flex items-center gap-2 bg-surface border border-border rounded-xl px-4 py-2.5 shadow-sm">
							<div className="flex-1 text-sm text-text-tertiary">
								<span className="animate-pulse">Processing…</span>
							</div>
							<Button
								variant="ghost"
								size="sm"
								onClick={onStop}
								aria-label="Stop generating"
								className="shrink-0 h-8 px-3 rounded-full border border-border"
							>
								<Square className="h-3.5 w-3.5 mr-1.5 fill-current" />
								Stop
							</Button>
						</div>
					</div>
				</div>
			);
		}

		return (
			<div
				className={cn(
					"sticky bottom-0 px-4 pb-4 pt-2 bg-gradient-to-t from-background via-background to-transparent pointer-events-none",
					dragOver && "ring-2 ring-accent ring-offset-2 ring-offset-background rounded-2xl",
				)}
				onDragOver={handleDragOver}
				onDragLeave={handleDragLeave}
				onDrop={handleDrop}
			>
				<div className="mx-auto w-full max-w-[760px] pointer-events-auto">
					{/* Attachment chips */}
					{attachmentChips.length > 0 && (
						<div className="flex flex-wrap gap-2 mb-2">
							{attachmentChips.map((chip, i) => (
								<div
									key={i}
									className={cn(
										"flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs border",
										chip.error
											? "bg-red-500/10 border-red-500/30 text-red-400"
											: "bg-accent/10 border-accent/20 text-text-primary",
									)}
								>
									<Paperclip className="h-3 w-3 shrink-0" />
									<span className="max-w-[120px] truncate">
										{chip.file.name}
									</span>
									<span className="text-text-tertiary shrink-0">
										{chip.file.size >= 1024
											? `${(chip.file.size / 1024).toFixed(0)} KB`
											: `${chip.file.size} B`}
									</span>
									{chip.error ? (
										<span
											className="text-red-400 ml-1 cursor-pointer"
											onClick={() => removeChip(i)}
											title={chip.error}
										>
											<X className="h-3 w-3" />
										</span>
									) : (
										<button
											onClick={() => removeChip(i)}
											className="hover:bg-surface-hover rounded p-0.5 transition-colors"
											aria-label={`Remove ${chip.file.name}`}
										>
											<X className="h-3 w-3" />
										</button>
									)}
								</div>
							))}
						</div>
					)}

					{/* Client error message */}
					{clientError && (
						<div className="mb-2 text-xs text-red-400 px-1">
							{clientError}
						</div>
					)}

					{/* Input bar */}
					<div className="flex items-end gap-2 bg-surface border border-border rounded-xl px-4 py-2 shadow-sm transition-all focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20">
						<textarea
							ref={textareaRef}
							placeholder="Ask anything…"
							value={input}
							onChange={(e) => setInput(e.target.value)}
							onKeyDown={handleKeyDown}
							rows={1}
							disabled={disabled}
							aria-label="Chat input"
							className="flex-1 border-0 bg-transparent px-0 py-2 text-sm text-text-primary placeholder:text-text-tertiary resize-none outline-none min-h-[28px] max-h-[160px] leading-relaxed disabled:opacity-50"
						/>

						{/* Paperclip button */}
						<button
							type="button"
							onClick={handleFilePickerClick}
							disabled={disabled || attachmentChips.length >= ATTACHMENT_LIMITS.MAX_COUNT}
							aria-label="Attach file"
							className={cn(
								"shrink-0 rounded-full h-9 w-9 flex items-center justify-center transition-colors",
								attachmentChips.length >= ATTACHMENT_LIMITS.MAX_COUNT
									? "text-text-tertiary opacity-40 cursor-not-allowed"
									: "text-text-tertiary hover:text-text-secondary hover:bg-surface-hover",
							)}
						>
							<Paperclip className="h-4 w-4" />
						</button>

						<Button
							variant="primary"
							size="icon"
							onClick={handleSubmit}
							disabled={disabled || (!input.trim() && attachmentChips.length === 0)}
							aria-label="Send message"
							className="shrink-0 rounded-full h-9 w-9"
						>
							<ArrowUp className="h-4 w-4" />
						</Button>
					</div>

					{/* Hidden file input */}
					<input
						ref={fileInputRef}
						type="file"
						multiple
						accept={ACCEPTED_EXTENSIONS.join(",")}
						className="hidden"
						onChange={handleFileChange}
						aria-hidden="true"
					/>
				</div>
			</div>
		);
	},
);

export default ChatInput;

// Local cn helper (avoids import in this file if not already imported)
function cn(...classes: (string | boolean | undefined | null)[]): string {
	return classes.filter(Boolean).join(" ");
}
