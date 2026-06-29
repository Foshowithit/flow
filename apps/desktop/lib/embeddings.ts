/**
 * ─── OpenAI Embeddings Client ─────────────────────────────────────────────
 *
 * Uses OpenAI text-embedding-3-small model (1536 dimensions).
 */

const OPENAI_EMBEDDING_MODEL = "text-embedding-3-small";
const OPENAI_EMBEDDING_URL = "https://api.openai.com/v1/embeddings";

// ─── Helpers ─────────────────────────────────────────────────────────────

function getApiKey(): string {
	const key = process.env.OPENAI_API_KEY;
	if (!key) {
		throw new Error("OPENAI_API_KEY environment variable is not set");
	}
	return key;
}

// ─── Public API ──────────────────────────────────────────────────────────

/**
 * embedText — generate an embedding vector for a single text string.
 * Throws if OPENAI_API_KEY is missing or the API returns a non-200 status.
 */
export async function embedText(text: string): Promise<number[]> {
	const apiKey = getApiKey();

	const response = await fetch(OPENAI_EMBEDDING_URL, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${apiKey}`,
		},
		body: JSON.stringify({
			model: OPENAI_EMBEDDING_MODEL,
			input: text,
		}),
	});

	if (!response.ok) {
		const errorText = await response.text().catch(() => "Unknown error");
		throw new Error(
			`OpenAI embedding API returned ${response.status}: ${errorText.slice(0, 200)}`,
		);
	}

	const data = (await response.json()) as {
		data: Array<{ embedding: number[] }>;
	};

	if (!data.data?.[0]?.embedding) {
		throw new Error("OpenAI embedding API returned unexpected response shape");
	}

	return data.data[0].embedding;
}

/**
 * embedTexts — generate embedding vectors for multiple text strings.
 * Throws if OPENAI_API_KEY is missing or the API returns a non-200 status.
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
	if (texts.length === 0) return [];

	const apiKey = getApiKey();

	const response = await fetch(OPENAI_EMBEDDING_URL, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${apiKey}`,
		},
		body: JSON.stringify({
			model: OPENAI_EMBEDDING_MODEL,
			input: texts,
		}),
	});

	if (!response.ok) {
		const errorText = await response.text().catch(() => "Unknown error");
		throw new Error(
			`OpenAI embedding API returned ${response.status}: ${errorText.slice(0, 200)}`,
		);
	}

	const data = (await response.json()) as {
		data: Array<{ embedding: number[] }>;
	};

	if (!data.data || data.data.length !== texts.length) {
		throw new Error("OpenAI embedding API returned unexpected response shape");
	}

	return data.data.map((d) => d.embedding);
}
