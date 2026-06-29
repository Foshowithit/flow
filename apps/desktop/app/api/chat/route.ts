import { type NextRequest, NextResponse } from "next/server";
import { getCurrentInternalUser } from "@/lib/auth-user";
import { routeModel } from "@/lib/router";
import { chatCompletion, ProviderError } from "@/lib/deepseek";
import { checkUsage, recordUsage } from "@/lib/usage";
import {
	getSessionSummaryContext,
	maybeUpdateSessionSummary,
} from "@/lib/memory";
import {
	getProjectContext,
	getRelevantMemories,
	extractMemoryFacts,
} from "@/lib/memory-v2";
import {
	type ChatMessage,
	type ChatRequestBody,
	validateBody,
	getOrCreateSession,
	storeMessage,
	injectAttachmentMessages,
} from "@/lib/chat-helpers";
import {
	getUserInstructions,
	formatUserInstructionsForSystemMessage,
} from "@/lib/user-instructions";

// ─── Route Handler ─────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
	try {
		// ── Parse body ────────────────────────────────────────────────────
		const body: ChatRequestBody = await request.json();

		// ── Validate body ────────────────────────────────────────────────
		const validationError = validateBody(body);
		if (validationError) {
			return NextResponse.json({ error: validationError }, { status: 400 });
		}

		// ── Model routing (needed for both guest and auth paths) ─────────
		const lastUserMessage =
			[...body.messages].reverse().find((m) => m.role === "user")?.content ||
			"";
		const routing = routeModel(lastUserMessage);

		// ── Auth / Guest mode ──────────────────────────────────────────
		const user = await getCurrentInternalUser();

		if (!user) {
			// Guest mode — call AI directly, no persistence
			console.log(`[guest] JSON chat session: ${crypto.randomUUID()}`);
			const result = await chatCompletion(
				`guest_${crypto.randomUUID()}`,
				body.messages,
				routing.model,
				true,
			);
			return NextResponse.json({
				id: crypto.randomUUID(),
				sessionId: crypto.randomUUID(),
				choices: [
					{ index: 0, message: { role: "assistant", content: result.content } },
				],
				usage: {
					prompt_tokens: result.tokensIn,
					completion_tokens: result.tokensOut,
					total_tokens: result.tokensIn + result.tokensOut,
				},
				model: result.model,
				guest: true,
			});
		}

		// ── Authenticated mode ─────────────────────────────────────────
		const internalUserId = user.id;

		// ── Rate limit check ─────────────────────────────────────────────
		const usage = await checkUsage(internalUserId);
		if (!usage.allowed) {
			return NextResponse.json(
				{
					error:
						"Usage limit exceeded. Please upgrade your plan or try again tomorrow.",
					usage: {
						remaining: usage.remaining,
						limit: usage.limit,
					},
				},
				{ status: 402 },
			);
		}

		// ── Get or create session ────────────────────────────────────────
		const session = await getOrCreateSession(
			internalUserId,
			body.sessionId,
			lastUserMessage.slice(0, 80),
			body.projectId,
		);
		let providerMessages: ChatMessage[] = [...body.messages];

		// ── 1. Custom instructions (prepend) ─────────────────────────────
		try {
			const instructions = await getUserInstructions(internalUserId);
			const systemMessage = formatUserInstructionsForSystemMessage(
				instructions.aboutYou,
				instructions.howToRespond,
			);
			if (systemMessage) {
				providerMessages = [
					{ role: "system", content: systemMessage } as ChatMessage,
					...body.messages,
				];
			}
		} catch {
			// Custom instruction failures must not break chat
		}

		// ── 2. Project context injection (if body.projectId is present) ──
		if (body.projectId) {
			try {
				const projectContext = await getProjectContext(
					body.projectId,
					lastUserMessage,
				);
				if (projectContext) {
					// Project instructions
					if (projectContext.instructions) {
						providerMessages.push({
							role: "system",
							content: projectContext.instructions,
						} as ChatMessage);
					}
					// Project knowledge (RAG chunks)
					if (projectContext.knowledge) {
						providerMessages.push({
							role: "system",
							content: `Relevant project knowledge:\n${projectContext.knowledge}`,
						} as ChatMessage);
					}
					// Project memories
					if (projectContext.memories) {
						providerMessages.push({
							role: "system",
							content: `Project memories:\n${projectContext.memories}`,
						} as ChatMessage);
					}
				}
			} catch {
				// Project context failures must not break chat
			}
		}

		// ── 3. Cross-session memory injection ─────────────────────────
		try {
			const relevantMemories = await getRelevantMemories(
				internalUserId,
				lastUserMessage,
			);
			if (relevantMemories) {
				providerMessages.push({
					role: "system",
					content: relevantMemories,
				} as ChatMessage);
			}
		} catch {
			// Memory failures must not break chat
		}

		// ── 4. Session summary context (existing v1) ───────────────────
		try {
			const summaryContext = await getSessionSummaryContext(
				internalUserId,
				session.id,
			);
			if (summaryContext) {
				providerMessages.push({
					role: "system",
					content: `Relevant context from this conversation so far: ${summaryContext}`,
				} as ChatMessage);
			}
		} catch {
			// Memory failures must not break chat
		}

		// ── 5. Inject attachment content (from request body) ────────────
		try {
			providerMessages = injectAttachmentMessages(providerMessages);
		} catch {
			// Attachment injection failures must not break chat
		}

		// ── Call DeepSeek ────────────────────────────────────────────────
		const result = await chatCompletion(
			internalUserId,
			providerMessages,
			routing.model,
			true,
		);

		// ── Store assistant message ──────────────────────────────────────
		await storeMessage(
			session.id,
			"assistant",
			result.content,
			result.tokensIn,
			result.tokensOut,
		);

		// ── Update memory summary (best-effort) ─────────────────────────
		maybeUpdateSessionSummary(internalUserId, session.id);

		// ── Fire memory extraction (fire-and-forget) ────────────────────
		extractMemoryFacts(
			internalUserId,
			session.id,
			body.messages,
			body.projectId,
		).catch((err: unknown) =>
			console.error("[MEMORY] Extraction failed:", err),
		);

		// ── Record usage ─────────────────────────────────────────────────
		await recordUsage(
			internalUserId,
			result.model,
			result.tokensIn,
			result.tokensOut,
			result.costCents,
			session.id,
		);

		// ── Response (OpenAI-compatible format) ───────────────────────────
		return NextResponse.json({
			id: session.id,
			sessionId: session.id,
			choices: [
				{
					index: 0,
					message: {
						role: "assistant",
						content: result.content,
					},
				},
			],
			usage: {
				prompt_tokens: result.tokensIn,
				completion_tokens: result.tokensOut,
				total_tokens: result.tokensIn + result.tokensOut,
			},
			model: result.model,
		});
	} catch (err) {
		console.error("Chat API error:", err);

		// Provider errors → 503, never leak details
		if (err instanceof ProviderError) {
			return NextResponse.json(
				{
					error:
						"The assistant is temporarily unavailable. Please try again shortly.",
				},
				{ status: 503 },
			);
		}

		// Return a graceful error — never leak internal details to client
		return NextResponse.json(
			{ error: "Something went wrong. Please try again." },
			{ status: 500 },
		);
	}
}
