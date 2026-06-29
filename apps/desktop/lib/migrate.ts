/**
 * runMigrations — executes lib/schema.sql against the Neon database.
 *
 * Can be called from scripts or API routes.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Pool } from "@neondatabase/serverless";

export async function runMigrations(): Promise<void> {
	console.log("[MIGRATE] Running database migrations …");

	const connectionString = process.env.DATABASE_URL;
	if (!connectionString) {
		throw new Error("DATABASE_URL environment variable is not set");
	}

	const pool = new Pool({ connectionString });

	try {
		const schemaPath = join(import.meta.dirname, "schema.sql");
		const schema = readFileSync(schemaPath, "utf-8");

		// Split by semicolons and extract SQL from each chunk.
		// Filter out comment-only chunks, but keep SQL lines even when preceded by comments.
		const chunks = schema
			.split(";")
			.map((s) => s.trim())
			.filter((s) => s.length > 0);
		const statements = chunks
			.map((chunk) => {
				const lines = chunk.split("\n");
				const sqlLines = lines.filter((l) => !l.trim().startsWith("--"));
				return sqlLines.join("\n").trim();
			})
			.filter((s) => s.length > 0);

		for (let i = 0; i < statements.length; i++) {
			const stmt = statements[i];
			try {
				await pool.query(stmt);
			} catch (err: any) {
				// IF NOT EXISTS errors for existing objects are harmless
				if (err.message?.includes("already exists")) {
					console.log(
						`[MIGRATE] Skipping (already exists): ${stmt.slice(0, 60)}...`,
					);
					continue;
				}
				// Column/index does not exist yet — skip if it's a CREATE INDEX
				// or DDL referencing a column that will be added in a later phase
				if (
					err.message?.includes("does not exist") &&
					/^CREATE\s+INDEX/i.test(stmt.trim())
				) {
					console.log(
						`[MIGRATE] Skipping (column not ready yet): ${stmt.slice(0, 60)}...`,
					);
					continue;
				}
				console.error(`[MIGRATE] Error executing statement:\n${stmt}\n`, err);
				throw err;
			}
		}

		// ── Phase 4 migration: add session_id to usage_records ──────────────
		try {
			await pool.query(`
				ALTER TABLE usage_records
				ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES chat_sessions(id) ON DELETE SET NULL
			`);
			console.log("[MIGRATE] Added session_id column to usage_records.");
		} catch (err: any) {
			// Column might already exist, which is fine
			if (!err.message?.includes("already exists")) {
				console.warn("[MIGRATE] Could not add session_id column:", err.message);
			}
		}
		// ── Phase 5: waitlist table (created via schema.sql above) ─────
		try {
			await pool.query(`
				CREATE TABLE IF NOT EXISTS waitlist (
				  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
				  email      TEXT NOT NULL UNIQUE,
				  role       TEXT,
				  use_case   TEXT,
				  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
				)
			`);
			await pool.query(`
				CREATE INDEX IF NOT EXISTS idx_waitlist_email ON waitlist(email)
			`);
			await pool.query(`
				CREATE INDEX IF NOT EXISTS idx_waitlist_created_at ON waitlist(created_at)
			`);
			console.log("[MIGRATE] Waitlist table ready.");
		} catch (err: any) {
			if (!err.message?.includes("already exists")) {
				console.warn("[MIGRATE] Could not create waitlist table:", err.message);
			}
		}

		// ── Phase 6: add archived_at / deleted_at to chat_sessions ──────────
		try {
			await pool.query(`
				ALTER TABLE chat_sessions
				ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ
			`);
			console.log("[MIGRATE] Added archived_at column to chat_sessions.");
		} catch (err: any) {
			if (!err.message?.includes("already exists")) {
				console.warn(
					"[MIGRATE] Could not add archived_at column:",
					err.message,
				);
			}
		}
		try {
			await pool.query(`
				ALTER TABLE chat_sessions
				ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ
			`);
			console.log("[MIGRATE] Added deleted_at column to chat_sessions.");
		} catch (err: any) {
			if (!err.message?.includes("already exists")) {
				console.warn("[MIGRATE] Could not add deleted_at column:", err.message);
			}
		}
		try {
			await pool.query(`
				CREATE INDEX IF NOT EXISTS idx_chat_sessions_active
				ON chat_sessions (user_id)
				WHERE deleted_at IS NULL
			`);
			console.log("[MIGRATE] Created active sessions index.");
		} catch (err: any) {
			if (!err.message?.includes("already exists")) {
				console.warn(
					"[MIGRATE] Could not create active sessions index:",
					err.message,
				);
			}
		}

		// ── Phase 7: chat_session_summaries table ────────────────────────
		try {
			await pool.query(`
				CREATE TABLE IF NOT EXISTS chat_session_summaries (
				  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
				  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
				  session_id    UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
				  summary       TEXT NOT NULL,
				  last_message_id UUID REFERENCES chat_messages(id) ON DELETE SET NULL,
				  message_count INTEGER NOT NULL DEFAULT 0,
				  model         TEXT NOT NULL DEFAULT 'deepseek-v4-flash',
				  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
				  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
				  UNIQUE(session_id)
				)
			`);
			await pool.query(`
				CREATE INDEX IF NOT EXISTS idx_chat_session_summaries_user_id
				  ON chat_session_summaries (user_id)
			`);
			await pool.query(`
				CREATE INDEX IF NOT EXISTS idx_chat_session_summaries_session_id
				  ON chat_session_summaries (session_id)
			`);
			console.log("[MIGRATE] chat_session_summaries table ready.");
		} catch (err: any) {
			if (!err.message?.includes("already exists")) {
				console.warn(
					"[MIGRATE] Could not create chat_session_summaries table:",
					err.message,
				);
			}
		}

		// ── Phase 8: add admin/beta/deleted columns to users ────────────
		try {
			await pool.query(`
				ALTER TABLE users
				ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user'
			`);
			console.log("[MIGRATE] Added role column to users.");
		} catch (err: any) {
			if (!err.message?.includes("already exists")) {
				console.warn("[MIGRATE] Could not add role column:", err.message);
			}
		}
		try {
			await pool.query(`
				ALTER TABLE users
				ADD COLUMN IF NOT EXISTS beta_status TEXT NOT NULL DEFAULT 'active'
			`);
			console.log("[MIGRATE] Added beta_status column to users.");
		} catch (err: any) {
			if (!err.message?.includes("already exists")) {
				console.warn(
					"[MIGRATE] Could not add beta_status column:",
					err.message,
				);
			}
		}
		try {
			await pool.query(`
				ALTER TABLE users
				ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ
			`);
			console.log("[MIGRATE] Added deleted_at column to users.");
		} catch (err: any) {
			if (!err.message?.includes("already exists")) {
				console.warn("[MIGRATE] Could not add deleted_at column:", err.message);
			}
		}
		try {
			await pool.query(`
				CREATE INDEX IF NOT EXISTS idx_users_role ON users (role)
			`);
			console.log("[MIGRATE] Created index on users(role).");
		} catch (err: any) {
			if (!err.message?.includes("already exists")) {
				console.warn("[MIGRATE] Could not create role index:", err.message);
			}
		}
		try {
			await pool.query(`
				CREATE INDEX IF NOT EXISTS idx_users_beta_status ON users (beta_status)
			`);
			console.log("[MIGRATE] Created index on users(beta_status).");
		} catch (err: any) {
			if (!err.message?.includes("already exists")) {
				console.warn(
					"[MIGRATE] Could not create beta_status index:",
					err.message,
				);
			}
		}
		try {
			await pool.query(`
				CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users (deleted_at)
			`);
			console.log("[MIGRATE] Created index on users(deleted_at).");
		} catch (err: any) {
			if (!err.message?.includes("already exists")) {
				console.warn(
					"[MIGRATE] Could not create deleted_at index:",
					err.message,
				);
			}
		}

		// ── Phase 9: add custom instructions columns to users ─────────────
		try {
			await pool.query(`
				ALTER TABLE users
				ADD COLUMN IF NOT EXISTS custom_instructions_about_you TEXT
			`);
			console.log(
				"[MIGRATE] Added custom_instructions_about_you column to users.",
			);
		} catch (err: any) {
			if (!err.message?.includes("already exists")) {
				console.warn(
					"[MIGRATE] Could not add custom_instructions_about_you column:",
					err.message,
				);
			}
		}
		try {
			await pool.query(`
				ALTER TABLE users
				ADD COLUMN IF NOT EXISTS custom_instructions_how_to_respond TEXT
			`);
			console.log(
				"[MIGRATE] Added custom_instructions_how_to_respond column to users.",
			);
		} catch (err: any) {
			if (!err.message?.includes("already exists")) {
				console.warn(
					"[MIGRATE] Could not add custom_instructions_how_to_respond column:",
					err.message,
				);
			}
		}
		// ── Phase 10: add attachments JSONB column to chat_messages ───
		try {
			await pool.query(`
				ALTER TABLE chat_messages
				ADD COLUMN IF NOT EXISTS attachments JSONB NOT NULL DEFAULT '[]'::jsonb
			`);
			console.log("[MIGRATE] Added attachments column to chat_messages.");
		} catch (err: any) {
			if (!err.message?.includes("already exists")) {
				console.warn(
					"[MIGRATE] Could not add attachments column:",
					err.message,
				);
			}
		}

		// ── Phase 11: memories table + indexes ────────────────────────────
		try {
			await pool.query(`
				CREATE EXTENSION IF NOT EXISTS vector
			`);
			await pool.query(`
				CREATE TABLE IF NOT EXISTS memories (
				  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
				  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
				  content           TEXT NOT NULL,
				  category          TEXT NOT NULL DEFAULT \'general\',
				  importance        INTEGER NOT NULL DEFAULT 3,
				  embedding         vector(768),
				  source_session_id UUID REFERENCES chat_sessions(id) ON DELETE SET NULL,
				  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
				  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
				)
			`);
			await pool.query(`
				CREATE INDEX IF NOT EXISTS idx_memories_user_id ON memories (user_id)
			`);
			await pool.query(`
				CREATE INDEX IF NOT EXISTS idx_memories_category ON memories (category)
			`);
			console.log("[MIGRATE] memories table ready.");
		} catch (err: any) {
			if (!err.message?.includes("already exists")) {
				console.warn("[MIGRATE] Could not create memories table:", err.message);
			}
		}

		// ── Phase 12: chat_session_extractions table ──────────────────────
		try {
			await pool.query(`
				CREATE TABLE IF NOT EXISTS chat_session_extractions (
				  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
				  user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
				  session_id         UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
				  last_message_count INTEGER NOT NULL DEFAULT 0,
				  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
				  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
				  UNIQUE(session_id)
				)
			`);
			await pool.query(`
				CREATE INDEX IF NOT EXISTS idx_chat_session_extractions_user_id
				  ON chat_session_extractions (user_id)
			`);
			await pool.query(`
				CREATE INDEX IF NOT EXISTS idx_chat_session_extractions_session_id
				  ON chat_session_extractions (session_id)
			`);
			console.log("[MIGRATE] chat_session_extractions table ready.");
		} catch (err: any) {
			if (!err.message?.includes("already exists")) {
				console.warn(
					"[MIGRATE] Could not create chat_session_extractions table:",
					err.message,
				);
			}
		}

		// ── Phase 13: projects table + indexes ────────────────────────────
		try {
			await pool.query(`
				CREATE TABLE IF NOT EXISTS projects (
				  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
				  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
				  name           TEXT NOT NULL,
				  description    TEXT,
				  instructions   TEXT,
				  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
				  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
				)
			`);
			await pool.query(`
				CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects (user_id)
			`);
			console.log("[MIGRATE] projects table ready.");
		} catch (err: any) {
			if (!err.message?.includes("already exists")) {
				console.warn("[MIGRATE] Could not create projects table:", err.message);
			}
		}

		// ── Phase 14: project_knowledge + project_knowledge_chunks ────────
		try {
			await pool.query(`
				CREATE TABLE IF NOT EXISTS project_knowledge (
				  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
				  project_id     UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
				  title          TEXT,
				  source         TEXT,
				  content        TEXT NOT NULL,
				  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
				)
			`);
			await pool.query(`
				CREATE TABLE IF NOT EXISTS project_knowledge_chunks (
				  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
				  knowledge_id      UUID REFERENCES project_knowledge(id) ON DELETE CASCADE,
				  project_id        UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
				  content           TEXT NOT NULL,
				  embedding         vector(768),
				  chunk_index       INTEGER NOT NULL DEFAULT 0,
				  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
				)
			`);
			await pool.query(`
				CREATE INDEX IF NOT EXISTS idx_project_knowledge_chunks_project_id
				  ON project_knowledge_chunks (project_id)
			`);
			console.log(
				"[MIGRATE] project_knowledge + project_knowledge_chunks tables ready.",
			);
		} catch (err: any) {
			if (!err.message?.includes("already exists")) {
				console.warn(
					"[MIGRATE] Could not create project knowledge tables:",
					err.message,
				);
			}
		}

		// ── Phase 15: project_memories table + indexes ────────────────────
		try {
			await pool.query(`
				CREATE TABLE IF NOT EXISTS project_memories (
				  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
				  project_id        UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
				  memory_id         UUID REFERENCES memories(id) ON DELETE CASCADE,
				  content           TEXT NOT NULL,
				  category          TEXT NOT NULL DEFAULT \'general\',
				  importance        INTEGER NOT NULL DEFAULT 3,
				  embedding         vector(768),
				  source_session_id UUID REFERENCES chat_sessions(id) ON DELETE SET NULL,
				  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
				)
			`);
			await pool.query(`
				CREATE INDEX IF NOT EXISTS idx_project_memories_project_id
				  ON project_memories (project_id)
			`);
			await pool.query(`
				CREATE INDEX IF NOT EXISTS idx_project_memories_memory_id
				  ON project_memories (memory_id)
			`);
			console.log("[MIGRATE] project_memories table ready.");
		} catch (err: any) {
			if (!err.message?.includes("already exists")) {
				console.warn(
					"[MIGRATE] Could not create project_memories table:",
					err.message,
				);
			}
		}

		console.log("[MIGRATE] Migrations complete.");
	} finally {
		await pool.end();
	}
}
