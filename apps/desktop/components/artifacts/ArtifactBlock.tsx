"use client";

import { inferArtifactInfo } from "@/lib/artifacts";
import CodeBlock from "./CodeBlock";
import SandboxPreview from "./SandboxPreview";

interface ArtifactBlockProps {
	/** The raw fence language string (e.g. "html", "tsx", "svg") */
	language: string;
	/** The code content inside the fence */
	code: string;
}

/**
 * Dispatcher component that picks the right artifact rendering based on
 * the fence language.
 *
 * - `html` / `svg` → `<SandboxPreview>` with iframe sandbox
 * - everything else  → `<CodeBlock>` with language badge, copy, download
 */
export default function ArtifactBlock({ language, code }: ArtifactBlockProps) {
	const info = inferArtifactInfo(language);

	if (info.type === "html" || info.type === "svg") {
		return <SandboxPreview code={code} info={info} />;
	}

	return <CodeBlock code={code} info={info} />;
}
