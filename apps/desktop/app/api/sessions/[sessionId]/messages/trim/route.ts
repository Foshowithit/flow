import { NextRequest, NextResponse } from "next/server";
import { getCurrentInternalUser } from "@/lib/auth-user";
import { sql } from "@/lib/db";

/**
 * POST /api/sessions/[sessionId]/messages/trim
 *
 * Trims server-side message history for a session to the given keepCount.
 * Deletes messages at index >= keepCount (ordered by created_at, id).
 * Also clears any stale session summary and updates session updated_at.
 *
 * Body: { keepCount: number }
 * Response: { success: true, deletedCount: number }
 */
export async function POST(
	request: NextRequest,
	{ params }: { params: Promise<{ sessionId: string }> },
) {
	const user = await getCurrentInternalUser();
	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { sessionId } = await params;

	try {
		// Verify ownership
		const existing = (await sql`
			SELECT id FROM chat_sessions
			WHERE id = ${sessionId} AND user_id = ${user.id} AND deleted_at IS NULL
		`) as Array<{ id: string }>;

		if (existing.length === 0) {
			return NextResponse.json(
				{ error: "Session not found or access denied." },
				{ status: 404 },
			);
		}

		const body: { keepCount?: number } = await request.json();
		const keepCount = body.keepCount;

		if (typeof keepCount !== "number" || keepCount < 0 || !Number.isInteger(keepCount)) {
			return NextResponse.json(
				{ error: "keepCount must be a non-negative integer." },
				{ status: 400 },
			);
		}

		// Count current messages
		const countRows = (await sql`
			SELECT COUNT(*)::int AS cnt
			FROM chat_messages
			WHERE session_id = ${sessionId}
		`) as Array<{ cnt: number }>;

		const totalCount = countRows[0]?.cnt ?? 0;

		if (keepCount >= totalCount) {
			return NextResponse.json({ success: true, deletedCount: 0 });
		}

		// Delete messages with rank >= keepCount (ordered by created_at, id)
		const deleteResult = (await sql`
			WITH ranked AS (
				SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC) AS rn
				FROM chat_messages
				WHERE session_id = ${sessionId}
			)
			DELETE FROM chat_messages
			WHERE id IN (SELECT id FROM ranked WHERE rn > ${keepCount})
			RETURNING id
		`) as Array<{ id: string }>;

		const deletedCount = deleteResult.length;

		// Clear stale session summary for this session
		await sql`
			DELETE FROM chat_session_summaries
			WHERE session_id = ${sessionId}
		`;

		// Update session updated_at
		await sql`
			UPDATE chat_sessions
			SET updated_at = NOW()
			WHERE id = ${sessionId}
		`;

		return NextResponse.json({ success: true, deletedCount });
	} catch (err) {
		console.error("[TRIM MESSAGES] Failed to trim messages:", err);
		return NextResponse.json(
			{ error: "Failed to trim messages." },
			{ status: 500 },
		);
	}
}
