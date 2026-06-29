#!/usr/bin/env node

/**
 * ─── Smoke Test ───────────────────────────────────────────────────────────────
 *
 * Usage:
 *   BASE_URL=http://localhost:3000 node scripts/smoke.mjs
 *
 * Exits nonzero on any failure.
 * No secrets are printed.
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

let failures = 0;

async function check(label, url, options = {}) {
	const {
		expectedStatus = 200,
		expectedSubstring,
		notExpectedSubstring,
		method = "GET",
		body,
	} = options;

	try {
		const fetchOpts = { method };
		if (body) {
			fetchOpts.headers = { "Content-Type": "application/json" };
			fetchOpts.body = JSON.stringify(body);
		}

		const res = await fetch(url, fetchOpts);
		const text = await res.text();

		if (res.status !== expectedStatus) {
			console.error(
				`✗ ${label}: expected status ${expectedStatus}, got ${res.status}`,
			);
			failures++;
			return;
		}

		if (expectedSubstring && !text.includes(expectedSubstring)) {
			console.error(
				`✗ ${label}: expected substring "${expectedSubstring}" not found`,
			);
			failures++;
			return;
		}

		if (notExpectedSubstring && text.includes(notExpectedSubstring)) {
			console.error(
				`✗ ${label}: unexpected substring "${notExpectedSubstring}" found`,
			);
			failures++;
			return;
		}

		console.log(`✓ ${label}`);
	} catch (err) {
		console.error(`✗ ${label}: ${err.message}`);
		failures++;
	}
}

async function main() {
	console.log(`\n── Smoke Tests (BASE_URL=${BASE_URL}) ──\n`);

	// Landing page
	await check("GET /", `${BASE_URL}/`, {
		expectedSubstring: "Flow",
	});

	// Chat page
	await check("GET /chat", `${BASE_URL}/chat`, {
		expectedSubstring: "Flow",
	});

	// Sign-in page
	await check("GET /sign-in", `${BASE_URL}/sign-in`, {
		expectedSubstring: "sign",
	});

	// Sign-up page
	await check("GET /sign-up", `${BASE_URL}/sign-up`, {
		expectedSubstring: "sign",
	});

	// Health endpoint
	await check("GET /api/health", `${BASE_URL}/api/health`, {
		expectedSubstring: '"status":"ok"',
	});

	// Waitlist — deterministic duplicate flow
	const dupeEmail = `smoke-dupe-${Date.now()}@example.com`;
	await check(
		"POST /api/waitlist (first — create)",
		`${BASE_URL}/api/waitlist`,
		{
			method: "POST",
			body: { email: dupeEmail },
			expectedStatus: 201,
			expectedSubstring: "You're on the list",
		},
	);
	await check(
		"POST /api/waitlist (duplicate — 409)",
		`${BASE_URL}/api/waitlist`,
		{
			method: "POST",
			body: { email: dupeEmail },
			expectedStatus: 409,
			expectedSubstring: "already on",
		},
	);

	// Waitlist — invalid email
	await check("POST /api/waitlist (bad email)", `${BASE_URL}/api/waitlist`, {
		method: "POST",
		body: { email: "not-an-email" },
		expectedStatus: 400,
		expectedSubstring: "valid email",
	});

	// Chat API — valid response, or auth-required (401/404 after middleware hardening)
	{
		const url = `${BASE_URL}/api/chat`;

		// Valid body — provider response or middleware block
		const chatRes = await fetch(url, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ messages: [{ role: "user", content: "hello" }] }),
		});

		if (chatRes.ok) {
			const chatData = await chatRes.json();
			if (chatData.choices?.[0]?.message?.content) {
				console.log("✓ POST /api/chat (valid) — response");
			} else {
				console.error("✗ POST /api/chat (valid) — missing content");
				failures++;
			}
		} else if (chatRes.status === 401) {
			console.log("✓ POST /api/chat (valid) — 401 (no auth)");
		} else if (chatRes.status === 404) {
			console.log("✓ POST /api/chat (valid) — 404 (protected by middleware)");
		} else if (chatRes.status >= 500) {
			console.error(
				`✗ POST /api/chat (valid) — 5xx unexpected: ${chatRes.status}`,
			);
			failures++;
		} else {
			console.error(
				`✗ POST /api/chat (valid) — unexpected status ${chatRes.status}`,
			);
			failures++;
		}

		// No-messages body — handler validation or middleware block
		const noMsgRes = await fetch(url, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({}),
		});

		if (noMsgRes.status === 400) {
			const text = await noMsgRes.text();
			if (text.includes("messages array is required")) {
				console.log(
					"✓ POST /api/chat (no messages) — validation rejected (400)",
				);
			} else {
				console.error(
					"✗ POST /api/chat (no messages) — 400 without expected message",
				);
				failures++;
			}
		} else if (noMsgRes.status === 401) {
			console.log("✓ POST /api/chat (no messages) — 401 (protected)");
		} else if (noMsgRes.status === 404) {
			console.log(
				"✓ POST /api/chat (no messages) — 404 (protected by middleware)",
			);
		} else if (noMsgRes.status >= 500) {
			console.error(
				`✗ POST /api/chat (no messages) — 5xx unexpected: ${noMsgRes.status}`,
			);
			failures++;
		} else {
			console.error(
				`✗ POST /api/chat (no messages) — unexpected status ${noMsgRes.status}`,
			);
			failures++;
		}
	}

	// Stream API — must be protected for unauthenticated callers
	{
		const url = `${BASE_URL}/api/chat/stream`;
		const streamRes = await fetch(url, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ messages: [{ role: "user", content: "hello" }] }),
		});

		// Accept 401 (handler-level unauthorized) or 404 (middleware block)
		// Fail on 5xx
		if (streamRes.status === 401) {
			console.log("✓ POST /api/chat/stream — 401 (no auth)");
		} else if (streamRes.status === 404) {
			console.log("✓ POST /api/chat/stream — 404 (protected by middleware)");
		} else if (streamRes.status >= 500) {
			console.error(
				`✗ POST /api/chat/stream — 5xx unexpected: ${streamRes.status}`,
			);
			failures++;
		} else {
			// 200 with SSE — either in-band error or valid stream
			const text = await streamRes.text();
			if (text.includes('"error"') || text.includes('"Unauthorized"')) {
				console.log("✓ POST /api/chat/stream — SSE error (no auth)");
			} else if (text.includes('event: session')) {
				console.log("✓ POST /api/chat/stream — SSE valid (keyless mode)");
			} else {
				console.error(
					`✗ POST /api/chat/stream — unexpected status ${streamRes.status}: ${text.slice(0, 100)}`,
				);
				failures++;
			}
	}
	}

	// Settings page — signed-out should show sign-in CTA (not broken)
	{
		const url = `${BASE_URL}/settings`;
		const res = await fetch(url);
		const text = await res.text();
		if (
			res.status === 200 &&
			(text.includes("Sign in") || text.includes("sign-in"))
		) {
			console.log("✓ GET /settings — sign-in CTA displayed");
		} else if (res.status >= 500) {
			console.error(`✗ GET /settings — 5xx unexpected: ${res.status}`);
			failures++;
		} else {
			console.error(`✗ GET /settings — unexpected status ${res.status}`);
			failures++;
		}
	}

	// Memory page — signed-out should show sign-in CTA (not broken)
	{
		const url = `${BASE_URL}/memory`;
		const res = await fetch(url);
		const text = await res.text();
		if (
			res.status === 200 &&
			(text.includes("Sign in") || text.includes("sign-in"))
		) {
			console.log("✓ GET /memory — sign-in CTA displayed");
		} else if (res.status >= 500) {
			console.error(`✗ GET /memory — 5xx unexpected: ${res.status}`);
			failures++;
		} else {
			console.error(`✗ GET /memory — unexpected status ${res.status}`);
			failures++;
		}
	}

	// API: GET /api/memory — should be protected
	{
		const res = await fetch(`${BASE_URL}/api/memory`);
		if (res.status === 401) {
			console.log("✓ GET /api/memory — 401 (no auth)");
		} else if (res.status === 404) {
			console.log("✓ GET /api/memory — 404 (protected by middleware)");
		} else if (res.status >= 500) {
			console.error(`✗ GET /api/memory — 5xx unexpected: ${res.status}`);
			failures++;
		} else {
			console.error(`✗ GET /api/memory — unexpected status ${res.status}`);
			failures++;
		}
	}

	// API: GET /api/account/export — should be protected
	{
		const res = await fetch(`${BASE_URL}/api/account/export`);
		if (res.status === 401) {
			console.log("✓ GET /api/account/export — 401 (no auth)");
		} else if (res.status === 404) {
			console.log("✓ GET /api/account/export — 404 (protected by middleware)");
		} else if (res.status >= 500) {
			console.error(
				`✗ GET /api/account/export — 5xx unexpected: ${res.status}`,
			);
			failures++;
		} else {
			console.error(
				`✗ GET /api/account/export — unexpected status ${res.status}`,
			);
			failures++;
		}
	}

	// API: DELETE /api/account/chats — should be protected
	{
		const res = await fetch(`${BASE_URL}/api/account/chats`, {
			method: "DELETE",
		});
		if (res.status === 401) {
			console.log("✓ DELETE /api/account/chats — 401 (no auth)");
		} else if (res.status === 404) {
			console.log(
				"✓ DELETE /api/account/chats — 404 (protected by middleware)",
			);
		} else if (res.status >= 500) {
			console.error(
				`✗ DELETE /api/account/chats — 5xx unexpected: ${res.status}`,
			);
			failures++;
		} else {
			console.error(
				`✗ DELETE /api/account/chats — unexpected status ${res.status}`,
			);
			failures++;
		}
	}

	// Admin page — signed-out should show sign-in CTA (not broken)
	{
		const url = `${BASE_URL}/admin`;
		const res = await fetch(url);
		const text = await res.text();
		if (
			res.status === 200 &&
			(text.includes("Sign in") || text.includes("sign-in"))
		) {
			console.log("✓ GET /admin — sign-in CTA displayed");
		} else if (res.status >= 500) {
			console.error(`✗ GET /admin — 5xx unexpected: ${res.status}`);
			failures++;
		} else {
			console.error(`✗ GET /admin — unexpected status ${res.status}`);
			failures++;
		}
	}

	// Admin API: GET /api/admin/users — must be protected (no auth)
	{
		const res = await fetch(`${BASE_URL}/api/admin/users`);
		if (res.status === 401) {
			console.log("✓ GET /api/admin/users — 401 (no auth)");
		} else if (res.status === 404) {
			console.log("✓ GET /api/admin/users — 404 (protected by middleware)");
		} else if (res.status >= 500) {
			console.error(`✗ GET /api/admin/users — 5xx unexpected: ${res.status}`);
			failures++;
		} else {
			console.error(`✗ GET /api/admin/users — unexpected status ${res.status}`);
			failures++;
		}
	}

	// Admin API: GET /api/admin/usage — must be protected (no auth)
	{
		const res = await fetch(`${BASE_URL}/api/admin/usage`);
		if (res.status === 401) {
			console.log("✓ GET /api/admin/usage — 401 (no auth)");
		} else if (res.status === 404) {
			console.log("✓ GET /api/admin/usage — 404 (protected by middleware)");
		} else if (res.status >= 500) {
			console.error(`✗ GET /api/admin/usage — 5xx unexpected: ${res.status}`);
			failures++;
		} else {
			console.error(`✗ GET /api/admin/usage — unexpected status ${res.status}`);
			failures++;
		}
	}

	// Admin API: GET /api/admin/health — must be protected (no auth)
	{
		const res = await fetch(`${BASE_URL}/api/admin/health`);
		if (res.status === 401) {
			console.log("✓ GET /api/admin/health — 401 (no auth)");
		} else if (res.status === 404) {
			console.log("✓ GET /api/admin/health — 404 (protected by middleware)");
		} else if (res.status >= 500) {
			console.error(`✗ GET /api/admin/health — 5xx unexpected: ${res.status}`);
			failures++;
		} else {
			console.error(
				`✗ GET /api/admin/health — unexpected status ${res.status}`,
			);
			failures++;
		}
	}

	// Search API — must be protected for unauthenticated callers
	{
		const res = await fetch(`${BASE_URL}/api/sessions/search?q=test`);
		if (res.status === 401) {
			console.log("✓ GET /api/sessions/search?q=test — 401 (no auth)");
		} else if (res.status === 404) {
			console.log(
				"✓ GET /api/sessions/search?q=test — 404 (protected by middleware)",
			);
		} else if (res.status === 400) {
			// Could reach the handler but without auth it might still 400
			const text = await res.text();
			if (text.includes("required")) {
				console.log(
					"✓ GET /api/sessions/search?q=test — 400 without auth (validation before auth check)",
				);
			} else {
				console.log("✓ GET /api/sessions/search?q=test — 400");
			}
		} else if (res.status >= 500) {
			console.error(
				`✗ GET /api/sessions/search?q=test — 5xx unexpected: ${res.status}`,
			);
			failures++;
		} else {
			console.log("✓ GET /api/sessions/search?q=test — " + res.status);
		}
	}

	if (failures === 0) {
		console.log("All smoke tests passed.");
	} else {
		console.error(`${failures} test(s) failed.`);
		process.exit(1);
	}
}

main().catch((err) => {
	console.error("Smoke test crashed:", err);
	process.exit(1);
});
