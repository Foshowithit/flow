import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";

/**
 * GET /api/admin/health — admin-only deep-ish health check.
 * Returns DB status, env flag presence (not values), and config status.
 * No secrets are exposed.
 */
export async function GET() {
	try {
		await requireAdmin();
	} catch (err: any) {
		if (err.name === "UnauthorizedError") {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	// Check env flags — report present/missing, never values
	const envChecks: Record<string, boolean> = {
		DATABASE_URL: !!process.env.DATABASE_URL,
		NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:
			!!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
		CLERK_SECRET_KEY: !!process.env.CLERK_SECRET_KEY,
		CLERK_WEBHOOK_SECRET: !!process.env.CLERK_WEBHOOK_SECRET,
		NEXT_PUBLIC_APP_URL: !!process.env.NEXT_PUBLIC_APP_URL,
	};

	const health = {
		status: "ok",
		timestamp: new Date().toISOString(),
		app: "flow-web",
		db: null as boolean | null,
		aiConfigured: !!(
			process.env.DEEPSEEK_API_KEY || process.env.OPENCODE_GO_API_KEY
		),
		clerkWebhookSecret: !!process.env.CLERK_WEBHOOK_SECRET,
		envFlags: envChecks,
	};

	// Check database connectivity
	try {
		const { sql } = await import("@/lib/db");
		await sql`SELECT 1`;
		health.db = true;
	} catch {
		health.db = false;
	}

	return NextResponse.json(health, { status: 200 });
}
