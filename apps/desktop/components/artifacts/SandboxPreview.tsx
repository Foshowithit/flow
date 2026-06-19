"use client";

import { useState, useCallback, useMemo } from "react";
import {
	downloadAsFile,
	wrapAsHtmlDocument,
	type ArtifactInfo,
} from "@/lib/artifacts";

interface SandboxPreviewProps {
	code: string;
	info: ArtifactInfo;
}

type ViewMode = "preview" | "source";

/**
 * Sandboxed iframe preview for HTML and SVG content.
 *
 * - Uses `<iframe srcDoc=... sandbox="allow-scripts">` with NO `allow-same-origin`.
 * - No top-navigation, no popups, no forms.
 * - Provides a source/preview toggle and download button.
 * - Renders source view as a plain code block (no raw HTML injection).
 */
export default function SandboxPreview({ code, info }: SandboxPreviewProps) {
	const [viewMode, setViewMode] = useState<ViewMode>("preview");
	const [copied, setCopied] = useState(false);

	const srcdoc = useMemo(
		() => wrapAsHtmlDocument(code, info.mime),
		[code, info.mime],
	);

	const handleCopy = useCallback(async () => {
		try {
			await navigator.clipboard.writeText(code);
			setCopied(true);
			setTimeout(() => setCopied(false), 1500);
		} catch {
			// Clipboard write failed — silently ignore
		}
	}, [code]);

	const handleDownload = useCallback(() => {
		const filename = `artifact.${info.extension}`;
		downloadAsFile(code, filename, info.mime);
	}, [code, info]);

	return (
		<div className="my-3 group/artifact border border-border rounded-lg overflow-hidden">
			{/* Header bar */}
			<div className="flex items-center justify-between bg-surface-hover px-3 py-1.5">
				<div className="flex items-center gap-2">
					<span className="text-[11px] font-medium text-text-tertiary uppercase tracking-wide">
						{info.label}
					</span>
					{/* View toggle */}
					<div className="flex items-center bg-background rounded-md p-0.5 gap-0.5">
						<button
							onClick={() => setViewMode("preview")}
							className={`px-2 py-0.5 text-[11px] font-medium rounded transition-colors ${
								viewMode === "preview"
									? "bg-accent text-white"
									: "text-text-tertiary hover:text-text-secondary"
							}`}
							aria-label="Show preview"
						>
							Preview
						</button>
						<button
							onClick={() => setViewMode("source")}
							className={`px-2 py-0.5 text-[11px] font-medium rounded transition-colors ${
								viewMode === "source"
									? "bg-accent text-white"
									: "text-text-tertiary hover:text-text-secondary"
							}`}
							aria-label="Show source"
						>
							Source
						</button>
					</div>
				</div>
				<div className="flex items-center gap-1">
					{/* Copy button */}
					<button
						onClick={handleCopy}
						className="p-1 rounded text-text-tertiary hover:text-text-secondary hover:bg-surface transition-colors"
						aria-label={copied ? "Copied" : "Copy source"}
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
					{/* Download button */}
					<button
						onClick={handleDownload}
						className="p-1 rounded text-text-tertiary hover:text-text-secondary hover:bg-surface transition-colors"
						aria-label="Download artifact"
						title="Download"
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
								d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
							/>
						</svg>
					</button>
				</div>
			</div>

			{/* Content area */}
			{viewMode === "preview" ? (
				<div className="bg-white w-full" style={{ minHeight: 200 }}>
					<iframe
						srcDoc={srcdoc}
						sandbox="allow-scripts"
						title="Sandboxed preview"
						className="w-full border-0"
						style={{ minHeight: 200, height: "auto" }}
						/* Allow the iframe to shrink-wrap its content
               (a small script inside srcdoc posts its height) */
						onLoad={(e) => {
							try {
								const iframe = e.currentTarget;
								const innerDoc = iframe.contentDocument;
								if (innerDoc?.body) {
									const height = Math.max(
										innerDoc.documentElement.scrollHeight,
										innerDoc.body.scrollHeight,
										200,
									);
									iframe.style.height = `${Math.min(height, 600)}px`;
								}
							} catch {
								// Cross-origin errors are expected — just keep min height
							}
						}}
					/>
				</div>
			) : (
				<pre className="bg-background p-3 overflow-x-auto text-sm leading-relaxed max-h-[400px] overflow-y-auto">
					<code>{code}</code>
				</pre>
			)}
		</div>
	);
}
