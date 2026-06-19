"use client";

import { useState, useCallback } from "react";
import { downloadAsFile, type ArtifactInfo } from "@/lib/artifacts";

interface CodeBlockProps {
	code: string;
	info: ArtifactInfo;
}

/**
 * Enhanced code block with language badge, copy button (with check feedback),
 * download button, and scroll-safe `<pre>` rendering via text nodes.
 *
 * No dangerouslySetInnerHTML — all content is rendered as React text.
 */
export default function CodeBlock({ code, info }: CodeBlockProps) {
	const [copied, setCopied] = useState(false);

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
		const filename = `code.${info.extension}`;
		downloadAsFile(code, filename, info.mime);
	}, [code, info]);

	return (
		<div className="my-3 group/codeblock">
			{/* Header bar */}
			<div className="flex items-center justify-between bg-surface-hover border border-border rounded-t-lg px-3 py-1.5">
				<span className="text-[11px] font-medium text-text-tertiary uppercase tracking-wide">
					{info.label}
				</span>
				<div className="flex items-center gap-1">
					{/* Copy button */}
					<button
						onClick={handleCopy}
						className="p-1 rounded text-text-tertiary hover:text-text-secondary hover:bg-surface transition-colors"
						aria-label={copied ? "Copied" : "Copy code"}
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
						aria-label="Download code"
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
			{/* Code body */}
			<pre className="bg-background border border-t-0 border-border rounded-b-lg p-3 overflow-x-auto text-sm leading-relaxed">
				<code>{code}</code>
			</pre>
		</div>
	);
}
