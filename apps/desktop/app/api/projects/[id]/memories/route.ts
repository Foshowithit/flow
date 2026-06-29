/**
 * ─── Project Memories API ─────────────────────────────────────────────────
 *
 * GET    /api/projects/[id]/memories     — List project-scoped memories
 * DELETE /api/projects/[id]/memories?id=... — Delete a specific project memory
 */

import { type NextRequest, NextResponse } from "next/server";
import { getCurrentInternalUser } from "@/lib/auth-user";
import { sql } from "@/lib/db";

/**
 * GET /api/projects/[id]/memories — List project-scoped memories.
 */
export async function GET(
	_request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	const user = await getCurrentInternalUser();
	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { id: projectId } = await params;

	try {
		// Verify project ownership
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

		const rows = (await sql`
			SELECT id, content, category, importance, source_session_id, created_at
			FROM project_memories
			WHERE project_id = ${projectId}
			ORDER BY created_at DESC
			LIMIT 100
		`) as Array<{
			id: string;
			content: string;
			category: string;
			importance: number;
			source_session_id: string | null;
			created_at: string;
		}>;

		return NextResponse.json(rows);
	} catch (err) {
		console.error("[PROJECT MEMORIES] Failed to list memories:", err);
		return NextResponse.json(
			{ error: "Failed to list project memories." },
			{ status: 500 },
		);
	}
}

/**
 * DELETE /api/projects/[id]/memories?id=... — Delete a specific project memory.
 */
export async function DELETE(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	const user = await getCurrentInternalUser();
	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { id: projectId } = await params;

	try {
		// Verify project ownership
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

		const { searchParams } = new URL(request.url);
		const memoryId = searchParams.get("id");

		if (!memoryId) {
			return NextResponse.json(
				{ error: "Query parameter 'id' is required." },
				{ status: 400 },
			);
		}

		const result = (await sql`
			DELETE FROM project_memories
			WHERE id = ${memoryId} AND project_id = ${projectId}
			RETURNING id
		`) as Array<{ id: string }>;

		if (result.length === 0) {
			return NextResponse.json(
				{ error: "Project memory not found." },
				{ status: 404 },
			);
		}

		return NextResponse.json({ ok: true });
	} catch (err) {
		console.error("[PROJECT MEMORIES] Failed to delete memory:", err);
		return NextResponse.json(
			{ error: "Failed to delete project memory." },
			{ status: 500 },
		);
	}
}
