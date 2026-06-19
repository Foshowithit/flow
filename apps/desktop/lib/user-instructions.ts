/**
 * ─── Flow Custom Instructions ──────────────────────────────────────────
 *
 * Helpers for reading/writing per-user custom instructions (Claude-style
 * "About you" / "How to respond") persisted in the `users` table.
 *
 * These are injected as early system messages in chat requests so the
 * model can personalise responses.  Failures must never break chat.
 */

import { sql } from "@/lib/db";

// ─── Constants ────────────────────────────────────────────────────────

export const CUSTOM_INSTRUCTIONS_MAX_LENGTH = 2000;

// ─── Types ────────────────────────────────────────────────────────────

export interface UserInstructions {
	aboutYou: string;
	howToRespond: string;
	hasInstructions: boolean;
}

export interface UserInstructionsInput {
	aboutYou?: string;
	howToRespond?: string;
}

// ─── Normalisation ────────────────────────────────────────────────────

/**
 * Normalise and trim a single instruction field.
 * - Trims leading/trailing whitespace
 * - Replaces multiple blank lines with a single blank line
 * - Returns empty string when input is null/undefined/whitespace-only
 */
export function normalizeInstruction(value: string | null | undefined): string {
	if (!value) return "";
	return value.trim().replace(/\n{3,}/g, "\n\n"); // Collapse 3+ consecutive newlines to 2
}

/**
 * Truncate a value to maxLength characters, preserving whole words when possible.
 */
export function truncateInstruction(
	value: string,
	maxLength: number = CUSTOM_INSTRUCTIONS_MAX_LENGTH,
): string {
	if (value.length <= maxLength) return value;
	return value.slice(0, maxLength);
}

// ─── Fetch ────────────────────────────────────────────────────────────

/**
 * getDefaultInstructions — returns a "no instructions" result.
 * Used as fallback when the DB call fails.
 */
function getDefaultInstructions(): UserInstructions {
	return { aboutYou: "", howToRespond: "", hasInstructions: false };
}

/**
 * getUserInstructions — fetch custom instructions for a user.
 * Returns { aboutYou, howToRespond, hasInstructions }.
 * Never throws — returns empty instructions on error.
 */
export async function getUserInstructions(
	userId: string,
): Promise<UserInstructions> {
	try {
		const rows = (await sql`
			SELECT custom_instructions_about_you, custom_instructions_how_to_respond
			FROM users
			WHERE id = ${userId}
		`) as Array<{
			custom_instructions_about_you: string | null;
			custom_instructions_how_to_respond: string | null;
		}>;

		if (rows.length === 0) return getDefaultInstructions();

		const aboutYou = rows[0].custom_instructions_about_you ?? "";
		const howToRespond = rows[0].custom_instructions_how_to_respond ?? "";

		return {
			aboutYou,
			howToRespond,
			hasInstructions: aboutYou.length > 0 || howToRespond.length > 0,
		};
	} catch (err) {
		console.error("[USER_INSTRUCTIONS] Error fetching instructions:", err);
		return getDefaultInstructions();
	}
}

// ─── Format for system message ────────────────────────────────────────

/**
 * formatUserInstructionsForSystemMessage — build a system prompt snippet
 * from the user's custom instructions.  Returns null when both fields are
 * empty (caller can skip injection entirely).
 *
 * The returned string is a plain-text system message suitable for inclusion
 * in the provider messages array.
 */
export function formatUserInstructionsForSystemMessage(
	aboutYou: string,
	howToRespond: string,
): string | null {
	const trimmedAbout = normalizeInstruction(aboutYou);
	const trimmedHow = normalizeInstruction(howToRespond);

	if (!trimmedAbout && !trimmedHow) return null;

	const parts: string[] = [];

	if (trimmedAbout) {
		parts.push(`About the user:\n${trimmedAbout}`);
	}

	if (trimmedHow) {
		parts.push(`Response preferences:\n${trimmedHow}`);
	}

	return parts.join("\n\n");
}

// ─── Save ─────────────────────────────────────────────────────────────

/**
 * saveUserInstructions — persist custom instructions for a user.
 * Validates and truncates each field to CUSTOM_INSTRUCTIONS_MAX_LENGTH.
 *
 * Returns the saved values (after normalisation/truncation).
 * Throws on DB error.
 */
export async function saveUserInstructions(
	userId: string,
	data: UserInstructionsInput,
): Promise<{ aboutYou: string; howToRespond: string }> {
	const aboutYou = truncateInstruction(
		normalizeInstruction(data.aboutYou),
		CUSTOM_INSTRUCTIONS_MAX_LENGTH,
	);
	const howToRespond = truncateInstruction(
		normalizeInstruction(data.howToRespond),
		CUSTOM_INSTRUCTIONS_MAX_LENGTH,
	);

	await sql`
		UPDATE users
		SET
			custom_instructions_about_you = ${aboutYou},
			custom_instructions_how_to_respond = ${howToRespond},
			updated_at = NOW()
		WHERE id = ${userId}
	`;

	return { aboutYou, howToRespond };
}
