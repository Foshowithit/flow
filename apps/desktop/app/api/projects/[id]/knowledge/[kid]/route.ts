/**
 * ─── Project Knowledge File API ───────────────────────────────────────────
 *
 * DELETE /api/projects/[id]/knowledge/[kid] — Delete a knowledge file and its chunks
 */

import { type NextRequest, NextResponse } from "next/server";
import { getCurrentInternalUser } from "@/lib/auth-user";
import { sql } from "@/lib/db";

/**
 * DELETE /api/projects/[id]/knowledge/[kid] — Delete a knowledge file and its chunks.
 *
 * The CASCADE foreign key from project_knowledge_chunks to project_knowledge
 * handles chunk deletion automatically.
 */
export async function DELETE(
	_request: NextRequest,
	{ params }: { params: Promise<{ id: string; kid: string }> },
) {
	const user = await getCurrentInternalUser();
	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { id: projectId, kid } = await params;

	try {
		// Verify project ownership first
		const project = (await sql`
			SELECT id FROM projects
			WHERE id = ${projectId} AND user_id = ${user.id}
		`) as Array<{ id: string }>;

		if (project.length === 0) {
			return NextResponse.json(
				{ error: "Project not found or access denied." },
				{ status: 404 },
			);
		}

		// Delete the knowledge file (CASCADE removes chunks)
		const result = (await sql`
			DELETE FROM project_knowledge
			WHERE id = ${kid} AND project_id = ${projectId}
			RETURNING id
		`) as Array<{ id: string }>;

		if (result.length === 0) {
			return NextResponse.json(
				{ error: "Knowledge file not found." },
				{ status: 404 },
			);
		}

		return NextResponse.json({ ok: true });
	} catch (err) {
		console.error("[PROJECT KNOWLEDGE] Failed to delete knowledge file:", err);
		return NextResponse.json(
			{ error: "Failed to delete knowledge file." },
			{ status: 500 },
		);
	}
}
