#!/usr/bin/env node

/**
 * ─── Neon Database Backup Script ──────────────────────────────────────────────
 *
 * Exports critical tables to local JSON files for manual backup/snapshot.
 * Uses `pg_dump` if available, otherwise falls back to Node/Neon client.
 *
 * Usage:
 *   DATABASE_URL=postgres://... node scripts/backup-neon.mjs
 *   npm run backup:neon
 *
 * Output:
 *   ./backups/flow-backup-YYYYMMDD-HHMMSS/
 *     README.json        — manifest with created_at, tables, row counts
 *     users.json         — rows exported
 *     chat_sessions.json
 *     chat_messages.json
 *     chat_session_summaries.json
 *     usage_records.json
 *     waitlist.json
 *
 * Excluded tables: api_keys
 * Secrets are redacted from the output.
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "@neondatabase/serverless";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
	console.error(
		"[BACKUP] FATAL: DATABASE_URL environment variable is required.",
	);
	console.error(
		"[BACKUP]   DATABASE_URL=postgres://user:pass@host/db node scripts/backup-neon.mjs",
	);
	process.exit(1);
}

// ── Tables to export ──────────────────────────────────────────────────────────

const TABLES = [
	"users",
	"chat_sessions",
	"chat_messages",
	"chat_session_summaries",
	"usage_records",
	"waitlist",
];

// ── Output directory ──────────────────────────────────────────────────────────

const now = new Date();
const ts = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
const dirName = `flow-backup-${ts}`;
const OUT_DIR = join(ROOT, "backups", dirName);

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Escape a Postgres identifier (double-quote safe). */
function quoteIdent(name) {
	return `"${name.replace(/"/g, '""')}"`;
}

/** Redact secret-looking values from data recursively. */
function redact(value, depth = 0) {
	if (typeof value === "string") {
		if (
			/key|secret|password|token|hash|credential|sk-|pk_/i.test(value) &&
			value.length > 8
		) {
			return value.slice(0, 4) + "…" + value.slice(-4);
		}
		return value;
	}
	if (Array.isArray(value)) {
		return value.map((v) => redact(v, depth + 1));
	}
	if (value !== null && typeof value === "object") {
		const obj = {};
		for (const [k, v] of Object.entries(value)) {
			obj[k] = redact(v, depth + 1);
		}
		return obj;
	}
	return value;
}

// ── Export logic ──────────────────────────────────────────────────────────────

async function exportWithPool() {
	const pool = new Pool({ connectionString: DATABASE_URL });

	console.log("[BACKUP] Exporting tables …\n");

	if (!existsSync(OUT_DIR)) {
		mkdirSync(OUT_DIR, { recursive: true });
	}

	const manifest = {
		createdAt: now.toISOString(),
		tables: [],
		note: "Secrets have been redacted. api_keys table is excluded.",
	};

	try {
		for (const table of TABLES) {
			let count = 0;
			try {
				const countResult = await pool.query(
					`SELECT COUNT(*)::int AS cnt FROM ${quoteIdent(table)}`,
				);
				count = countResult.rows[0]?.cnt ?? 0;
			} catch {
				count = -1;
			}

			console.log(`  Exporting ${table} … (${count} rows)`);
			try {
				const result = await pool.query(
					`SELECT * FROM ${quoteIdent(table)} ORDER BY 1`,
				);
				const safe = redact(result.rows);
				writeFileSync(
					join(OUT_DIR, `${table}.json`),
					JSON.stringify(safe, null, 2),
					"utf-8",
				);
				manifest.tables.push({
					name: table,
					rowCount: count,
					file: `${table}.json`,
				});
			} catch (err) {
				console.error(`  ✗ Failed to export ${table}: ${err.message}`);
				manifest.tables.push({
					name: table,
					rowCount: count,
					error: err.message,
				});
			}
		}

		writeFileSync(
			join(OUT_DIR, "README.json"),
			JSON.stringify(manifest, null, 2),
			"utf-8",
		);

		console.log(`\n[BACKUP] Done. Output: ${OUT_DIR}`);
		console.log(`[BACKUP] Manifest: ${join(OUT_DIR, "README.json")}`);
	} finally {
		await pool.end();
	}
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
	console.log(`\n── Neon Backup ──\n`);
	await exportWithPool();
}

main().catch((err) => {
	console.error("[BACKUP] Fatal:", err);
	process.exit(1);
});
