/**
 * ─── Admin Helpers ─────────────────────────────────────────────────────────
 *
 * Provides requireAdmin() for route protection.
 * An internal user is considered admin if:
 *   - user.role === 'admin', OR
 *   - their Clerk ID is in env ADMIN_CLERK_IDS (comma-separated), OR
 *   - their email is in env ADMIN_EMAILS (comma-separated)
 *
 * No secrets or env values are printed/logged.
 */
import { getCurrentInternalUser, UnauthorizedError } from "@/lib/auth-user";
import { sql } from "@/lib/db";

export class ForbiddenError extends Error {
	constructor(msg = "Forbidden") {
		super(msg);
		this.name = "ForbiddenError";
	}
}

/**
 * Returns the internal user if the current session is an admin.
 * Throws UnauthorizedError if not signed in.
 * Throws ForbiddenError if signed in but not admin.
 */
export async function requireAdmin(): Promise<{
	id: string;
	clerkId: string;
	email: string;
	role: string;
	beta_status: string;
}> {
	const user = await getCurrentInternalUser();
	if (!user) throw new UnauthorizedError();

	// Check environment-based admin lists first (fast, no DB read)
	const adminClerkIds = (process.env.ADMIN_CLERK_IDS || "")
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean);
	if (adminClerkIds.includes(user.clerkId)) {
		return { ...user, role: "admin", beta_status: "active" };
	}

	const adminEmails = (process.env.ADMIN_EMAILS || "")
		.split(",")
		.map((s) => s.trim().toLowerCase())
		.filter(Boolean);
	if (adminEmails.includes(user.email.toLowerCase())) {
		return { ...user, role: "admin", beta_status: "active" };
	}

	// Check DB role
	try {
		const rows = (await sql`
			SELECT role, beta_status FROM users WHERE id = ${user.id}
		`) as Array<{ role: string; beta_status: string }>;

		if (rows.length > 0 && rows[0].role === "admin") {
			return { ...user, role: rows[0].role, beta_status: rows[0].beta_status };
		}
	} catch {
		// DB error — deny admin
	}

	throw new ForbiddenError();
}
