import { NextRequest, NextResponse } from "next/server";
import { getCurrentInternalUser } from "@/lib/auth-user";
import { sql } from "@/lib/db";

/**
 * GET /api/sessions — list current user's sessions (non-deleted).
 * Requires authentication.
 */
export async function GET() {
	const user = await getCurrentInternalUser();
	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	try {
		const rows = (await sql`
			SELECT cs.id, cs.title, cs.created_at, cs.updated_at, cs.archived_at
			FROM chat_sessions cs
			WHERE cs.user_id = ${user.id}
			  AND cs.deleted_at IS NULL
			ORDER BY cs.updated_at DESC
			LIMIT 100
		`) as Array<{
			id: string;
			title: string;
			created_at: string;
			updated_at: string;
			archived_at: string | null;
		}>;

		return NextResponse.json(rows);
	} catch (err) {
		console.error("[SESSIONS] Failed to list sessions:", err);
		return NextResponse.json(
			{ error: "Failed to load sessions." },
			{ status: 500 },
		);
	}
}

/**
 * POST /api/sessions — create a new session.
 * Requires authentication.
 */
export async function POST(request: NextRequest) {
	const user = await getCurrentInternalUser();
	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	try {
		const body: { title?: string } = await request.json();
		const title = body.title?.trim() || "New Chat";

		const result = (await sql`
			INSERT INTO chat_sessions (user_id, title)
			VALUES (${user.id}, ${title})
			RETURNING id, title, created_at
		`) as Array<{ id: string; title: string; created_at: string }>;

		return NextResponse.json(result[0], { status: 201 });
	} catch (err) {
		console.error("[SESSIONS] Failed to create session:", err);
		return NextResponse.json(
			{ error: "Failed to create session." },
			{ status: 500 },
		);
	}
}
