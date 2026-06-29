/**
 * ─── Flow Memory v2: Cross-session Memory + Projects ─────────────────────
 *
 * Best-effort memory extraction and retrieval using embeddings and vector
 * search (pgvector).  All functions are wrapped in try/catch and never throw
 * to their callers; errors are logged with console.error.
 *
 * Dependencies:
 *   - lib/db.ts          (Neon SQL client)
 *   - lib/deepseek.ts    (DeepSeek chat completion for extraction)
 *   - lib/embeddings.ts  (OpenAI embedding)
 */

import { sql } from "@/lib/db";
import { chatCompletion } from "@/lib/deepseek";
import { embedText } from "@/lib/embeddings";

// ─── Constants ───────────────────────────────────────────────────────────

/** Number of recent messages to consider for extraction. */
const EXTRACTION_MESSAGE_LIMIT = 20;

/** Default limit for vector search results. */
const DEFAULT_VECTOR_LIMIT = 8;

/** Max tokens per chunk for chunkText. */
const DEFAULT_CHUNK_MAX_TOKENS = 500;

/** Overlap tokens between adjacent chunks. */
const DEFAULT_CHUNK_OVERLAP_TOKENS = 50;

// ─── Types ───────────────────────────────────────────────────────────────

export interface MemoryFact {
	content: string;
	category: string;
	importance: number;
}

export interface RelevantMemory {
	content: string;
	category: string;
	importance: number;
	similarity: number;
}

export interface VectorSearchOptions {
	limit?: number;
	category?: string;
	projectId?: string;
	threshold?: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// EXTRACT MEMORY FACTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * extractMemoryFacts — fire-and-forget memory extraction after a chat
 * response.  Checks chat_session_extractions for last extraction progress;
 * if no new messages, skips.  Fetches the last 20 messages, calls the LLM
 * to extract discrete facts, generates embeddings, and stores them in the
 * memories table (and optionally project_memories).
 *
 * ALL errors are caught and logged — never throws.
 */
export async function extractMemoryFacts(
	userId: string,
	sessionId: string,
	_messages: any[],
	activeProjectId?: string,
): Promise<void> {
	try {
		// 1. Count messages in this session
		const countRows = (await sql`
      SELECT COUNT(*)::int AS cnt
      FROM chat_messages cm
      JOIN chat_sessions cs ON cs.id = cm.session_id
      WHERE cm.session_id = ${sessionId}
        AND cs.user_id = ${userId}
        AND cs.deleted_at IS NULL
    `) as Array<{ cnt: number }>;

		const currentCount = countRows[0]?.cnt ?? 0;
		if (currentCount === 0) return;

		// 2. Check last extraction progress
		const extractionRows = (await sql`
      SELECT last_message_count FROM chat_session_extractions
      WHERE user_id = ${userId} AND session_id = ${sessionId}
    `) as Array<{ last_message_count: number }>;

		const lastExtracted =
			extractionRows.length > 0 ? extractionRows[0].last_message_count : 0;
		if (currentCount <= lastExtracted) return; // No new messages

		// 3. Fetch last N messages for extraction
		const msgRows = (await sql`
      SELECT cm.role, cm.content
      FROM chat_messages cm
      JOIN chat_sessions cs ON cs.id = cm.session_id
      WHERE cm.session_id = ${sessionId}
        AND cs.user_id = ${userId}
        AND cs.deleted_at IS NULL
      ORDER BY cm.created_at ASC
      LIMIT ${EXTRACTION_MESSAGE_LIMIT}
    `) as Array<{ role: string; content: string }>;

		if (msgRows.length === 0) return;

		// 4. Get existing session summary for context
		let existingSummary = "";
		try {
			const summaryRows = (await sql`
        SELECT summary FROM chat_session_summaries
        WHERE user_id = ${userId} AND session_id = ${sessionId}
      `) as Array<{ summary: string }>;
			if (summaryRows.length > 0) {
				existingSummary = summaryRows[0].summary;
			}
		} catch {
			// Non-critical
		}

		// 5. Call LLM to extract facts
		const facts = await extractFactsFromMessages(msgRows, existingSummary);
		if (facts.length === 0) return;

		// 6. For each fact: generate embedding, insert into memories
		for (const fact of facts) {
			try {
				const embedding = await embedText(fact.content);
				const embeddingStr = vectorToString(embedding);

				await sql`
          INSERT INTO memories
            (user_id, content, category, importance, embedding, source_session_id)
          VALUES
            (${userId}, ${fact.content}, ${fact.category}, ${fact.importance}, ${embeddingStr}::vector, ${sessionId})
        `;

				// Also insert into project_memories if activeProjectId is set
				if (activeProjectId) {
					await sql`
            INSERT INTO project_memories
              (project_id, content, category, importance, embedding, source_session_id)
            VALUES
              (${activeProjectId}, ${fact.content}, ${fact.category}, ${fact.importance}, ${embeddingStr}::vector, ${sessionId})
          `;
				}
			} catch (innerErr) {
				console.error("[MEMORY-V2] Failed to store fact:", innerErr);
			}
		}

		// 7. Update extraction progress
		try {
			await sql`
        INSERT INTO chat_session_extractions
          (user_id, session_id, last_message_count)
        VALUES
          (${userId}, ${sessionId}, ${currentCount})
        ON CONFLICT (session_id) DO UPDATE SET
          last_message_count = EXCLUDED.last_message_count,
          updated_at = NOW()
      `;
		} catch (upsertErr) {
			console.error(
				"[MEMORY-V2] Failed to update extraction progress:",
				upsertErr,
			);
		}

		console.log(
			`[MEMORY-V2] Extracted ${facts.length} facts from session ${sessionId.slice(0, 8)}…`,
		);
	} catch (err) {
		console.error("[MEMORY-V2] extractMemoryFacts error:", err);
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// GET RELEVANT MEMORIES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * getRelevantMemories — vector search across the memories table using the
 * query embedding (cosine distance).  Returns a formatted system-message
 * string, or null if embedding fails or no results are found.
 *
 * Options:
 *   limit     — max results (default 8)
 *   category  — filter by category
 *   projectId — if set, search project_memories instead of memories
 *   threshold — minimum similarity (currently informational)
 */
export async function getRelevantMemories(
	userId: string,
	query: string,
	options?: VectorSearchOptions,
): Promise<string | null> {
	try {
		const limit = options?.limit ?? DEFAULT_VECTOR_LIMIT;
		const category = options?.category;
		const projectId = options?.projectId;

		// Generate embedding for the query
		let embedding: number[];
		try {
			embedding = await embedText(query);
		} catch {
			console.error("[MEMORY-V2] getRelevantMemories: embedding failed");
			return null;
		}

		const embeddingStr = vectorToString(embedding);

		let rows: Array<{
			content: string;
			category: string;
			importance: number;
			similarity: number;
		}>;

		if (projectId) {
			// Search project_memories
			const filter = category
				? sql`AND category = ${category} AND project_id = ${projectId}`
				: sql`AND project_id = ${projectId}`;

			rows = (await sql`
        SELECT content, category, importance,
          1 - (embedding <=> ${embeddingStr}::vector) AS similarity
        FROM project_memories
        WHERE embedding IS NOT NULL
          ${filter}
        ORDER BY embedding <=> ${embeddingStr}::vector
        LIMIT ${limit}
      `) as Array<{
				content: string;
				category: string;
				importance: number;
				similarity: number;
			}>;
		} else {
			// Search memories
			const filter = category
				? sql`AND category = ${category} AND user_id = ${userId}`
				: sql`AND user_id = ${userId}`;

			rows = (await sql`
        SELECT content, category, importance,
          1 - (embedding <=> ${embeddingStr}::vector) AS similarity
        FROM memories
        WHERE embedding IS NOT NULL
          ${filter}
        ORDER BY embedding <=> ${embeddingStr}::vector
        LIMIT ${limit}
      `) as Array<{
				content: string;
				category: string;
				importance: number;
				similarity: number;
			}>;
		}

		if (!rows || rows.length === 0) return null;

		// Format as system message
		const parts = rows.map(
			(r, i) =>
				`${i + 1}. [${r.category}] (importance: ${r.importance}) ${r.content}`,
		);

		return `Relevant memories from past conversations:\n${parts.join("\n")}`;
	} catch (err) {
		console.error("[MEMORY-V2] getRelevantMemories error:", err);
		return null;
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// GET PROJECT CONTEXT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * getProjectContext — fetches project instructions, vector searches project
 * knowledge chunks and project memories.  Returns formatted strings for each
 * section, or null if the project does not exist.
 *
 * If embedding fails, knowledge and memories sections fall back to empty
 * strings.
 */
export async function getProjectContext(
	projectId: string,
	query: string,
): Promise<{
	instructions: string;
	knowledge: string;
	memories: string;
} | null> {
	try {
		// 1. Fetch project instructions
		const projectRows = (await sql`
      SELECT name, description, instructions FROM projects
      WHERE id = ${projectId}
    `) as Array<{
			name: string;
			description: string | null;
			instructions: string | null;
		}>;

		if (projectRows.length === 0) return null;

		const project = projectRows[0];
		const instructions = [
			project.instructions
				? `Project instructions: ${project.instructions}`
				: "",
			project.description ? `Project description: ${project.description}` : "",
		]
			.filter(Boolean)
			.join("\n");

		// Default empty sections
		let knowledge = "";
		let memories = "";

		// 2. Vector search project_knowledge_chunks
		try {
			const embedding = await embedText(query);
			const embeddingStr = vectorToString(embedding);

			const knowledgeRows = (await sql`
        SELECT content, 1 - (embedding <=> ${embeddingStr}::vector) AS similarity
        FROM project_knowledge_chunks
        WHERE project_id = ${projectId}
          AND embedding IS NOT NULL
        ORDER BY embedding <=> ${embeddingStr}::vector
        LIMIT 5
      `) as Array<{ content: string; similarity: number }>;

			if (knowledgeRows && knowledgeRows.length > 0) {
				knowledge = knowledgeRows
					.map((r, i) => `${i + 1}. ${r.content}`)
					.join("\n");
			}
		} catch {
			// Embedding failed — leave knowledge empty
		}

		// 3. Vector search project_memories
		try {
			const embedding = await embedText(query);
			const embeddingStr = vectorToString(embedding);

			const memoryRows = (await sql`
        SELECT content, category, importance,
          1 - (embedding <=> ${embeddingStr}::vector) AS similarity
        FROM project_memories
        WHERE project_id = ${projectId}
          AND embedding IS NOT NULL
        ORDER BY embedding <=> ${embeddingStr}::vector
        LIMIT 5
      `) as Array<{
				content: string;
				category: string;
				importance: number;
				similarity: number;
			}>;

			if (memoryRows && memoryRows.length > 0) {
				memories = memoryRows
					.map(
						(r, i) =>
							`${i + 1}. [${r.category}] (importance: ${r.importance}) ${r.content}`,
					)
					.join("\n");
			}
		} catch {
			// Embedding failed — leave memories empty
		}

		return { instructions, knowledge, memories };
	} catch (err) {
		console.error("[MEMORY-V2] getProjectContext error:", err);
		return null;
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// CHUNK TEXT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * chunkText — simple token-aware text chunking.
 *
 * Splits text into chunks of approximately `maxTokens` tokens with ~50 token
 * overlap between adjacent chunks.  Token count is approximated as
 * `text.length / 4` (rough heuristic for English).
 *
 * Returns an array of chunk strings.  If the text fits within maxTokens, a
 * single-element array is returned.
 */
export function chunkText(text: string, maxTokens?: number): string[] {
	const maxTk = maxTokens ?? DEFAULT_CHUNK_MAX_TOKENS;
	const overlapTk = DEFAULT_CHUNK_OVERLAP_TOKENS;
	const maxChars = maxTk * 4;
	const overlapChars = overlapTk * 4;

	if (text.length <= maxChars) {
		return [text];
	}

	const chunks: string[] = [];
	let startPos = 0;

	while (startPos < text.length) {
		let endPos = Math.min(startPos + maxChars, text.length);

		// Try to break at a sentence boundary (within look-ahead window)
		if (endPos < text.length) {
			const afterEnd = text.slice(endPos, endPos + 80);
			const sentenceBreak = afterEnd.search(/[.!?]\s/);
			if (sentenceBreak >= 0 && sentenceBreak < 40) {
				endPos = endPos + sentenceBreak + 1; // Include punctuation and space
			} else {
				// Fall back to word boundary
				const beforeEnd = text.slice(Math.max(0, endPos - 30), endPos);
				const lastSpace = beforeEnd.lastIndexOf(" ");
				if (lastSpace >= 0) {
					endPos = endPos - (30 - lastSpace);
				}
			}
		}

		chunks.push(text.slice(startPos, endPos).trim());

		// Advance start position with overlap
		const nextStart = endPos - overlapChars;
		if (nextStart <= startPos) {
			// Avoid infinite loop — force progress
			startPos = endPos;
		} else {
			startPos = nextStart;
		}
	}

	return chunks.filter((c) => c.length > 0);
}

// ═══════════════════════════════════════════════════════════════════════════
// INTERNAL HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * vectorToString — converts a number array to a PostgreSQL vector literal
 * string (e.g. "[0.1,0.2,0.3]").
 */
function vectorToString(v: number[]): string {
	return `[${v.join(",")}]`;
}

/**
 * extractFactsFromMessages — calls the LLM to extract discrete memory facts
 * from a set of chat messages.
 */
async function extractFactsFromMessages(
	messages: Array<{ role: string; content: string }>,
	existingSummary: string,
): Promise<MemoryFact[]> {
	try {
		const conversationText = messages
			.map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
			.join("\n\n");

		const systemPrompt = `You are a memory extraction system. Extract discrete facts from this conversation that the AI should remember across conversations.

Output a JSON array of objects. Each object must have 'content', 'category', and 'importance' fields.

Categories: preference, fact, goal, personal_info, constraint, general.
Importance: 1-5 (5 = most important).

Rules:
- Be specific and factual
- Only extract information that would be useful across conversations
- Do not include conversational filler or greetings
- If no new facts are found, return an empty array
- Respond with ONLY the JSON array, no other text`;

		const userMessage = existingSummary
			? `Existing session summary: ${existingSummary}\n\nConversation:\n${conversationText}`
			: `Conversation:\n${conversationText}`;

		const result = await chatCompletion(
			"__memory_v2_system__",
			[
				{ role: "system", content: systemPrompt },
				{ role: "user", content: userMessage },
			],
			"deepseek-chat",
			false,
		);

		const raw = result.content.trim();
		// Parse JSON from the response
		const jsonStart = raw.indexOf("[");
		const jsonEnd = raw.lastIndexOf("]");
		if (jsonStart === -1 || jsonEnd === -1) {
			console.warn(
				"[MEMORY-V2] No JSON array found in LLM response:",
				raw.slice(0, 200),
			);
			return [];
		}

		const jsonStr = raw.slice(jsonStart, jsonEnd + 1);
		const parsed = JSON.parse(jsonStr) as Array<{
			content?: string;
			category?: string;
			importance?: number;
		}>;

		if (!Array.isArray(parsed)) return [];

		return parsed
			.filter((f) => f.content && typeof f.content === "string")
			.map((f) => ({
				content: f.content!.trim(),
				category: VALID_CATEGORIES.includes(f.category ?? "")
					? f.category!
					: "general",
				importance:
					typeof f.importance === "number" ? clamp(f.importance, 1, 5) : 3,
			}));
	} catch (err) {
		console.error("[MEMORY-V2] extractFactsFromMessages error:", err);
		return [];
	}
}

/** Valid categories for memory facts. */
const VALID_CATEGORIES = [
	"preference",
	"fact",
	"goal",
	"personal_info",
	"constraint",
	"general",
];

/** Clamp a number to the given range. */
function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}
