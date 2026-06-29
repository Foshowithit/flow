/**
 * ─── Project Knowledge API ────────────────────────────────────────────────
 *
 * POST /api/projects/[id]/knowledge   — Upload a knowledge file
 * GET  /api/projects/[id]/knowledge   — List knowledge files for a project
 */

import { type NextRequest, NextResponse } from "next/server";
import { getCurrentInternalUser } from "@/lib/auth-user";
import { sql } from "@/lib/db";
import { embedText } from "@/lib/embeddings";
import { chunkText } from "@/lib/memory-v2";

const ACCEPTED_MIME_TYPES = [
	"text/plain",
	"text/markdown",
	"text/x-markdown",
	"text/csv",
	"application/json",
	"text/typescript",
	"application/typescript",
	"text/javascript",
	"application/javascript",
	"text/x-python",
	"text/x-typescript",
	"text/x-js",
];

const ACCEPTED_EXTENSIONS = [
	".txt",
	".md",
	".csv",
	".json",
	".ts",
	".tsx",
	".py",
	".js",
];

function getMimeType(filename: string): string {
	const ext = filename.toLowerCase().split(".").pop();
	switch (ext) {
		case "txt":
			return "text/plain";
		case "md":
			return "text/markdown";
		case "csv":
			return "text/csv";
		case "json":
			return "application/json";
		case "ts":
		case "tsx":
			return "text/typescript";
		case "py":
			return "text/x-python";
		case "js":
			return "text/javascript";
		default:
			return "text/plain";
	}
}

function isAcceptedFile(filename: string): boolean {
	const lower = filename.toLowerCase();
	return ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

function vectorToString(v: number[]): string {
	return `[${v.join(",")}]`;
}

/**
 * POST /api/projects/[id]/knowledge — Upload a knowledge file.
 *
 * Accepts multipart/form-data with a "file" field.
 * Reads the file text, chunks it, embeds each chunk, and stores them.
 */
export async function POST(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	const user = await getCurrentInternalUser();
	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { id: projectId } = await params;

	try {
		// Verify project ownership
		const project = (await sql`
			SELECT id FROM projects
			WHERE id = ${projectId} AND user_id = ${user.id}
		`) as Array<{ id: string }>;

		if (project.length === 0) {
			return NextResponse.json(
				{ error: "Project not found or access denied." },
				{ status: 404 },
			);
		}

		const formData = await request.formData();
		const fileField = formData.get("file");

		if (!fileField || !(fileField instanceof File)) {
			return NextResponse.json(
				{ error: "A 'file' field with a valid file is required." },
				{ status: 400 },
			);
		}

		const file = fileField as File;
		const filename = file.name;

		if (!isAcceptedFile(filename)) {
			return NextResponse.json(
				{
					error: `Unsupported file type. Accepted extensions: ${ACCEPTED_EXTENSIONS.join(", ")}`,
				},
				{ status: 400 },
			);
		}

		// Read file content as text
		let textContent: string;
		try {
			textContent = await file.text();
		} catch {
			return NextResponse.json(
				{ error: "Failed to read file content." },
				{ status: 400 },
			);
		}

		if (!textContent || textContent.trim().length === 0) {
			return NextResponse.json({ error: "File is empty." }, { status: 400 });
		}

		const mimeType = getMimeType(filename);

		// Chunk the text
		const chunks = chunkText(textContent);

		// Estimate token count (rough heuristic: chars / 4)
		const tokenCount = Math.ceil(textContent.length / 4);

		// Insert the knowledge document
		const knowledgeResult = (await sql`
			INSERT INTO project_knowledge (project_id, title, source, content)
			VALUES (${projectId}, ${filename}, ${mimeType}, ${textContent})
			RETURNING id, project_id, title, source, created_at
		`) as Array<{
			id: string;
			project_id: string;
			title: string | null;
			source: string | null;
			created_at: string;
		}>;

		const knowledgeId = knowledgeResult[0].id;

		// Embed and insert each chunk
		for (let i = 0; i < chunks.length; i++) {
			const chunkContent = chunks[i];
			try {
				const embedding = await embedText(chunkContent);
				const embeddingStr = vectorToString(embedding);

				await sql`
					INSERT INTO project_knowledge_chunks
						(knowledge_id, project_id, content, embedding, chunk_index)
					VALUES
						(${knowledgeId}, ${projectId}, ${chunkContent}, ${embeddingStr}::vector, ${i})
				`;
			} catch (chunkErr) {
				console.error(
					`[PROJECT KNOWLEDGE] Failed to embed chunk ${i}:`,
					chunkErr,
				);
				// Store chunk without embedding
				await sql`
					INSERT INTO project_knowledge_chunks
						(knowledge_id, project_id, content, chunk_index)
					VALUES
						(${knowledgeId}, ${projectId}, ${chunkContent}, ${i})
				`;
			}
		}

		return NextResponse.json(
			{
				id: knowledgeId,
				name: filename,
				mime_type: mimeType,
				token_count: tokenCount,
				chunk_count: chunks.length,
				created_at: knowledgeResult[0].created_at,
			},
			{ status: 201 },
		);
	} catch (err) {
		console.error("[PROJECT KNOWLEDGE] Failed to upload knowledge file:", err);
		return NextResponse.json(
			{ error: "Failed to upload knowledge file." },
			{ status: 500 },
		);
	}
}

/**
 * GET /api/projects/[id]/knowledge — List knowledge files for a project.
 */
export async function GET(
	_request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	const user = await getCurrentInternalUser();
	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { id: projectId } = await params;

	try {
		// Verify project ownership
		const project = (await sql`
			SELECT id FROM projects
			WHERE id = ${projectId} AND user_id = ${user.id}
		`) as Array<{ id: string }>;

		if (project.length === 0) {
			return NextResponse.json(
				{ error: "Project not found or access denied." },
				{ status: 404 },
			);
		}

		const rows = (await sql`
			SELECT
				id,
				title AS name,
				source AS mime_type,
				CEIL(LENGTH(content) / 4.0)::int AS token_count,
				created_at
			FROM project_knowledge
			WHERE project_id = ${projectId}
			ORDER BY created_at DESC
		`) as Array<{
			id: string;
			name: string | null;
			mime_type: string | null;
			token_count: number;
			created_at: string;
		}>;

		return NextResponse.json(rows);
	} catch (err) {
		console.error("[PROJECT KNOWLEDGE] Failed to list knowledge files:", err);
		return NextResponse.json(
			{ error: "Failed to list knowledge files." },
			{ status: 500 },
		);
	}
}
