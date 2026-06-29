/**
 * ─── Memory Facts Search API ─────────────────────────────────────────────
 *
 * GET /api/memory/facts/search?q=... — Vector search across memory facts.
 *
 * If embedding generation fails, falls back to ILIKE text search on content.
 */

import { type NextRequest, NextResponse } from "next/server";
import { getCurrentInternalUser } from "@/lib/auth-user";
import { sql } from "@/lib/db";
import { embedText } from "@/lib/embeddings";

function vectorToString(v: number[]): string {
	return `[${v.join(",")}]`;
}

export async function GET(request: NextRequest) {
	const user = await getCurrentInternalUser();
	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	try {
		const { searchParams } = new URL(request.url);
		const q = searchParams.get("q");

		if (!q || q.trim().length === 0) {
			return NextResponse.json(
				{ error: "Query parameter 'q' is required." },
				{ status: 400 },
			);
		}

		const query = q.trim();

		// Try vector search first
		try {
			const embedding = await embedText(query);
			const embeddingStr = vectorToString(embedding);

			const rows = (await sql`
				SELECT id, content, category, importance, source_session_id, created_at, updated_at,
				       1 - (embedding <=> ${embeddingStr}::vector) AS similarity
				FROM memories
				WHERE user_id = ${user.id}
				  AND embedding IS NOT NULL
				ORDER BY embedding <=> ${embeddingStr}::vector
				LIMIT 20
			`) as Array<{
				id: string;
				content: string;
				category: string;
				importance: number;
				source_session_id: string | null;
				created_at: string;
				updated_at: string;
				similarity: number;
			}>;

			return NextResponse.json({ facts: rows, total: rows.length });
		} catch {
			// Embedding failed — fall back to ILIKE text search
			console.log(
				"[MEMORY FACTS SEARCH] Vector search failed, falling back to ILIKE",
			);
		}

		// Fallback: ILIKE text search
		const searchPattern = `%${query}%`;
		const rows = (await sql`
			SELECT id, content, category, importance, source_session_id, created_at, updated_at
			FROM memories
			WHERE user_id = ${user.id}
			  AND content ILIKE ${searchPattern}
			ORDER BY created_at DESC
			LIMIT 20
		`) as Array<{
			id: string;
			content: string;
			category: string;
			importance: number;
			source_session_id: string | null;
			created_at: string;
			updated_at: string;
		}>;

		return NextResponse.json({ facts: rows, total: rows.length });
	} catch (err) {
		console.error("[MEMORY FACTS SEARCH] Search failed:", err);
		return NextResponse.json(
			{ error: "Failed to search memory facts." },
			{ status: 500 },
		);
	}
}
