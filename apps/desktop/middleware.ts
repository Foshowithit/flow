import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

/**
 * ─── Public Routes ─────────────────────────────────────────────────────
 * These routes are accessible without authentication.
 */
const isPublicRoute = createRouteMatcher([
	"/",
	"/api/webhooks/clerk",
	"/api/waitlist",
	"/api/health",
	"/chat(.*)",
	"/desktop(.*)",
	"/sign-in(.*)",
	"/sign-up(.*)",
	"/pricing",
	"/settings(.*)",
	"/memory(.*)",
	"/admin(.*)",
	// API routes — each handler does its own auth check
	"/api/chat(.*)",
	"/api/sessions(.*)",
	"/api/memory(.*)",
	"/api/account(.*)",
	"/api/settings(.*)",
	"/api/admin(.*)",
]);

/**
 * ─── Middleware ─────────────────────────────────────────────────────────
 * Clerk authentication check for all non-public routes.
 * Unauthenticated users are redirected to the landing page.
 */
export default clerkMiddleware(async (auth, request) => {
	if (!isPublicRoute(request)) {
		await auth.protect();
	}
});

export const config = {
	matcher: [
		// Skip Next.js internals and static files (images, fonts, docs, etc.)
		"/((?!_next/static|_next/image|favicon\\.ico|manifest\\.json|icon-.*\\.svg|.*\\.svg|.*\\.png|.*\\.jpg|.*\\.jpeg|.*\\.gif|.*\\.webp|.*\\.ico|.*\\.css|.*\\.js|.*\\.map|.*\\.txt|.*\\.xml|.*\\.json).*)",
	],
};
