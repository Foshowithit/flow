import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { sql } from "@/lib/db";

/**
 * GET /api/admin/usage — admin-only aggregate usage records by day/model.
 * Returns daily breakdown plus totals.
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

	try {
		const daily = (await sql`
			SELECT
			  DATE(created_at) AS day,
			  model,
			  COUNT(*)::int                  AS request_count,
			  COALESCE(SUM(tokens_in), 0)::int  AS tokens_in,
			  COALESCE(SUM(tokens_out), 0)::int AS tokens_out,
			  COALESCE(SUM(cost_cents), 0)::int AS cost_cents
			FROM usage_records
			GROUP BY DATE(created_at), model
			ORDER BY day DESC, model
		`) as Array<{
			day: string;
			model: string;
			request_count: number;
			tokens_in: number;
			tokens_out: number;
			cost_cents: number;
		}>;

		const totals = (await sql`
			SELECT
			  COUNT(*)::int                     AS total_requests,
			  COALESCE(SUM(tokens_in), 0)::int  AS total_tokens_in,
			  COALESCE(SUM(tokens_out), 0)::int AS total_tokens_out,
			  COALESCE(SUM(cost_cents), 0)::int AS total_cost_cents
			FROM usage_records
		`) as Array<{
			total_requests: number;
			total_tokens_in: number;
			total_tokens_out: number;
			total_cost_cents: number;
		}>;

		return NextResponse.json({
			daily,
			totals: totals[0] || {
				total_requests: 0,
				total_tokens_in: 0,
				total_tokens_out: 0,
				total_cost_cents: 0,
			},
		});
	} catch (err) {
		console.error("[ADMIN USAGE] Failed to aggregate usage:", err);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}
