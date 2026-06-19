import { NextResponse } from "next/server";
import { getCurrentInternalUser } from "@/lib/auth-user";
import { sql } from "@/lib/db";

/**
 * GET /api/account/export — export current user's data as JSON.
 * Requires authentication.
 *
 * Returns: { profile, sessions, messages, summaries, usage }
 * - Messages are capped at the last 1000 per session for reasonable payload size.
 * - api_keys table is excluded for security.
 */
export async function GET() {
	const user = await getCurrentInternalUser();
	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	try {
		// 1. Profile
		const profileRows = (await sql`
			SELECT id, email, first_name, last_name, created_at, updated_at,
			  custom_instructions_about_you, custom_instructions_how_to_respond
			FROM users
			WHERE id = ${user.id}
		`) as Array<Record<string, unknown>>;
		const profile = profileRows[0] ?? null;

		// 2. Sessions (non-deleted)
		const sessions = (await sql`
			SELECT id, title, created_at, updated_at, archived_at
			FROM chat_sessions
			WHERE user_id = ${user.id}
			  AND deleted_at IS NULL
			ORDER BY updated_at DESC
		`) as Array<Record<string, unknown>>;

		// 3. Messages (last 20000, capped for export)
		const messages = (await sql`
			SELECT cm.id, cm.session_id, cm.role, cm.content, cm.attachments, cm.tokens_in, cm.tokens_out, cm.created_at
			FROM chat_messages cm
			JOIN chat_sessions cs ON cs.id = cm.session_id
			WHERE cs.user_id = ${user.id}
			  AND cs.deleted_at IS NULL
			ORDER BY cm.created_at ASC
			LIMIT 20000
		`) as Array<Record<string, unknown>>;

		// 4. Session summaries
		const summaries = (await sql`
			SELECT css.id, css.session_id, css.summary, css.message_count, css.model, css.created_at, css.updated_at
			FROM chat_session_summaries css
			JOIN chat_sessions cs ON cs.id = css.session_id
			WHERE css.user_id = ${user.id}
			  AND cs.user_id = ${user.id}
			  AND cs.deleted_at IS NULL
			ORDER BY css.updated_at DESC
		`) as Array<Record<string, unknown>>;

		// 5. Usage records
		const usage = (await sql`
			SELECT id, session_id, model, tokens_in, tokens_out, cost_cents, created_at
			FROM usage_records
			WHERE user_id = ${user.id}
			ORDER BY created_at DESC
			LIMIT 5000
		`) as Array<Record<string, unknown>>;

		return NextResponse.json({
			exportedAt: new Date().toISOString(),
			profile,
			sessions,
			messages,
			summaries,
			usage,
		});
	} catch (err) {
		console.error("[EXPORT] Failed to export data:", err);
		return NextResponse.json(
			{ error: "Failed to export data." },
			{ status: 500 },
		);
	}
}
