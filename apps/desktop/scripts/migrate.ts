#!/usr/bin/env npx tsx
/**
 * Standalone migration script.
 *
 * Usage:
 *   npx tsx scripts/migrate.ts
 *
 * Requires DATABASE_URL environment variable.
 */
import { runMigrations } from "../lib/migrate";

async function main() {
	try {
		await runMigrations();
		console.log("[MIGRATE] Done.");
		process.exit(0);
	} catch (err) {
		console.error("[MIGRATE] Migration failed:", err);
		process.exit(1);
	}
}

main();
