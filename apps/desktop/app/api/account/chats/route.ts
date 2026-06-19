import { NextResponse } from "next/server";
import { getCurrentInternalUser } from "@/lib/auth-user";
import { sql } from "@/lib/db";

/**
 * DELETE /api/account/chats — soft-delete all chat sessions for current user.
 * Requires authentication.
 *
 * Returns: { count: number } — number of sessions soft-deleted.
 * Does NOT delete the Clerk account or user record.
 */
export async function DELETE() {
	const user = await getCurrentInternalUser();
	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	try {
		const result = (await sql`
			UPDATE chat_sessions
			SET deleted_at = NOW(), updated_at = NOW()
			WHERE user_id = ${user.id}
			  AND deleted_at IS NULL
			RETURNING id
		`) as Array<{ id: string }>;

		return NextResponse.json({ count: result.length });
	} catch (err) {
		console.error("[ACCOUNT CHATS] Failed to delete chats:", err);
		return NextResponse.json(
			{ error: "Failed to delete chats." },
			{ status: 500 },
		);
	}
}
