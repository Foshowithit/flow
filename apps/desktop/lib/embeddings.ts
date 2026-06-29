/**
 * ─── Gemini Embeddings Client ───────────────────────────────────────────
 *
 * Uses Google Gemini text-embedding-004 model (768 dimensions).
 */

const GEMINI_EMBEDDING_MODEL = "text-embedding-004";
const GEMINI_BASE_URL =
	"https://generativelanguage.googleapis.com/v1beta/models";
const EMBEDDING_DIMENSIONS = 768;

// ─── Helpers ─────────────────────────────────────────────────────────────

function getApiKey(): string {
	const key = process.env.GEMINI_API_KEY;
	if (!key) {
		throw new Error("GEMINI_API_KEY environment variable is not set");
	}
	return key;
}

// ─── Public API ──────────────────────────────────────────────────────────

function buildUrl(model: string, action: string): string {
	const apiKey = getApiKey();
	return `${GEMINI_BASE_URL}/${model}:${action}?key=${apiKey}`;
}

/**
 * embedText — generate an embedding vector for a single text string.
 * Throws if GEMINI_API_KEY is missing or the API returns a non-200 status.
 */
export async function embedText(text: string): Promise<number[]> {
	const url = buildUrl(GEMINI_EMBEDDING_MODEL, "embedContent");

	const response = await fetch(url, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			model: `models/${GEMINI_EMBEDDING_MODEL}`,
			content: { parts: [{ text }] },
		}),
	});

	if (!response.ok) {
		const errorText = await response.text().catch(() => "Unknown error");
		throw new Error(
			`Gemini embedding API returned ${response.status}: ${errorText.slice(0, 200)}`,
		);
	}

	const data = (await response.json()) as {
		embedding?: { values?: number[] };
	};

	if (!data.embedding?.values) {
		throw new Error("Gemini embedding API returned unexpected response shape");
	}

	return data.embedding.values;
}

/**
 * embedTexts — generate embedding vectors for multiple text strings.
 * Uses Gemini batchEmbedContents endpoint.
 * Throws if GEMINI_API_KEY is missing or the API returns a non-200 status.
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
	if (texts.length === 0) return [];
	if (texts.length === 1) return [await embedText(texts[0])];

	const url = buildUrl(GEMINI_EMBEDDING_MODEL, "batchEmbedContents");

	const requests = texts.map((text) => ({
		model: `models/${GEMINI_EMBEDDING_MODEL}`,
		content: { parts: [{ text }] },
	}));

	const response = await fetch(url, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ requests }),
	});

	if (!response.ok) {
		const errorText = await response.text().catch(() => "Unknown error");
		throw new Error(
			`Gemini embedding API returned ${response.status}: ${errorText.slice(0, 200)}`,
		);
	}

	const data = (await response.json()) as {
		embeddings?: Array<{ values?: number[] }>;
	};

	if (!data.embeddings || data.embeddings.length !== texts.length) {
		throw new Error("Gemini embedding API returned unexpected response shape");
	}

	return data.embeddings.map((e) => e.values ?? []);
}
