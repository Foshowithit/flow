/**
 * ─── Flow Artifacts v1 Utilities ─────────────────────────────────────────────
 *
 * Parse/normalize fence language, classify artifact type, infer metadata,
 * and provide a safe download helper.
 */

export interface ArtifactInfo {
	/** "html" | "svg" | "code" */
	type: "html" | "svg" | "code";
	/** Normalised language label (e.g. "TypeScript", "HTML", "SVG") */
	label: string;
	/** File extension for download */
	extension: string;
	/** MIME type for download / iframe srcdoc */
	mime: string;
}

/**
 * Common language aliases mapped to display labels.
 */
const LANGUAGE_LABELS: Record<string, string> = {
	ts: "TypeScript",
	tsx: "TSX",
	js: "JavaScript",
	jsx: "JSX",
	py: "Python",
	rb: "Ruby",
	rs: "Rust",
	go: "Go",
	java: "Java",
	cpp: "C++",
	c: "C",
	cs: "C#",
	php: "PHP",
	swift: "Swift",
	kt: "Kotlin",
	scala: "Scala",
	sh: "Shell",
	bash: "Bash",
	zsh: "Shell",
	ps1: "PowerShell",
	sql: "SQL",
	html: "HTML",
	svg: "SVG",
	css: "CSS",
	scss: "SCSS",
	less: "Less",
	json: "JSON",
	xml: "XML",
	yaml: "YAML",
	yml: "YAML",
	toml: "TOML",
	md: "Markdown",
	markdown: "Markdown",
	tex: "LaTeX",
	diff: "Diff",
	graphql: "GraphQL",
	prisma: "Prisma",
	txt: "Text",
	text: "Text",
};

/**
 * Parse and normalise a fence language string.
 * Returns the semantic `ArtifactInfo`.
 */
export function inferArtifactInfo(language: string): ArtifactInfo {
	const raw = (language || "").trim().toLowerCase();

	// Strip common prefixes like "language-", "lang-"
	const normalized = raw.replace(/^(language-|lang-)/, "");

	if (normalized === "html" || normalized === "htm") {
		return {
			type: "html",
			label: "HTML",
			extension: "html",
			mime: "text/html",
		};
	}
	if (normalized === "svg") {
		return {
			type: "svg",
			label: "SVG",
			extension: "svg",
			mime: "image/svg+xml",
		};
	}

	// Everything else is treated as a generic code block
	const label = LANGUAGE_LABELS[normalized] || normalized || "Text";

	// Derive a file extension from the language key
	const extension = normalized || "txt";

	return { type: "code", label, extension, mime: "text/plain" };
}

/**
 * Trigger a safe file download from a string of content.
 * Creates a Blob with the given MIME type and downloads it.
 */
export function downloadAsFile(
	content: string,
	filename: string,
	mime: string,
): void {
	const blob = new Blob([content], { type: mime });
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.download = filename;
	anchor.rel = "noopener noreferrer";
	document.body.appendChild(anchor);
	anchor.click();
	// Cleanup
	setTimeout(() => {
		document.body.removeChild(anchor);
		URL.revokeObjectURL(url);
	}, 150);
}

/**
 * Basic sanitisation for content placed inside an iframe srcdoc.
 * This is intentionally minimal — the iframe sandbox attribute is the
 * real security boundary. We just ensure it's a valid HTML document
 * with a doctype for consistent rendering.
 */
export function wrapAsHtmlDocument(content: string, mime: string): string {
	if (mime === "image/svg+xml") {
		// Wrap SVG in a minimal HTML document so it renders inside srcdoc
		return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>SVG Preview</title></head><body>${content}</body></html>`;
	}
	// For text/html, ensure it has a doctype
	if (/<!DOCTYPE\s+html/i.test(content)) {
		return content;
	}
	return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Preview</title></head><body>${content}</body></html>`;
}
