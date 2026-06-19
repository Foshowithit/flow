/**
 * ─── Usage Limits ─────────────────────────────────────────────────────────
 *
 * Free tier: 50 requests/day, $1/day hard cap.
 * Pro tier:  500 requests/day, $25/mo (~$0.83/day) soft cap.
 */

export const LIMITS = {
  free: { requestsPerDay: 50, costCentsPerDay: 100 },  // $1/day
  pro: { requestsPerDay: 500, costCentsPerDay: 2500 }, // $25/mo ~ $0.83/day
} as const;

export type Tier = keyof typeof LIMITS;
