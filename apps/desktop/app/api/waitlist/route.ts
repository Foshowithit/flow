import { type NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

// ─── Types ───────────────────────────────────────────────────────────────────

interface WaitlistBody {
	email: string;
	role?: string;
	useCase?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isValidEmail(email: string): boolean {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ─── Route Handler ───────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
	try {
		const body: WaitlistBody = await request.json();

		if (!body.email || !isValidEmail(body.email)) {
			return NextResponse.json(
				{ error: "A valid email address is required." },
				{ status: 400 },
			);
		}

		const email = body.email.trim().toLowerCase();
		const role = body.role?.trim() || null;
		const useCase = body.useCase?.trim() || null;

		// INSERT with ON CONFLICT DO NOTHING so duplicate emails are silently
		// skipped.  If no row is returned the email already exists.
		const result = await sql`
			INSERT INTO waitlist (email, role, use_case)
			VALUES (${email}, ${role}, ${useCase})
			ON CONFLICT (email) DO NOTHING
			RETURNING id
		`;

		if (result.length === 0) {
			return NextResponse.json(
				{ error: "This email is already on the waitlist." },
				{ status: 409 },
			);
		}

		return NextResponse.json(
			{ message: "You're on the list. We'll be in touch." },
			{ status: 201 },
		);
	} catch (err) {
		console.error("Waitlist API error:", err);
		return NextResponse.json(
			{ error: "Something went wrong. Please try again." },
			{ status: 500 },
		);
	}
}
