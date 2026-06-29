/**
 * ─── Memory Facts API ────────────────────────────────────────────────────
 *
 * GET  /api/memory/facts        — List memory facts for the authenticated user
 * POST /api/memory/facts        — Create a memory fact manually
 */

import { type NextRequest, NextResponse } from "next/server";
import { getCurrentInternalUser } from "@/lib/auth-user";
import { sql } from "@/lib/db";
import { embedText } from "@/lib/embeddings";

/**
 * GET /api/memory/facts — List memory facts for the authenticated user.
 *
 * Query params:
 *   category?  — filter by category
 *   limit?     — max results (default 20)
 *   offset?    — pagination offset (default 0)
 */
export async function GET(request: NextRequest) {
	const user = await getCurrentInternalUser();
	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	try {
		const { searchParams } = new URL(request.url);
		const category = searchParams.get("category");
		const limit = Math.min(
			Math.max(parseInt(searchParams.get("limit") ?? "20", 10) || 20, 1),
			100,
		);
		const offset = Math.max(
			parseInt(searchParams.get("offset") ?? "0", 10) || 0,
			0,
		);

		// Count total matching records
		const countResult = category
			? ((await sql`
				SELECT COUNT(*)::int AS total
				FROM memories
				WHERE user_id = ${user.id} AND category = ${category}
			`) as Array<{ total: number }>)
			: ((await sql`
				SELECT COUNT(*)::int AS total
				FROM memories
				WHERE user_id = ${user.id}
			`) as Array<{ total: number }>);

		const total = countResult[0]?.total ?? 0;

		// Fetch records
		let rows;
		if (category) {
			rows = (await sql`
				SELECT id, content, category, importance, source_session_id, created_at, updated_at
				FROM memories
				WHERE user_id = ${user.id} AND category = ${category}
				ORDER BY created_at DESC
				LIMIT ${limit} OFFSET ${offset}
			`) as Array<{
				id: string;
				content: string;
				category: string;
				importance: number;
				source_session_id: string | null;
				created_at: string;
				updated_at: string;
			}>;
		} else {
			rows = (await sql`
				SELECT id, content, category, importance, source_session_id, created_at, updated_at
				FROM memories
				WHERE user_id = ${user.id}
				ORDER BY created_at DESC
				LIMIT ${limit} OFFSET ${offset}
			`) as Array<{
				id: string;
				content: string;
				category: string;
				importance: number;
				source_session_id: string | null;
				created_at: string;
				updated_at: string;
			}>;
		}

		return NextResponse.json({ facts: rows, total });
	} catch (err) {
		console.error("[MEMORY FACTS] Failed to list facts:", err);
		return NextResponse.json(
			{ error: "Failed to load memory facts." },
			{ status: 500 },
		);
	}
}

/**
 * POST /api/memory/facts — Create a memory fact manually.
 *
 * Body:
 *   content    (required) — the fact text
 *   category   (optional, default "general")
 *   importance (optional, default 3)
 */
export async function POST(request: NextRequest) {
	const user = await getCurrentInternalUser();
	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	try {
		const body: {
			content?: string;
			category?: string;
			importance?: number;
		} = await request.json();

		if (
			!body.content ||
			typeof body.content !== "string" ||
			body.content.trim().length === 0
		) {
			return NextResponse.json(
				{ error: "content is required." },
				{ status: 400 },
			);
		}

		const content = body.content.trim();
		const category = body.category ?? "general";
		const importance =
			typeof body.importance === "number"
				? Math.max(1, Math.min(5, Math.round(body.importance)))
				: 3;

		// Generate embedding
		let embeddingStr: string | null = null;
		try {
			const embedding = await embedText(content);
			embeddingStr = `[${embedding.join(",")}]`;
		} catch (embedErr) {
			console.error(
				"[MEMORY FACTS] Embedding failed for fact creation:",
				embedErr,
			);
			// Continue without embedding
		}

		const result = (await sql`
			INSERT INTO memories (user_id, content, category, importance, embedding)
			VALUES (
				${user.id},
				${content},
				${category},
				${importance},
				${embeddingStr ? `${embeddingStr}::vector` : null}
			)
			RETURNING id, content, category, importance, source_session_id, created_at, updated_at
		`) as Array<{
			id: string;
			content: string;
			category: string;
			importance: number;
			source_session_id: string | null;
			created_at: string;
			updated_at: string;
		}>;

		const fact = result[0];
		return NextResponse.json(fact, { status: 201 });
	} catch (err) {
		console.error("[MEMORY FACTS] Failed to create fact:", err);
		return NextResponse.json(
			{ error: "Failed to create memory fact." },
			{ status: 500 },
		);
	}
}
