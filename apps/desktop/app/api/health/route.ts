import { NextResponse } from "next/server";

/**
 * GET /api/health — returns safe health check JSON.
 * No secrets are exposed.
 */
export async function GET() {
	const health = {
		status: "ok",
		timestamp: new Date().toISOString(),
		app: "flow-web",
		mockChat: process.env.MOCK_CHAT === "true",
		aiConfigured: !!(
			process.env.DEEPSEEK_API_KEY || process.env.OPENCODE_GO_API_KEY
		),
		dbReachable: null as boolean | null,
	};

	// Check database connectivity (non-blocking)
	try {
		const { sql } = await import("@/lib/db");
		await sql`SELECT 1`;
		health.dbReachable = true;
	} catch {
		health.dbReachable = false;
	}

	return NextResponse.json(health, { status: 200 });
}
