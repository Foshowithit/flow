import { NextRequest, NextResponse } from "next/server";
import { getCurrentInternalUser } from "@/lib/auth-user";
import { sql } from "@/lib/db";

/**
 * PATCH /api/sessions/[sessionId] — update session title and/or archive status.
 * Requires authentication and ownership.
 */
export async function PATCH(
	request: NextRequest,
	{ params }: { params: Promise<{ sessionId: string }> },
) {
	const user = await getCurrentInternalUser();
	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { sessionId } = await params;

	try {
		// Verify ownership and that session is not deleted
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

		const body: { title?: string; archived?: boolean } = await request.json();

		// Validate title length if provided
		if (body.title !== undefined) {
			const trimmed = body.title.trim();
			if (trimmed.length < 1 || trimmed.length > 120) {
				return NextResponse.json(
					{ error: "Title must be between 1 and 120 characters." },
					{ status: 400 },
				);
			}
		}

		// Build and execute the update
		let result;

		if (body.title !== undefined && body.archived !== undefined) {
			result = await sql`
				UPDATE chat_sessions
				SET title = ${body.title.trim()},
				    archived_at = ${body.archived ? new Date().toISOString() : null},
				    updated_at = NOW()
				WHERE id = ${sessionId} AND user_id = ${user.id}
				RETURNING id, title, archived_at, deleted_at, created_at, updated_at
			`;
		} else if (body.title !== undefined) {
			result = await sql`
				UPDATE chat_sessions
				SET title = ${body.title.trim()}, updated_at = NOW()
				WHERE id = ${sessionId} AND user_id = ${user.id}
				RETURNING id, title, archived_at, deleted_at, created_at, updated_at
			`;
		} else if (body.archived !== undefined) {
			result = await sql`
				UPDATE chat_sessions
				SET archived_at = ${body.archived ? new Date().toISOString() : null}, updated_at = NOW()
				WHERE id = ${sessionId} AND user_id = ${user.id}
				RETURNING id, title, archived_at, deleted_at, created_at, updated_at
			`;
		} else {
			return NextResponse.json(
				{ error: "No fields to update." },
				{ status: 400 },
			);
		}

		const updated = (result as Array<Record<string, unknown>>)[0];
		return NextResponse.json(updated);
	} catch (err) {
		console.error("[SESSION PATCH] Failed to update session:", err);
		return NextResponse.json(
			{ error: "Failed to update session." },
			{ status: 500 },
		);
	}
}

/**
 * DELETE /api/sessions/[sessionId] — soft-delete a session (sets deleted_at).
 * Requires authentication and ownership.
 */
export async function DELETE(
	_request: NextRequest,
	{ params }: { params: Promise<{ sessionId: string }> },
) {
	const user = await getCurrentInternalUser();
	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { sessionId } = await params;

	try {
		// Soft-delete: set deleted_at timestamp
		const result = (await sql`
			UPDATE chat_sessions
			SET deleted_at = NOW(), updated_at = NOW()
			WHERE id = ${sessionId} AND user_id = ${user.id} AND deleted_at IS NULL
			RETURNING id
		`) as Array<{ id: string }>;

		if (result.length === 0) {
			return NextResponse.json(
				{ error: "Session not found or access denied." },
				{ status: 404 },
			);
		}

		return NextResponse.json({ ok: true });
	} catch (err) {
		console.error("[SESSION DELETE] Failed to delete session:", err);
		return NextResponse.json(
			{ error: "Failed to delete session." },
			{ status: 500 },
		);
	}
}
