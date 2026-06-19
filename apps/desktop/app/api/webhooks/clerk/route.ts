import { sql } from "@/lib/db";

import { Webhook } from "svix";
import { headers } from "next/headers";
import type { WebhookEvent } from "@clerk/nextjs/server";

// ─── Webhook Handler ─────────────────────────────────────────────────

export async function POST(req: Request) {
	// Get the raw body as text
	const payloadText = await req.text();

	// Read headers
	const headerPayload = await headers();
	const svixId = headerPayload.get("svix-id");
	const svixTimestamp = headerPayload.get("svix-timestamp");
	const svixSignature = headerPayload.get("svix-signature");

	// Validate required headers
	if (!svixId || !svixTimestamp || !svixSignature) {
		return new Response("Missing svix headers", { status: 400 });
	}

	// Get webhook secret from env
	const secret = process.env.CLERK_WEBHOOK_SECRET;
	if (!secret) {
		console.error("[CLERK WEBHOOK] CLERK_WEBHOOK_SECRET is not set");
		return new Response("Server configuration error", { status: 500 });
	}

	// Verify signature
	let evt: WebhookEvent;
	try {
		const wh = new Webhook(secret);
		evt = wh.verify(payloadText, {
			"svix-id": svixId,
			"svix-timestamp": svixTimestamp,
			"svix-signature": svixSignature,
		}) as WebhookEvent;
	} catch (err) {
		console.error("[CLERK WEBHOOK] Signature verification failed:", err);
		return new Response("Invalid signature", { status: 400 });
	}

	// Handle event
	const { type, data } = evt;

	switch (type) {
		case "user.created": {
			const { id, email_addresses, first_name, last_name } = data;
			const primaryEmail =
				email_addresses?.find((e) => e.id === data.primary_email_address_id)
					?.email_address ||
				email_addresses?.[0]?.email_address ||
				"unknown";
			console.log(
				`[CLERK WEBHOOK] user.created — id=${id} email=${primaryEmail} name=${first_name || ""} ${last_name || ""}`,
			);

			// Insert user into Neon database
			try {
				await sql`
					INSERT INTO users (clerk_id, email, first_name, last_name)
					VALUES (${id}, ${primaryEmail}, ${first_name ?? null}, ${last_name ?? null})
					ON CONFLICT (clerk_id) DO NOTHING
				`;
				console.log(`[CLERK WEBHOOK] user inserted — id=${id}`);
			} catch (dbErr) {
				console.error("[CLERK WEBHOOK] Database insert failed:", dbErr);
			}

			break;
		}

		case "user.deleted": {
			const { id } = data;
			console.log(`[CLERK WEBHOOK] user.deleted — id=${id}`);
			// TODO (Phase 2): Remove user from database
			break;
		}

		case "session.created": {
			const { user_id } = data;
			console.log(`[CLERK WEBHOOK] session.created — user_id=${user_id}`);
			break;
		}

		default: {
			console.log(`[CLERK WEBHOOK] Unhandled event type: ${type}`);
			break;
		}
	}

	return new Response("OK", { status: 200 });
}
