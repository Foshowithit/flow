import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { sql } from "@/lib/db";

/**
 * GET /api/admin/users — admin-only list of users with usage stats.
 * No chat message contents are exposed.
 */
export async function GET() {
	try {
		await requireAdmin();
	} catch (err: any) {
		if (err.name === "UnauthorizedError") {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	try {
		const rows = (await sql`
			SELECT
			  u.id,
			  u.email,
			  u.first_name,
			  u.last_name,
			  u.role,
			  u.beta_status,
			  u.created_at,
			  u.deleted_at,
			  (SELECT COUNT(*)::int FROM chat_sessions cs WHERE cs.user_id = u.id AND cs.deleted_at IS NULL)   AS session_count,
			  (SELECT COUNT(*)::int FROM chat_messages cm JOIN chat_sessions cs ON cm.session_id = cs.id WHERE cs.user_id = u.id AND cs.deleted_at IS NULL) AS message_count,
			  (SELECT COUNT(*)::int FROM usage_records ur WHERE ur.user_id = u.id)                              AS usage_count,
			  (SELECT COALESCE(SUM(ur.cost_cents), 0)::int FROM usage_records ur WHERE ur.user_id = u.id)       AS total_cost_cents
			FROM users u
			ORDER BY u.created_at DESC
		`) as Array<{
			id: string;
			email: string;
			first_name: string | null;
			last_name: string | null;
			role: string;
			beta_status: string;
			created_at: string;
			deleted_at: string | null;
			session_count: number;
			message_count: number;
			usage_count: number;
			total_cost_cents: number;
		}>;

		return NextResponse.json(rows);
	} catch (err) {
		console.error("[ADMIN USERS] Failed to list users:", err);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}
