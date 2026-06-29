/**
 * ─── DeepSeek API Client ───────────────────────────────────────────────────
 *
 * Pricing constants (per million tokens):
 *   DS Flash (deepseek-chat):      $0.14  input, $0.28  output
 *   DS V4 Pro (deepseek-reasoner): $0.435 input, $0.87  output
 *
 * BYOK: If the user has their own DeepSeek API key stored in the api_keys
 * table, that key is used instead of the platform fallback key.  BYOK users
 * are not charged platform cost.
 *
 * OpenCode Go: If OPENCODE_GO_API_KEY is set, the client switches to the
 * OpenCode Go provider (beta).  Base URL becomes https://opencode.ai/zen/go/v1
 * and model names use the OpenCode Go format (deepseek-v4-flash,
 * deepseek-v4-pro).
 */

import { sql } from "@/lib/db";

// ─── Provider Error ───────────────────────────────────────────────────

/**
 * ProviderError — thrown when the external AI provider returns an error.
 * The `type` field lets callers distinguish unavailable / auth / model issues.
 */
export class ProviderError extends Error {
	type: "unavailable" | "auth" | "model" | "rate_limit";
	status?: number;

	constructor(
		message: string,
		type: "unavailable" | "auth" | "model" | "rate_limit",
		status?: number,
	) {
		super(message);
		this.name = "ProviderError";
		this.type = type;
		this.status = status;
	}
}
// ─── OpenCode Go detection ────────────────────────────────────────────

/**
 * isOpenCodeGoEnabled — returns true if OPENCODE_GO_API_KEY is set.
 */
export function isOpenCodeGoEnabled(): boolean {
	return !!process.env.OPENCODE_GO_API_KEY;
}


export function hasConfiguredProviderKey(): boolean {
	return Boolean(process.env.OPENCODE_GO_API_KEY || process.env.DEEPSEEK_API_KEY);
}

export async function hasProviderAccess(userId: string): Promise<boolean> {
	if (hasConfiguredProviderKey()) return true;
	return (await getUserApiKey(userId)) !== null;
}

export function getMissingProviderMessage(): string {
	return (
		"No AI provider key is configured. Set DEEPSEEK_API_KEY or " +
		"OPENCODE_GO_API_KEY, or sign in with BYOK. For local development, " +
		"configure DEEPSEEK_API_KEY or OPENCODE_GO_API_KEY."
	);
}

/**
 * getProviderBaseUrl — returns the base URL for the active provider.
 */
function getProviderBaseUrl(): string {
	if (isOpenCodeGoEnabled()) {
		return "https://opencode.ai/zen/go/v1";
	}
	return process.env.DEEPSEEK_BASE_URL || DEFAULT_BASE_URL;
}

// ─── Pricing ───────────────────────────────────────────────────────────────

export const PRICING = {
	"deepseek-chat": {
		inputPerM: 0.14, // $0.14 per 1M input tokens
		outputPerM: 0.28, // $0.28 per 1M output tokens
	},
	"deepseek-reasoner": {
		inputPerM: 0.435, // $0.435 per 1M input tokens
		outputPerM: 0.87, // $0.87 per 1M output tokens
	},
	// OpenCode Go models (beta — cost tracked separately / unknown)
	"deepseek-v4-flash": {
		inputPerM: 0,
		outputPerM: 0,
	},
	"deepseek-v4-pro": {
		inputPerM: 0,
		outputPerM: 0,
	},
} as const;

const DEFAULT_BASE_URL = "https://api.deepseek.com/v1";

export interface ChatMessage {
	role: "system" | "user" | "assistant";
	content: string;
}

export interface ChatCompletionResult {
	content: string;
	model: string;
	tokensIn: number;
	tokensOut: number;
	costCents: number;
}

// ─── BYOK lookup ───────────────────────────────────────────────────────────

/**
 * getUserApiKey — checks the api_keys table for an active DeepSeek key.
 * Returns the key value or null.
 *
 * NOTE: In the current schema the key is stored in `key_hash`.  For the MVP
 * this is treated as the raw key.  A production system would encrypt it.
 */
async function getUserApiKey(userId: string): Promise<string | null> {
	try {
		const rows = (await sql`
      SELECT key_hash FROM api_keys
      WHERE user_id = ${userId}
        AND provider = 'deepseek'
        AND is_active = true
      ORDER BY created_at DESC
      LIMIT 1
    `) as Array<{ key_hash: string }>;
		return rows.length > 0 ? rows[0].key_hash : null;
	} catch {
		return null;
	}
}

// ─── Token estimation ──────────────────────────────────────────────────────

/**
 * estimateTokens — rough token count based on text length.
 * ~4 chars per token on average for English text.
 */
export function estimateTokens(text: string): number {
	return Math.ceil(text.length / 4);
}

// ─── Cost calculation ──────────────────────────────────────────────────────

/**
 * computeCostCents — calculates cost in cents for a given model and token usage.
 */
export function computeCostCents(
	model: string,
	tokensIn: number,
	tokensOut: number,
): number {
	const pricing = (PRICING as any)[model];
	if (!pricing) return 0;
	const costIn = (tokensIn / 1_000_000) * pricing.inputPerM;
	const costOut = (tokensOut / 1_000_000) * pricing.outputPerM;
	return Math.ceil((costIn + costOut) * 100);
}

// ─── Chat Completion ───────────────────────────────────────────────────────

/**
 * chatCompletion — calls the DeepSeek chat completion API.
 *
 * Always uses streaming internally to get real-time SSE chunks.  After the
 * stream is consumed, the full content and token usage are returned.
 *
 * @param userId  Internal user UUID (from users table).
 * @param messages  Chat messages to send.
 * @param model  DeepSeek model name (deepseek-chat or deepseek-reasoner).
 * @param _stream  Reserved; streaming is always used internally.
 * @returns  ChatCompletionResult with content, tokens, and cost.
 */
export async function chatCompletion(
	userId: string,
	messages: ChatMessage[],
	model: string,
	_stream: boolean = true,
): Promise<ChatCompletionResult> {
	// Resolve API key (BYOK first, then platform fallback)
	let apiKey = await getUserApiKey(userId);
	const usingByok = apiKey !== null;

	if (!apiKey) {
		throw new ProviderError(getMissingProviderMessage(), "auth", 400);
	}

	const baseUrl = getProviderBaseUrl();

	const url = `${baseUrl}/chat/completions`;

	const requestBody: Record<string, unknown> = {
		model,
		messages: messages.map((m) => ({ role: m.role, content: m.content })),
		stream: true,
		stream_options: { include_usage: true },
	};

	// ── Execute request ───────────────────────────────────────────────
	let response: Response;
	try {
		response = await fetch(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${apiKey}`,
			},
			body: JSON.stringify(requestBody),
		});
	} catch (fetchErr) {
		const msg =
			fetchErr instanceof Error ? fetchErr.message : "Unknown network error";
		console.error(`[DeepSeek] Network error: ${msg}`);
		throw new ProviderError(
			"Provider unavailable: network error",
			"unavailable",
		);
	}

	if (!response.ok) {
		const errorText = await response.text().catch(() => "Unknown error");
		const status = response.status;
		let type: "unavailable" | "auth" | "model" | "rate_limit";
		if (status === 401 || status === 403) {
			type = "auth";
		} else if (status === 404) {
			type = "model";
		} else if (status === 400 || status === 422) {
			type = "model";
		} else if (status === 429) {
			type = "rate_limit";
		} else {
			type = "unavailable";
		}
		console.error(
			`[DeepSeek] Provider error: ${status} — ${errorText.slice(0, 200)}`,
		);
		throw new ProviderError(`Provider responded with ${status}`, type, status);
	}

	if (!response.body) {
		console.error("[DeepSeek] Response body is null");
		throw new ProviderError("Provider response body is null", "unavailable");
	}

	// ── Parse SSE stream ────────────────────────────────────────────────

	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	let buffer = "";
	let fullContent = "";
	let tokensIn = 0;
	let tokensOut = 0;

	while (true) {
		const { done, value } = await reader.read();
		if (done) break;

		buffer += decoder.decode(value, { stream: true });

		// Process complete SSE lines
		const lines = buffer.split("\n");
		buffer = lines.pop() || ""; // Keep incomplete line in buffer

		for (const line of lines) {
			const trimmed = line.trim();

			// Skip empty lines and comments
			if (!trimmed || trimmed.startsWith(":")) continue;

			// data: [DONE]
			if (trimmed === "data: [DONE]") continue;

			// data: {...}
			if (trimmed.startsWith("data: ")) {
				try {
					const jsonStr = trimmed.slice(6);
					const chunk = JSON.parse(jsonStr);

					// Usage info in the final chunk (when include_usage is set)
					if (chunk.usage) {
						tokensIn = chunk.usage.prompt_tokens || tokensIn;
						tokensOut = chunk.usage.completion_tokens || tokensOut;
					}

					// Content delta
					const delta = chunk.choices?.[0]?.delta;
					if (delta?.content) {
						fullContent += delta.content;
					}
				} catch {
					// Skip malformed JSON chunks
				}
			}
		}
	}

	// If the API didn't return usage info, estimate from text
	if (tokensIn === 0 && messages.length > 0) {
		const inputText = messages.map((m) => m.content).join(" ");
		tokensIn = estimateTokens(inputText);
	}
	if (tokensOut === 0 && fullContent.length > 0) {
		tokensOut = estimateTokens(fullContent);
	}

	const costCents = usingByok
		? 0
		: computeCostCents(model, tokensIn, tokensOut);

	return {
		content: fullContent,
		model,
		tokensIn,
		tokensOut,
		costCents,
	};
}

// ─── Streaming Chat Completion ────────────────────────────────────────

/**
 * StreamEvent — events yielded by chatCompletionStream.
 */
export type StreamEvent =
	| { type: "delta"; content: string }
	| { type: "result"; result: ChatCompletionResult };

/**
 * chatCompletionStream — streaming variant of chatCompletion.
 *
 * Yields `delta` events with incremental content, then a final `result` event
 * with full metadata (content, usage, costCents, model).
 * Throws ProviderError on provider/network errors.
 */
export async function* chatCompletionStream(
	userId: string,
	messages: ChatMessage[],
	model: string,
): AsyncGenerator<StreamEvent, void, void> {
	// Resolve API key (BYOK first, then platform fallback)
	let apiKey = await getUserApiKey(userId);
	const usingByok = apiKey !== null;

	if (!apiKey) {
		throw new ProviderError(getMissingProviderMessage(), "auth", 400);
	}

	const baseUrl = getProviderBaseUrl();
	const url = `${baseUrl}/chat/completions`;

	const requestBody: Record<string, unknown> = {
		model,
		messages: messages.map((m) => ({ role: m.role, content: m.content })),
		stream: true,
		stream_options: { include_usage: true },
	};

	// ── Execute request ───────────────────────────────────────────────
	let response: Response;
	try {
		response = await fetch(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${apiKey}`,
			},
			body: JSON.stringify(requestBody),
		});
	} catch (fetchErr) {
		const msg =
			fetchErr instanceof Error ? fetchErr.message : "Unknown network error";
		console.error(`[DeepSeek] Network error: ${msg}`);
		throw new ProviderError(
			"Provider unavailable: network error",
			"unavailable",
		);
	}

	if (!response.ok) {
		const errorText = await response.text().catch(() => "Unknown error");
		const status = response.status;
		let type: "unavailable" | "auth" | "model" | "rate_limit";
		if (status === 401 || status === 403) {
			type = "auth";
		} else if (status === 404) {
			type = "model";
		} else if (status === 400 || status === 422) {
			type = "model";
		} else if (status === 429) {
			type = "rate_limit";
		} else {
			type = "unavailable";
		}
		console.error(
			`[DeepSeek] Provider error: ${status} — ${errorText.slice(0, 200)}`,
		);
		throw new ProviderError(`Provider responded with ${status}`, type, status);
	}

	if (!response.body) {
		console.error("[DeepSeek] Response body is null");
		throw new ProviderError("Provider response body is null", "unavailable");
	}

	// ── Parse SSE stream ────────────────────────────────────────────────
	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	let buffer = "";
	let fullContent = "";
	let tokensIn = 0;
	let tokensOut = 0;

	while (true) {
		const { done, value } = await reader.read();
		if (done) break;

		buffer += decoder.decode(value, { stream: true });

		// Process complete SSE lines
		const lines = buffer.split("\n");
		buffer = lines.pop() || ""; // Keep incomplete line in buffer

		for (const line of lines) {
			const trimmed = line.trim();

			// Skip empty lines and comments
			if (!trimmed || trimmed.startsWith(":")) continue;

			// data: [DONE]
			if (trimmed === "data: [DONE]") continue;

			// data: {...}
			if (trimmed.startsWith("data: ")) {
				try {
					const jsonStr = trimmed.slice(6);
					const chunk = JSON.parse(jsonStr);

					// Usage info in the final chunk (when include_usage is set)
					if (chunk.usage) {
						tokensIn = chunk.usage.prompt_tokens || tokensIn;
						tokensOut = chunk.usage.completion_tokens || tokensOut;
					}

					// Content delta
					const delta = chunk.choices?.[0]?.delta;
					if (delta?.content) {
						fullContent += delta.content;
						yield { type: "delta", content: delta.content };
					}
				} catch {
					// Skip malformed JSON chunks
				}
			}
		}
	}

	// If the API didn't return usage info, estimate from text
	if (tokensIn === 0 && messages.length > 0) {
		const inputText = messages.map((m) => m.content).join(" ");
		tokensIn = estimateTokens(inputText);
	}
	if (tokensOut === 0 && fullContent.length > 0) {
		tokensOut = estimateTokens(fullContent);
	}

	const costCents = usingByok
		? 0
		: computeCostCents(model, tokensIn, tokensOut);

	yield {
		type: "result",
		result: {
			content: fullContent,
			model,
			tokensIn,
			tokensOut,
			costCents,
		},
	};
}
