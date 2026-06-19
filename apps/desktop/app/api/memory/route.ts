import { NextResponse } from "next/server";
import { getCurrentInternalUser } from "@/lib/auth-user";
import { sql } from "@/lib/db";

/**
 * GET /api/memory — list current user's session summaries (non-deleted sessions only).
 * Requires authentication.
 * Returns: Array of { session_id, title, summary, message_count, updated_at }
 */
export async function GET() {
	const user = await getCurrentInternalUser();
	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	try {
		const rows = (await sql`
			SELECT
				css.session_id,
				cs.title,
				css.summary,
				css.message_count,
				css.updated_at
			FROM chat_session_summaries css
			JOIN chat_sessions cs ON cs.id = css.session_id
			WHERE css.user_id = ${user.id}
			  AND cs.user_id = ${user.id}
			  AND cs.deleted_at IS NULL
			ORDER BY css.updated_at DESC
			LIMIT 200
		`) as Array<{
			session_id: string;
			title: string;
			summary: string;
			message_count: number;
			updated_at: string;
		}>;

		return NextResponse.json(rows);
	} catch (err) {
		console.error("[MEMORY API] Failed to list summaries:", err);
		return NextResponse.json(
			{ error: "Failed to load memory data." },
			{ status: 500 },
		);
	}
}
