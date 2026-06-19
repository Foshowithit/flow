import { NextRequest, NextResponse } from "next/server";
import { getCurrentInternalUser } from "@/lib/auth-user";
import { sql } from "@/lib/db";

/**
 * GET /api/sessions/[sessionId]/summary
 *
 * Returns the memory summary for an owned session.
 * Response shape: { summary: string | null, messageCount: number, updatedAt: string | null }
 */
export async function GET(
	_request: NextRequest,
	{ params }: { params: Promise<{ sessionId: string }> },
) {
	const user = await getCurrentInternalUser();
	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { sessionId } = await params;

	try {
		// Verify ownership first
		const sessionCheck = (await sql`
			SELECT 1 FROM chat_sessions
			WHERE id = ${sessionId} AND user_id = ${user.id} AND deleted_at IS NULL
		`) as Array<Record<string, unknown>>;

		if (sessionCheck.length === 0) {
			return NextResponse.json(
				{ error: "Session not found or access denied." },
				{ status: 404 },
			);
		}

		// Fetch summary
		const rows = (await sql`
			SELECT summary, message_count, updated_at
			FROM chat_session_summaries
			WHERE user_id = ${user.id} AND session_id = ${sessionId}
		`) as Array<{
			summary: string;
			message_count: number;
			updated_at: string;
		}>;

		if (rows.length === 0) {
			return NextResponse.json({
				summary: null,
				messageCount: 0,
				updatedAt: null,
			});
		}

		return NextResponse.json({
			summary: rows[0].summary,
			messageCount: rows[0].message_count,
			updatedAt: rows[0].updated_at,
		});
	} catch (err) {
		console.error("[SESSION SUMMARY] Failed to load summary:", err);
		return NextResponse.json(
			{ error: "Failed to load session summary." },
			{ status: 500 },
		);
	}
}
