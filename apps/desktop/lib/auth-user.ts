import { auth, currentUser } from "@clerk/nextjs/server";
import { sql } from "@/lib/db";

export interface InternalUser {
	id: string;
	clerkId: string;
	email: string;
}

/**
 * Returns the internal user record for the currently authenticated Clerk user.
 * If the user's DB row doesn't exist, it is created via upsert using Clerk
 * profile data (email, first/last name).  Does NOT depend on a Clerk webhook.
 *
 * Returns `null` when there is no authenticated Clerk session.
 */
export async function getCurrentInternalUser(): Promise<InternalUser | null> {
	const { userId: clerkId } = await auth();
	if (!clerkId) return null;

	// Quick lookup
	const rows = (await sql`
		SELECT id, clerk_id, email FROM users WHERE clerk_id = ${clerkId}
	`) as Array<{ id: string; clerk_id: string; email: string }>;

	if (rows.length > 0) {
		return {
			id: rows[0].id,
			clerkId: rows[0].clerk_id,
			email: rows[0].email,
		};
	}

	// Row missing — upsert from Clerk profile (no webhook needed)
	const clerkUser = await currentUser();
	if (!clerkUser) return null;

	const email =
		clerkUser.emailAddresses?.find(
			(e) => e.id === clerkUser.primaryEmailAddressId,
		)?.emailAddress ||
		clerkUser.emailAddresses?.[0]?.emailAddress ||
		"unknown";

	const result = (await sql`
		INSERT INTO users (clerk_id, email, first_name, last_name)
		VALUES (${clerkId}, ${email}, ${clerkUser.firstName ?? null}, ${clerkUser.lastName ?? null})
		ON CONFLICT (clerk_id) DO UPDATE SET
			email           = COALESCE(EXCLUDED.email, users.email),
			first_name      = COALESCE(EXCLUDED.first_name, users.first_name),
			last_name       = COALESCE(EXCLUDED.last_name, users.last_name)
		RETURNING id, clerk_id, email
	`) as Array<{ id: string; clerk_id: string; email: string }>;

	if (result.length === 0) return null;
	return {
		id: result[0].id,
		clerkId: result[0].clerk_id,
		email: result[0].email,
	};
}

/**
 * Variant that throws an `UnauthorizedError` instead of returning null.
 * Catch this in route-handler catch blocks to return 401.
 */
export async function requireCurrentInternalUser(): Promise<InternalUser> {
	const user = await getCurrentInternalUser();
	if (!user) throw new UnauthorizedError();
	return user;
}

export class UnauthorizedError extends Error {
	constructor() {
		super("Unauthorized");
		this.name = "UnauthorizedError";
	}
}
