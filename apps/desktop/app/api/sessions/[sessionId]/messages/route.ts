import { NextRequest, NextResponse } from "next/server";
import { getCurrentInternalUser } from "@/lib/auth-user";
import { sql } from "@/lib/db";

/**
 * GET /api/sessions/[sessionId]/messages — get messages for an owned session.
 * Requires authentication and ownership.
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
		// Verify ownership and grab messages in one query
		const rows = (await sql`
			SELECT cm.id, cm.role, cm.content, cm.attachments, cm.created_at
			FROM chat_messages cm
			JOIN chat_sessions cs ON cs.id = cm.session_id
			WHERE cm.session_id = ${sessionId}
			  AND cs.user_id = ${user.id}
			  AND cs.deleted_at IS NULL
			ORDER BY cm.created_at ASC
		`) as Array<{
			id: string;
			role: string;
			content: string;
			attachments: any;
			created_at: string;
		}>;

		// If session doesn't exist or user doesn't own it, rows will be empty
		if (rows.length === 0) {
			// Check if session exists (ownership check)
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
		}

		return NextResponse.json(rows);
	} catch (err) {
		console.error("[SESSION MESSAGES] Failed to load messages:", err);
		return NextResponse.json(
			{ error: "Failed to load messages." },
			{ status: 500 },
		);
	}
}
