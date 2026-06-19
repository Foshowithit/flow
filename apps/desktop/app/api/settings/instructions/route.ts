/**
 * ─── Settings: Custom Instructions API ─────────────────────────────────
 *
 * GET  /api/settings/instructions  — return current instructions for the
 *                                    authenticated user.
 * PUT  /api/settings/instructions  — save instructions (max 2000 chars
 *                                    per field).
 *
 * Both require authentication via `getCurrentInternalUser`.
 * Errors are kept generic; no secrets leaked.
 */

import { NextResponse } from "next/server";
import { getCurrentInternalUser } from "@/lib/auth-user";
import {
	CUSTOM_INSTRUCTIONS_MAX_LENGTH,
	getUserInstructions,
	saveUserInstructions,
} from "@/lib/user-instructions";

// ─── GET ───────────────────────────────────────────────────────────────

export async function GET() {
	const user = await getCurrentInternalUser();
	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	try {
		const instructions = await getUserInstructions(user.id);
		return NextResponse.json({
			aboutYou: instructions.aboutYou,
			howToRespond: instructions.howToRespond,
			maxLength: CUSTOM_INSTRUCTIONS_MAX_LENGTH,
		});
	} catch (err) {
		console.error("[SETTINGS_INSTRUCTIONS] GET error:", err);
		return NextResponse.json(
			{ error: "Failed to load instructions." },
			{ status: 500 },
		);
	}
}

// ─── PUT ───────────────────────────────────────────────────────────────

export async function PUT(request: Request) {
	const user = await getCurrentInternalUser();
	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	try {
		const body = (await request.json()) as {
			aboutYou?: string;
			howToRespond?: string;
		};

		// Validate types
		if (body.aboutYou !== undefined && typeof body.aboutYou !== "string") {
			return NextResponse.json(
				{ error: "Invalid request: aboutYou must be a string." },
				{ status: 400 },
			);
		}
		if (
			body.howToRespond !== undefined &&
			typeof body.howToRespond !== "string"
		) {
			return NextResponse.json(
				{ error: "Invalid request: howToRespond must be a string." },
				{ status: 400 },
			);
		}

		// Check max length (before trimming — count raw input)
		if ((body.aboutYou?.length ?? 0) > CUSTOM_INSTRUCTIONS_MAX_LENGTH) {
			return NextResponse.json(
				{
					error: `aboutYou exceeds maximum length of ${CUSTOM_INSTRUCTIONS_MAX_LENGTH} characters.`,
				},
				{ status: 400 },
			);
		}
		if ((body.howToRespond?.length ?? 0) > CUSTOM_INSTRUCTIONS_MAX_LENGTH) {
			return NextResponse.json(
				{
					error: `howToRespond exceeds maximum length of ${CUSTOM_INSTRUCTIONS_MAX_LENGTH} characters.`,
				},
				{ status: 400 },
			);
		}

		const saved = await saveUserInstructions(user.id, {
			aboutYou: body.aboutYou,
			howToRespond: body.howToRespond,
		});

		return NextResponse.json({
			aboutYou: saved.aboutYou,
			howToRespond: saved.howToRespond,
			maxLength: CUSTOM_INSTRUCTIONS_MAX_LENGTH,
		});
	} catch (err) {
		console.error("[SETTINGS_INSTRUCTIONS] PUT error:", err);
		return NextResponse.json(
			{ error: "Failed to save instructions." },
			{ status: 500 },
		);
	}
}
