/**
 * ─── Streaming Chat API ──────────────────────────────────────────────────
 *
 * SSE-based streaming endpoint for the chat UI.
 * Shares validation, auth, session, and memory logic with the JSON route.
 *
 * Events:
 *   session   { sessionId }
 *   delta     { content }
 *   done      { id, sessionId, model, usage }
 *   error     { error }
 */

import { type NextRequest } from "next/server";
import { getCurrentInternalUser } from "@/lib/auth-user";
import { routeModel } from "@/lib/router";
import { chatCompletionStream, ProviderError } from "@/lib/deepseek";
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
	getLastUserMessage,
	injectAttachmentMessages,
} from "@/lib/chat-helpers";
import {
	getUserInstructions,
	formatUserInstructionsForSystemMessage,
} from "@/lib/user-instructions";

// ─── SSE helpers ──────────────────────────────────────────────────────────

function sseString(event: string, data: unknown): string {
	return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function hasProviderKey(): boolean {
	return Boolean(
		process.env.DEEPSEEK_API_KEY || process.env.OPENCODE_GO_API_KEY,
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
			return new Response(sseString("error", { error: validationError }), {
				status: 200, // SSE always 200; error is in-band
				headers: {
					"Content-Type": "text/event-stream",
					"Cache-Control": "no-cache, no-transform",
				},
			});
		}


		if (!hasProviderKey() && process.env.NODE_ENV === "production") {
			return new Response(
				JSON.stringify({
					error:
						"Streaming chat is not configured. Set DEEPSEEK_API_KEY or OPENCODE_GO_API_KEY, and ensure a provider key is configured for production.",
				}),
				{
					status: 503,
					headers: {
						"Content-Type": "application/json",
					},
				},
			);
		}
		// ── Route model (needed for both guest and auth paths) ──────────────
		const lastUserMessage = getLastUserMessage(body.messages);
		const routing = routeModel(lastUserMessage);

		// ── Auth / resolve internal user ──────────────────────────────────
		const user = await getCurrentInternalUser();

		// ── Guest mode (no auth) ────────────────────────────────────────────
		if (!user) {
			const guestSessionId = crypto.randomUUID();
			const guestMessages: ChatMessage[] = [...body.messages];

			const guestStream = new ReadableStream({
				async start(controller) {
					try {
						// Send session event
						controller.enqueue(
							new TextEncoder().encode(
								sseString("session", { sessionId: guestSessionId }),
							),
						);

						let fullContent = "";
						let finalModel = "unknown";
						let finalTokensIn = 0;
						let finalTokensOut = 0;

						for await (const event of chatCompletionStream(
							`guest_${guestSessionId}`,
							guestMessages,
							routing.model,
						)) {
							if (event.type === "delta") {
								fullContent += event.content;
								controller.enqueue(
									new TextEncoder().encode(
										sseString("delta", { content: event.content }),
									),
								);
							} else if (event.type === "result") {
								finalModel = event.result.model;
								finalTokensIn = event.result.tokensIn;
								finalTokensOut = event.result.tokensOut;
							}
						}

						// Send done event
						controller.enqueue(
							new TextEncoder().encode(
								sseString("done", {
									id: guestSessionId,
									sessionId: guestSessionId,
									model: finalModel,
									usage: {
										prompt_tokens: finalTokensIn,
										completion_tokens: finalTokensOut,
										total_tokens: finalTokensIn + finalTokensOut,
									},
								}),
							),
						);
					} catch (err) {
						const errorMsg =
							err instanceof ProviderError
								? err.message
								: "Something went wrong. Please try again.";
						controller.enqueue(
							new TextEncoder().encode(sseString("error", { error: errorMsg })),
						);
					} finally {
						controller.close();
					}
				},
			});

			return new Response(guestStream, {
				status: 200,
				headers: {
					"Content-Type": "text/event-stream",
					"Cache-Control": "no-cache, no-transform",
					Connection: "keep-alive",
				},
			});
		}

		// ── Authenticated mode ────────────────────────────────────────
		const internalUserId = user.id;

		// ── Rate limit check ─────────────────────────────────────────────
		const usage = await checkUsage(internalUserId);
		if (!usage.allowed) {
			return new Response(
				sseString("error", {
					error:
						"Usage limit exceeded. Please upgrade your plan or try again tomorrow.",
				}),
				{
					status: 200,
					headers: {
						"Content-Type": "text/event-stream",
						"Cache-Control": "no-cache, no-transform",
					},
				},
			);
		}

		// ── Get or create session ────────────────────────────────────────
		const session = await getOrCreateSession(
			internalUserId,
			body.sessionId,
			lastUserMessage.slice(0, 80),
		);

		// ── Store user message (before streaming) ────────────────────────
		// Estimate input tokens for storage; the final usage from provider
		// will be more accurate, but we store the user message now so it
		// shows up immediately in the session view.
		const lastMsg = body.messages[body.messages.length - 1];
		const userMsgTokens = Math.ceil(lastMsg.content.length / 4);
		const userAttachments = lastMsg.attachments;
		await storeMessage(
			session.id,
			"user",
			lastUserMessage,
			userMsgTokens,
			0,
			userAttachments,
		);
		let providerMessages: ChatMessage[] = [...body.messages];
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

		// ── Build SSE stream ─────────────────────────────────────────────
		const encoder = new TextEncoder();
		const stream = new ReadableStream({
			async start(controller) {
				try {
					// 1. Send session event
					controller.enqueue(
						encoder.encode(sseString("session", { sessionId: session.id })),
					);

					// 2. Stream deltas from provider
					let fullContent = "";
					let finalResult: {
						content: string;
						model: string;
						tokensIn: number;
						tokensOut: number;
						costCents: number;
					} | null = null;

					for await (const event of chatCompletionStream(
						internalUserId,
						providerMessages,
						routing.model,
					)) {
						if (event.type === "delta") {
							fullContent += event.content;
							controller.enqueue(
								encoder.encode(sseString("delta", { content: event.content })),
							);
						} else if (event.type === "result") {
							finalResult = event.result;
						}
					}

					if (!finalResult) {
						// Should not happen — generator always yields a result event
						throw new ProviderError(
							"Stream completed without result",
							"unavailable",
						);
					}

					// 3. Store assistant message
					await storeMessage(
						session.id,
						"assistant",
						finalResult.content,
						finalResult.tokensIn,
						finalResult.tokensOut,
					);

					// 4. Update memory summary (best-effort)
					maybeUpdateSessionSummary(internalUserId, session.id);

					// 5. Record usage
					await recordUsage(
						internalUserId,
						finalResult.model,
						finalResult.tokensIn,
						finalResult.tokensOut,
						finalResult.costCents,
						session.id,
					);

					// 6. Send done event
					controller.enqueue(
						encoder.encode(
							sseString("done", {
								id: session.id,
								sessionId: session.id,
								model: finalResult.model,
								usage: {
									prompt_tokens: finalResult.tokensIn,
									completion_tokens: finalResult.tokensOut,
									total_tokens: finalResult.tokensIn + finalResult.tokensOut,
								},
							}),
						),
					);

					controller.close();
				} catch (err) {
					console.error("[STREAM] Stream error:", err);

					// Send safe error event
					let safeMessage = "Something went wrong. Please try again.";
					if (err instanceof ProviderError) {
						safeMessage =
							"The assistant is temporarily unavailable. Please try again shortly.";
					}

					try {
						controller.enqueue(
							encoder.encode(sseString("error", { error: safeMessage })),
						);
					} catch {
						// Controller may already be closed
					}

					// Do NOT store partial assistant message
					try {
						controller.close();
					} catch {
						// Already closed
					}
				}
			},
		});

		return new Response(stream, {
			status: 200,
			headers: {
				"Content-Type": "text/event-stream",
				"Cache-Control": "no-cache, no-transform",
			},
		});
	} catch (err) {
		// Catch errors from body parsing or other pre-stream setup
		console.error("[STREAM] Setup error:", err);

		let safeMessage = "Something went wrong. Please try again.";
		if (err instanceof ProviderError) {
			safeMessage =
				"The assistant is temporarily unavailable. Please try again shortly.";
		}

		return new Response(sseString("error", { error: safeMessage }), {
			status: 200,
			headers: {
				"Content-Type": "text/event-stream",
				"Cache-Control": "no-cache, no-transform",
			},
		});
	}
}
