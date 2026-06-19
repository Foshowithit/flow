/**
 * ─── Flow Memory v1: per-session summaries ─────────────────────────────
 *
 * Best-effort memory that captures conversational context (user goals,
 * preferences, key decisions, open tasks, important constraints) as a
 * concise summary.  Injected into future chat calls for continuity.
 *
 * Memory is always scoped by internal user_id + session_id — no cross-user
 * leakage.  Failures are logged server-side only and never block chat.
 */

import { sql } from "@/lib/db";
import { chatCompletion } from "@/lib/deepseek";

// ─── Thresholds ────────────────────────────────────────────────────────

/** Minimum messages before a summary is generated. */
const MIN_MESSAGES_FOR_SUMMARY = 8;

/**
 * Staleness tolerance — if the existing summary's message_count is within
 * this many messages of the current count, skip regeneration.
 */
const STALE_MESSAGE_DELTA = 6;

/** Max messages to fetch for summary generation. */
const MAX_SUMMARY_MESSAGES = 40;

// ─── Public API ────────────────────────────────────────────────────────

/**
 * getSessionSummaryContext — fetch the summary for an owned session.
 *
 * Returns the summary text, or null if no summary exists / access denied.
 */
export async function getSessionSummaryContext(
	userId: string,
	sessionId: string,
): Promise<string | null> {
	try {
		const rows = (await sql`
			SELECT summary FROM chat_session_summaries
			WHERE user_id = ${userId} AND session_id = ${sessionId}
		`) as Array<{ summary: string }>;

		return rows.length > 0 ? rows[0].summary : null;
	} catch (err) {
		console.error("[MEMORY] getSessionSummaryContext error:", err);
		return null;
	}
}

/**
 * maybeUpdateSessionSummary — best-effort generation / refresh of the
 * session summary.  Never throws.
 *
 * Conditions:
 *  1. Session must have at least MIN_MESSAGES_FOR_SUMMARY messages.
 *  2. Existing summary must be stale by at least STALE_MESSAGE_DELTA
 *     messages (or not exist).
 *  3. Only messages owned by this user are considered.
 */
export async function maybeUpdateSessionSummary(
	userId: string,
	sessionId: string,
): Promise<void> {
	try {
		// 1. Count owned messages in session
		const countRows = (await sql`
			SELECT COUNT(*)::int AS cnt
			FROM chat_messages cm
			JOIN chat_sessions cs ON cs.id = cm.session_id
			WHERE cm.session_id = ${sessionId}
			  AND cs.user_id = ${userId}
			  AND cs.deleted_at IS NULL
		`) as Array<{ cnt: number }>;

		const messageCount = countRows[0]?.cnt ?? 0;
		if (messageCount < MIN_MESSAGES_FOR_SUMMARY) {
			return; // Not enough messages yet
		}

		// 2. Check existing summary staleness
		const existingRows = (await sql`
			SELECT message_count FROM chat_session_summaries
			WHERE user_id = ${userId} AND session_id = ${sessionId}
		`) as Array<{ message_count: number }>;

		if (existingRows.length > 0) {
			const existingCount = existingRows[0].message_count;
			if (Math.abs(messageCount - existingCount) < STALE_MESSAGE_DELTA) {
				// Summary is up to date enough
				return;
			}
		}

		// 3. Fetch recent messages for summary generation
		const msgRows = (await sql`
			SELECT cm.role, cm.content
			FROM chat_messages cm
			JOIN chat_sessions cs ON cs.id = cm.session_id
			WHERE cm.session_id = ${sessionId}
			  AND cs.user_id = ${userId}
			  AND cs.deleted_at IS NULL
			ORDER BY cm.created_at ASC
			LIMIT ${MAX_SUMMARY_MESSAGES}
		`) as Array<{ role: string; content: string }>;

		if (msgRows.length === 0) {
			return;
		}

		// 4. Generate summary using the AI model directly
		const summary = await generateSummary(msgRows);

		// 5. Find the last message id for reference
		const lastMsgRows = (await sql`
			SELECT id FROM chat_messages
			WHERE session_id = ${sessionId}
			ORDER BY created_at DESC
			LIMIT 1
		`) as Array<{ id: string }>;

		const lastMessageId = lastMsgRows.length > 0 ? lastMsgRows[0].id : null;

		// 6. Upsert the summary
		const model = "deepseek-v4-flash";
		await sql`
			INSERT INTO chat_session_summaries
				(user_id, session_id, summary, last_message_id, message_count, model, updated_at)
			VALUES
				(${userId}, ${sessionId}, ${summary}, ${lastMessageId}, ${messageCount}, ${model}, NOW())
			ON CONFLICT (session_id) DO UPDATE SET
				summary         = EXCLUDED.summary,
				last_message_id = EXCLUDED.last_message_id,
				message_count   = EXCLUDED.message_count,
				model           = EXCLUDED.model,
				updated_at      = NOW()
		`;

		console.log(
			`[MEMORY] Summary updated for session ${sessionId.slice(0, 8)}… ` +
				`(${messageCount} messages)`,
		);
	} catch (err) {
		// Best-effort only — never throw to caller
		console.error("[MEMORY] maybeUpdateSessionSummary error:", err);
	}
}

// ─── Internal Helpers ──────────────────────────────────────────────────

/**
 * generateSummary — calls the AI model to produce a concise summary of
 * the conversation so far.  Uses a direct `chatCompletion` call with the
 * same model (deepseek-v4-flash) to avoid recursive loops.
 */
async function generateSummary(
	messages: Array<{ role: string; content: string }>,
): Promise<string> {
	// Build a condensed prompt with the conversation history
	const conversationText = messages
		.map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
		.join("\n\n");

	const systemPrompt = `You are a memory summarizer. Your job is to produce a very concise summary of the conversation so far.

Capture:
- User's goals and objectives
- Key preferences or constraints
- Important decisions made
- Open tasks or unresolved questions
- Any specific data, names, or context the user has shared

Keep the summary to 2-4 sentences. Be factual and specific. Do not make up information.
Do not include sensitive speculation or personal opinions.`;

	const summaryMessages: Array<{
		role: "system" | "user" | "assistant";
		content: string;
	}> = [
		{ role: "system", content: systemPrompt },
		{
			role: "user",
			content: `Summarize this conversation:\n\n${conversationText}`,
		},
	];

	try {
		const result = await chatCompletion(
			"__memory_system__", // system-internal ID; no actual user
			summaryMessages,
			"deepseek-chat", // internal model name, resolves via router
			true,
		);

		return result.content.trim() || "Conversation summary not available.";
	} catch (err) {
		console.error("[MEMORY] generateSummary AI call failed:", err);
		return "Conversation summary not available.";
	}
}
