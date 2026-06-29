/**
 * ─── Project by ID API ────────────────────────────────────────────────────
 *
 * GET    /api/projects/[id]   — Get project details (including knowledge file count)
 * PATCH  /api/projects/[id]   — Update name/description/instructions
 * DELETE /api/projects/[id]   — Delete project (cascades to knowledge + memories)
 */

import { type NextRequest, NextResponse } from "next/server";
import { getCurrentInternalUser } from "@/lib/auth-user";
import { sql } from "@/lib/db";

/**
 * GET /api/projects/[id] — Get project details with knowledge file count.
 */
export async function GET(
	_request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	const user = await getCurrentInternalUser();
	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { id } = await params;

	try {
		const rows = (await sql`
			SELECT
				p.id,
				p.name,
				p.description,
				p.instructions,
				p.created_at,
				p.updated_at,
				COALESCE(kc.count, 0)::int AS knowledge_file_count
			FROM projects p
			LEFT JOIN (
				SELECT project_id, COUNT(*)::int AS count
				FROM project_knowledge
				GROUP BY project_id
			) kc ON kc.project_id = p.id
			WHERE p.id = ${id} AND p.user_id = ${user.id}
		`) as Array<{
			id: string;
			name: string;
			description: string | null;
			instructions: string | null;
			created_at: string;
			updated_at: string;
			knowledge_file_count: number;
		}>;

		if (rows.length === 0) {
			return NextResponse.json(
				{ error: "Project not found or access denied." },
				{ status: 404 },
			);
		}

		return NextResponse.json(rows[0]);
	} catch (err) {
		console.error("[PROJECTS] Failed to get project:", err);
		return NextResponse.json(
			{ error: "Failed to load project." },
			{ status: 500 },
		);
	}
}

/**
 * PATCH /api/projects/[id] — Update project name/description/instructions.
 *
 * Body: { name?, description?, instructions? }
 */
export async function PATCH(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	const user = await getCurrentInternalUser();
	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { id } = await params;

	try {
		// Verify ownership
		const existing = (await sql`
			SELECT id FROM projects
			WHERE id = ${id} AND user_id = ${user.id}
		`) as Array<{ id: string }>;

		if (existing.length === 0) {
			return NextResponse.json(
				{ error: "Project not found or access denied." },
				{ status: 404 },
			);
		}

		const body: {
			name?: string;
			description?: string;
			instructions?: string;
		} = await request.json();

		if (
			body.name === undefined &&
			body.description === undefined &&
			body.instructions === undefined
		) {
			return NextResponse.json(
				{ error: "No fields to update." },
				{ status: 400 },
			);
		}

		// Validate name if provided
		if (body.name !== undefined) {
			if (typeof body.name !== "string" || body.name.trim().length === 0) {
				return NextResponse.json(
					{ error: "name must be a non-empty string." },
					{ status: 400 },
				);
			}
		}

		const name = body.name !== undefined ? body.name.trim() : undefined;
		const description =
			body.description !== undefined ? body.description.trim() : undefined;
		const instructions =
			body.instructions !== undefined ? body.instructions.trim() : undefined;

		const result = (await sql`
			UPDATE projects
			SET
				updated_at = NOW()
				${name !== undefined ? sql`, name = ${name}` : sql``}
				${description !== undefined ? sql`, description = ${description}` : sql``}
				${instructions !== undefined ? sql`, instructions = ${instructions}` : sql``}
			WHERE id = ${id} AND user_id = ${user.id}
			RETURNING id, name, description, instructions, created_at, updated_at
		`) as Array<{
			id: string;
			name: string;
			description: string | null;
			instructions: string | null;
			created_at: string;
			updated_at: string;
		}>;

		return NextResponse.json(result[0]);
	} catch (err) {
		console.error("[PROJECTS] Failed to update project:", err);
		return NextResponse.json(
			{ error: "Failed to update project." },
			{ status: 500 },
		);
	}
}

/**
 * DELETE /api/projects/[id] — Delete project (cascades to knowledge + memories).
 */
export async function DELETE(
	_request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	const user = await getCurrentInternalUser();
	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { id } = await params;

	try {
		// Verify ownership
		const existing = (await sql`
			SELECT id FROM projects
			WHERE id = ${id} AND user_id = ${user.id}
		`) as Array<{ id: string }>;

		if (existing.length === 0) {
			return NextResponse.json(
				{ error: "Project not found or access denied." },
				{ status: 404 },
			);
		}

		// Delete the project — CASCADE handles project_knowledge, project_knowledge_chunks,
		// and project_memories via foreign key constraints.
		await sql`
			DELETE FROM projects
			WHERE id = ${id} AND user_id = ${user.id}
		`;

		return NextResponse.json({ ok: true });
	} catch (err) {
		console.error("[PROJECTS] Failed to delete project:", err);
		return NextResponse.json(
			{ error: "Failed to delete project." },
			{ status: 500 },
		);
	}
}
