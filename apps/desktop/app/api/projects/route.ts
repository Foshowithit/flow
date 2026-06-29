/**
 * ─── Projects API ─────────────────────────────────────────────────────────
 *
 * GET  /api/projects       — List user's projects
 * POST /api/projects       — Create a project
 */

import { type NextRequest, NextResponse } from "next/server";
import { getCurrentInternalUser } from "@/lib/auth-user";
import { sql } from "@/lib/db";

/**
 * GET /api/projects — List user's projects.
 */
export async function GET() {
	const user = await getCurrentInternalUser();
	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	try {
		const rows = (await sql`
			SELECT id, name, description, instructions, created_at, updated_at
			FROM projects
			WHERE user_id = ${user.id}
			ORDER BY created_at DESC
		`) as Array<{
			id: string;
			name: string;
			description: string | null;
			instructions: string | null;
			created_at: string;
			updated_at: string;
		}>;

		return NextResponse.json(rows);
	} catch (err) {
		console.error("[PROJECTS] Failed to list projects:", err);
		return NextResponse.json(
			{ error: "Failed to load projects." },
			{ status: 500 },
		);
	}
}

/**
 * POST /api/projects — Create a project.
 *
 * Body:
 *   name          (required)
 *   description?  (optional)
 *   instructions? (optional)
 */
export async function POST(request: NextRequest) {
	const user = await getCurrentInternalUser();
	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	try {
		const body: {
			name?: string;
			description?: string;
			instructions?: string;
		} = await request.json();

		if (
			!body.name ||
			typeof body.name !== "string" ||
			body.name.trim().length === 0
		) {
			return NextResponse.json({ error: "name is required." }, { status: 400 });
		}

		const name = body.name.trim();
		const description = body.description?.trim() ?? null;
		const instructions = body.instructions?.trim() ?? null;

		const result = (await sql`
			INSERT INTO projects (user_id, name, description, instructions)
			VALUES (${user.id}, ${name}, ${description}, ${instructions})
			RETURNING id, name, description, instructions, created_at, updated_at
		`) as Array<{
			id: string;
			name: string;
			description: string | null;
			instructions: string | null;
			created_at: string;
			updated_at: string;
		}>;

		return NextResponse.json(result[0], { status: 201 });
	} catch (err) {
		console.error("[PROJECTS] Failed to create project:", err);
		return NextResponse.json(
			{ error: "Failed to create project." },
			{ status: 500 },
		);
	}
}
