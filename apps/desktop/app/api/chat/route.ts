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

// ─── Mock response ───────────────────────────────────────────────────

function mockResponse(messages: ChatMessage[]): string {
	const last = messages[messages.length - 1];
	const userMessage = last?.content?.trim() || "";

	if (/hello|hi|hey/i.test(userMessage)) {
		return "Hello! I'm Flow Assistant. How can I help you today?";
	}

	if (/help|what can you/i.test(userMessage)) {
		return (
			"I'm here to help you think through problems, answer questions, and " +
			"provide thoughtful analysis. Try asking me about a decision you're " +
			"working on, a situation you'd like to understand better, or ask me to " +
			"compare options for you."
		);
	}

	return (
		"That's a great question. Let me think through it carefully.\n\n" +
		"Based on what you've shared, here are a few considerations:\n\n" +
		"1. **Clarity** — taking a step back to frame the question clearly helps " +
		"us find the best path forward.\n\n" +
		"2. **Context** — understanding the broader situation makes the answer " +
		"more useful and relevant.\n\n" +
		"3. **Next steps** — once we've explored the angles, we can land on " +
		"actionable next steps.\n\n" +
		"What specific aspect would you like to explore further?"
	);
}

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

		// ── Mock mode (no backend needed, but auth still required) ────────
		if (process.env.MOCK_CHAT === "true") {
			const content = mockResponse(body.messages);
			await new Promise((r) => setTimeout(r, 500));
			return NextResponse.json({
				id: "mock-session",
				sessionId: "mock-session",
				choices: [
					{
						index: 0,
						message: {
							role: "assistant",
							content,
						},
					},
				],
				mock: true,
			});
		}

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
		);
		let providerMessages = [...body.messages];
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

		// ── Inject attachment content (from request body) ────────────
		try {
			providerMessages = injectAttachmentMessages(providerMessages);
		} catch {
			// Attachment injection failures must not break chat
		}

		// ── Inject memory context ──────────────────────────────────
		try {
			const summaryContext = await getSessionSummaryContext(
				internalUserId,
				session.id,
			);
			if (summaryContext) {
				providerMessages = [
					...providerMessages,
					{
						role: "system",
						content: `Relevant context from this conversation so far: ${summaryContext}`,
					} as ChatMessage,
				];
			}
		} catch {
			// Memory failures must not break chat
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
