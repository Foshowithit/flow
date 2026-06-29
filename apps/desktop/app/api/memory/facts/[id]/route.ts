/**
 * ─── Memory Fact by ID API ───────────────────────────────────────────────
 *
 * PATCH  /api/memory/facts/[id]  — Edit a memory fact
 * DELETE /api/memory/facts/[id]  — Delete a memory fact
 */

import { type NextRequest, NextResponse } from "next/server";
import { getCurrentInternalUser } from "@/lib/auth-user";
import { sql } from "@/lib/db";
import { embedText } from "@/lib/embeddings";

function vectorToString(v: number[]): string {
	return `[${v.join(",")}]`;
}

/**
 * PATCH /api/memory/facts/[id] — Edit a memory fact.
 *
 * Body: { content?, category?, importance? }
 */
export async function PATCH(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	const user = await getCurrentInternalUser();
	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { id } = await params;

	try {
		// Verify ownership
		const existing = (await sql`
			SELECT id, content FROM memories
			WHERE id = ${id} AND user_id = ${user.id}
		`) as Array<{ id: string; content: string }>;

		if (existing.length === 0) {
			return NextResponse.json(
				{ error: "Memory fact not found or access denied." },
				{ status: 404 },
			);
		}

		const body: {
			content?: string;
			category?: string;
			importance?: number;
		} = await request.json();

		if (
			body.content === undefined &&
			body.category === undefined &&
			body.importance === undefined
		) {
			return NextResponse.json(
				{ error: "No fields to update." },
				{ status: 400 },
			);
		}

		// Validate content if provided
		if (body.content !== undefined) {
			if (
				typeof body.content !== "string" ||
				body.content.trim().length === 0
			) {
				return NextResponse.json(
					{ error: "content must be a non-empty string." },
					{ status: 400 },
				);
			}
		}

		const content =
			body.content !== undefined ? body.content.trim() : undefined;
		const category = body.category;
		const importance =
			body.importance !== undefined
				? Math.max(1, Math.min(5, Math.round(body.importance)))
				: undefined;

		// Re-generate embedding if content changes
		let embeddingStr: string | null = null;
		if (content !== undefined) {
			try {
				const embedding = await embedText(content);
				embeddingStr = vectorToString(embedding);
			} catch (embedErr) {
				console.error("[MEMORY FACTS] Re-embedding failed:", embedErr);
			}
		}

		const result = (await sql`
			UPDATE memories
			SET
				updated_at = NOW()
				${content !== undefined ? sql`, content = ${content}` : sql``}
				${category !== undefined ? sql`, category = ${category}` : sql``}
				${importance !== undefined ? sql`, importance = ${importance}` : sql``}
				${embeddingStr !== null ? sql`, embedding = ${embeddingStr}::vector` : sql``}
			WHERE id = ${id} AND user_id = ${user.id}
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

		return NextResponse.json(result[0]);
	} catch (err) {
		console.error("[MEMORY FACTS] Failed to update fact:", err);
		return NextResponse.json(
			{ error: "Failed to update memory fact." },
			{ status: 500 },
		);
	}
}

/**
 * DELETE /api/memory/facts/[id] — Delete a memory fact.
 */
export async function DELETE(
	_request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	const user = await getCurrentInternalUser();
	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { id } = await params;

	try {
		const result = (await sql`
			DELETE FROM memories
			WHERE id = ${id} AND user_id = ${user.id}
			RETURNING id
		`) as Array<{ id: string }>;

		if (result.length === 0) {
			return NextResponse.json(
				{ error: "Memory fact not found or access denied." },
				{ status: 404 },
			);
		}

		return NextResponse.json({ ok: true }, { status: 200 });
	} catch (err) {
		console.error("[MEMORY FACTS] Failed to delete fact:", err);
		return NextResponse.json(
			{ error: "Failed to delete memory fact." },
			{ status: 500 },
		);
	}
}
