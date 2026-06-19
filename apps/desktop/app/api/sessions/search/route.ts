import { NextRequest, NextResponse } from "next/server";
import { getCurrentInternalUser } from "@/lib/auth-user";
import { sql } from "@/lib/db";

/**
 * GET /api/sessions/search?q=...
 *
 * Search the current user's conversations (non-deleted sessions and messages).
 * Returns top ~20 matching results.
 *
 * Requires authentication.
 */
export async function GET(request: NextRequest) {
	const user = await getCurrentInternalUser();
	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	try {
		const q = request.nextUrl.searchParams.get("q");
		if (!q) {
			return NextResponse.json(
				{ error: "Query parameter 'q' is required." },
				{ status: 400 },
			);
		}

		const trimmed = q.trim();
		if (trimmed.length < 2 || trimmed.length > 120) {
			return NextResponse.json(
				{ error: "Query must be between 2 and 120 characters." },
				{ status: 400 },
			);
		}

		const pattern = `%${trimmed}%`;

		// Search across sessions and messages in a single query.
		// Use ILIKE for case-insensitive matching.
		// Return session-level results with a snippet from the matched message.
		const rows = (await sql`
			WITH matched AS (
				SELECT
					cs.id AS session_id,
					cs.title,
					cs.created_at,
					cs.updated_at,
					cm.role AS matched_role,
					cm.content AS matched_content,
					cm.created_at AS message_created_at,
					ROW_NUMBER() OVER (
						PARTITION BY cs.id
						ORDER BY
							CASE
								WHEN cs.title ILIKE ${pattern} THEN 0
								ELSE 1
							END,
							cm.created_at DESC
					) AS rn
				FROM chat_sessions cs
				LEFT JOIN chat_messages cm ON cm.session_id = cs.id
				WHERE cs.user_id = ${user.id}
				  AND cs.deleted_at IS NULL
				  AND (
					cs.title ILIKE ${pattern}
					OR cm.content ILIKE ${pattern}
				  )
			)
			SELECT
				session_id,
				title,
				created_at,
				updated_at,
				matched_role,
				SUBSTRING(matched_content, 1, 200) AS snippet,
				message_created_at
			FROM matched
			WHERE rn = 1
			ORDER BY updated_at DESC
			LIMIT 20
		`) as Array<{
			session_id: string;
			title: string;
			created_at: string;
			updated_at: string;
			matched_role: string | null;
			snippet: string | null;
			message_created_at: string | null;
		}>;

		const results = rows.map((r) => ({
			sessionId: r.session_id,
			title: r.title,
			createdAt: r.created_at,
			updatedAt: r.updated_at,
			matchedRole: r.matched_role,
			snippet: r.snippet,
			messageCreatedAt: r.message_created_at,
		}));

		return NextResponse.json(results);
	} catch (err) {
		console.error("[SESSION SEARCH] Failed:", err);
		return NextResponse.json(
			{ error: "Search failed." },
			{ status: 500 },
		);
	}
}
