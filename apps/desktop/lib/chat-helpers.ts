/**
 * ─── Shared Chat Helpers ─────────────────────────────────────────────────
 *
 * Validation, session, and message-store helpers shared between the
 * JSON `/api/chat` and the streaming `/api/chat/stream` routes.
 */

import { sql } from "@/lib/db";
import {
	type Attachment,
	ATTACHMENT_LIMITS,
	validateAttachment,
} from "@/lib/attachments";

// ─── Types ─────────────────────────────────────────────────────────────────

export interface ChatMessage {
	role: "user" | "assistant" | "system";
	content: string;
	attachments?: Attachment[];
}

export interface ChatRequestBody {
	messages: ChatMessage[];
	sessionId?: string;
	projectId?: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const ALLOWED_ROLES = ["user", "assistant", "system"] as const;
const MAX_MESSAGES = 40;
const MAX_CHARS_PER_MESSAGE = 8000;
const MAX_ATTACHMENTS = ATTACHMENT_LIMITS.MAX_COUNT;

export function requestLooksLikeDesktop(headers: Headers): boolean {
	const referrer = headers.get("referer") ?? headers.get("referrer") ?? "";
	if (!referrer) return false;

	try {
		const url = new URL(referrer);
		return url.pathname === "/desktop" || url.pathname.startsWith("/desktop/");
	} catch {
		return referrer.includes("/desktop");
	}
}

// ─── Validation ─────────────────────────────────────────────────────────────

/**
 * Validate the request body.
 * Returns null on success, or an error string.
 */
export function validateBody(body: ChatRequestBody): string | null {
	if (!body.messages || !Array.isArray(body.messages)) {
		return "messages array is required";
	}

	if (body.messages.length === 0) {
		return "messages array must not be empty";
	}

	if (body.messages.length > MAX_MESSAGES) {
		return `messages array must not exceed ${MAX_MESSAGES} messages`;
	}

	for (const msg of body.messages) {
		if (typeof msg.content !== "string") {
			return "each message must have a content field";
		}
		if (msg.content.length > MAX_CHARS_PER_MESSAGE) {
			return `each message must not exceed ${MAX_CHARS_PER_MESSAGE} characters`;
		}
		if (!ALLOWED_ROLES.includes(msg.role as any)) {
			return `invalid role '${msg.role}'; allowed: ${ALLOWED_ROLES.join(", ")}`;
		}
		// Validate attachments on user messages
		if (msg.attachments && msg.attachments.length > 0) {
			if (msg.role !== "user") {
				return "only user messages may have attachments";
			}
			if (msg.attachments.length > MAX_ATTACHMENTS) {
				return `each message must not exceed ${MAX_ATTACHMENTS} attachments`;
			}
			for (const att of msg.attachments) {
				const attErr = validateAttachment(att);
				if (attErr) return attErr;
			}
		}
	}

	const lastMsg = body.messages[body.messages.length - 1];
	if (lastMsg.role !== "user") {
		return "last message role must be 'user'";
	}

	return null;
}

// ─── Session helpers ───────────────────────────────────────────────────────

/**
 * getOrCreateSession — returns an existing (non-deleted) session or creates a new one.
 */
export async function getOrCreateSession(
	internalUserId: string,
	sessionId?: string,
	title?: string,
): Promise<{ id: string }> {
	// If a sessionId was provided, try to find it
	if (sessionId) {
		try {
			const rows = (await sql`
        SELECT id FROM chat_sessions
        WHERE id = ${sessionId} AND user_id = ${internalUserId} AND deleted_at IS NULL
      `) as Array<{ id: string }>;
			if (rows.length > 0) {
				return rows[0];
			}
		} catch {
			// Session lookup failed, create new one
		}
	}

	// Create a new session
	const displayTitle = title || "New Chat";
	const rows = (await sql`
    INSERT INTO chat_sessions (user_id, title)
    VALUES (${internalUserId}, ${displayTitle})
    RETURNING id
  `) as Array<{ id: string }>;
	return rows[0];
}

/**
 * storeMessage — inserts a message into chat_messages.
 */
export async function storeMessage(
	sessionId: string,
	role: string,
	content: string,
	tokensIn: number,
	tokensOut: number,
	attachments?: Attachment[],
): Promise<void> {
	try {
		const attachmentsJson =
			attachments && attachments.length > 0
				? JSON.stringify(attachments)
				: "[]";
		await sql`
		INSERT INTO chat_messages (session_id, role, content, tokens_in, tokens_out, attachments)
		VALUES (${sessionId}, ${role}, ${content}, ${tokensIn}, ${tokensOut}, ${attachmentsJson}::jsonb)
	  `;
	} catch (err) {
		console.error("[CHAT] Failed to store message:", err);
	}
}

/**
 * Inject attachment text into provider messages as system messages.
 * Returns the updated messages array.
 */
export function injectAttachmentMessages(
	messages: ChatMessage[],
): ChatMessage[] {
	const result: ChatMessage[] = [];
	for (const msg of messages) {
		result.push(msg);
		if (msg.attachments && msg.attachments.length > 0) {
			for (const att of msg.attachments) {
				const sizeLabel =
					att.size >= 1024
						? `${(att.size / 1024).toFixed(1)} KB`
						: `${att.size} B`;
				const formatted = [
					`Attached file: ${att.filename} (${att.mimeType}, ${sizeLabel})`,
					"```",
					att.extractedText,
					"```",
				].join("\n");
				result.push({
					role: "system",
					content: formatted,
				});
			}
		}
	}
	return result;
}

/**
 * getLastUserMessage — extracts the most recent user message content.
 */
export function getLastUserMessage(messages: ChatMessage[]): string {
	return [...messages].reverse().find((m) => m.role === "user")?.content || "";
}
