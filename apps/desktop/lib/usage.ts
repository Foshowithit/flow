/**
 * ─── Per-User Usage Tracking ───────────────────────────────────────────────
 *
 * Tracks daily API usage against free/pro tier limits.
 * Relies on the `usage_records` and `subscriptions` tables.
 */

import { sql } from "@/lib/db";
import { LIMITS, type Tier } from "@/lib/limits";

// ─── Result type ───────────────────────────────────────────────────────────

export interface UsageCheck {
  allowed: boolean;
  remaining: number;
  limit: number;
}

// ─── Get user tier ─────────────────────────────────────────────────────────

/**
 * getUserTier — checks the subscriptions table for the user's plan.
 * Defaults to 'free' if no subscription row exists.
 */
export async function getUserTier(userId: string): Promise<Tier> {
  try {
    const rows = (await sql`
      SELECT plan FROM subscriptions
      WHERE user_id = ${userId}
        AND status = 'active'
      ORDER BY created_at DESC
      LIMIT 1
    `) as Array<{ plan: string }>;

    if (rows.length === 0) return "free";
    const plan = rows[0].plan;
    if (plan === "pro" || plan === "enterprise") return "pro";
    return "free";
  } catch {
    return "free";
  }
}

// ─── Check usage ───────────────────────────────────────────────────────────

/**
 * checkUsage — checks today's usage against the user's tier limit.
 *
 * Returns { allowed, remaining, limit }.
 * - If allowed is false, the caller should return HTTP 402.
 */
export async function checkUsage(userId: string): Promise<UsageCheck> {
  const tier = await getUserTier(userId);
  const limit = tier === "free"
    ? LIMITS.free.requestsPerDay
    : LIMITS.pro.requestsPerDay;
  const costLimit = tier === "free"
    ? LIMITS.free.costCentsPerDay
    : LIMITS.pro.costCentsPerDay;

  try {
    // Count today's requests and cost
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString();

    const rows = (await sql`
      SELECT
        COUNT(*)::int AS request_count,
        COALESCE(SUM(cost_cents), 0)::int AS total_cost_cents
      FROM usage_records
      WHERE user_id = ${userId}
        AND created_at >= ${todayStr}::timestamptz
    `) as Array<{ request_count: number; total_cost_cents: number }>;

    const requestCount = rows[0]?.request_count ?? 0;
    const totalCostCents = rows[0]?.total_cost_cents ?? 0;

    // Block if either limit is exceeded
    if (requestCount >= limit) {
      return { allowed: false, remaining: 0, limit };
    }

    if (totalCostCents >= costLimit) {
      return { allowed: false, remaining: 0, limit };
    }

    return {
      allowed: true,
      remaining: limit - requestCount,
      limit,
    };
  } catch {
    // If we can't check usage, allow the request (fail open)
    return { allowed: true, remaining: 1, limit };
  }
}

// ─── Record usage ──────────────────────────────────────────────────────────

/**
 * recordUsage — inserts a row into usage_records for this request.
 *
 * @param userId    Internal user UUID.
 * @param model     Model name used.
 * @param tokensIn  Input tokens consumed.
 * @param tokensOut Output tokens consumed.
 * @param costCents Cost in cents (0 for BYOK users).
 * @param sessionId Optional chat session UUID.
 */
export async function recordUsage(
  userId: string,
  model: string,
  tokensIn: number,
  tokensOut: number,
  costCents: number,
  sessionId?: string,
): Promise<void> {
  try {
    await sql`
      INSERT INTO usage_records (user_id, model, tokens_in, tokens_out, cost_cents, session_id)
      VALUES (${userId}, ${model}, ${tokensIn}, ${tokensOut}, ${costCents}, ${sessionId ?? null})
    `;
  } catch (err) {
    // Log but never throw — usage tracking failures shouldn't break the app
    console.error("[USAGE] Failed to record usage:", err);
  }
}
