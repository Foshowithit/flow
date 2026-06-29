-- ─── Flow SaaS — Neon Database Schema ─────────────────────────────────────────
-- Run via: npx tsx scripts/migrate.ts
-- Requires DATABASE_URL environment variable to be set.

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Users ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_id   TEXT UNIQUE NOT NULL,
  email      TEXT NOT NULL,
  first_name TEXT,
  last_name  TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  role        TEXT NOT NULL DEFAULT 'user',
  beta_status TEXT NOT NULL DEFAULT 'active',
  deleted_at  TIMESTAMPTZ,
  custom_instructions_about_you TEXT,
  custom_instructions_how_to_respond TEXT

CREATE INDEX IF NOT EXISTS idx_users_clerk_id ON users (clerk_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);
CREATE INDEX IF NOT EXISTS idx_users_beta_status ON users (beta_status);
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users (deleted_at);

-- ─── Subscriptions ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscriptions (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT,
  stripe_customer_id     TEXT,
  status                 TEXT NOT NULL DEFAULT 'inactive',
  plan                   TEXT NOT NULL DEFAULT 'free',
  current_period_end     TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions (user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer ON subscriptions (stripe_customer_id);

-- ─── API Keys ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS api_keys (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider   TEXT NOT NULL,
  key_hash   TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  label      TEXT,
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys (user_id);

-- ─── Usage Records ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS usage_records (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id UUID REFERENCES chat_sessions(id) ON DELETE SET NULL,
  model      TEXT NOT NULL,
  tokens_in  INTEGER NOT NULL DEFAULT 0,
  tokens_out INTEGER NOT NULL DEFAULT 0,
  cost_cents INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_usage_records_user_id ON usage_records (user_id);
CREATE INDEX IF NOT EXISTS idx_usage_records_created_at ON usage_records (created_at);

-- ─── Chat Sessions ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_sessions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL DEFAULT 'New Chat',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions (user_id);

-- Add archived_at / deleted_at columns (idempotent)
ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_chat_sessions_active
  ON chat_sessions (user_id)
  WHERE deleted_at IS NULL;

-- ─── Chat Messages ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role       TEXT NOT NULL,
  content    TEXT NOT NULL,
  tokens_in  INTEGER NOT NULL DEFAULT 0,
  tokens_out INTEGER NOT NULL DEFAULT 0,
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages (session_id);

-- ─── Waitlist Signups ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS waitlist (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email      TEXT NOT NULL UNIQUE,
  role       TEXT,
  use_case   TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_waitlist_email ON waitlist(email);
CREATE INDEX IF NOT EXISTS idx_waitlist_created_at ON waitlist(created_at);

-- ─── Chat Session Summaries ────────────────────────────────────────
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
);

CREATE INDEX IF NOT EXISTS idx_chat_session_summaries_user_id
  ON chat_session_summaries (user_id);

CREATE INDEX IF NOT EXISTS idx_chat_session_summaries_session_id
  ON chat_session_summaries (session_id);

-- ─── Memories (cross-session memory facts) ───────────────────────────
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS memories (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content           TEXT NOT NULL,
  category          TEXT NOT NULL DEFAULT 'general',
  importance        INTEGER NOT NULL DEFAULT 3,
  embedding         vector(1536),
  source_session_id UUID REFERENCES chat_sessions(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_memories_user_id ON memories (user_id);
CREATE INDEX IF NOT EXISTS idx_memories_category ON memories (category);

-- ─── Chat Session Extractions (extraction progress tracking) ─────────
CREATE TABLE IF NOT EXISTS chat_session_extractions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id         UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  last_message_count INTEGER NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(session_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_session_extractions_user_id
  ON chat_session_extractions (user_id);

CREATE INDEX IF NOT EXISTS idx_chat_session_extractions_session_id
  ON chat_session_extractions (session_id);

-- ─── Projects ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projects (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  description    TEXT,
  instructions   TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects (user_id);

-- ─── Project Knowledge (source documents) ────────────────────────────
CREATE TABLE IF NOT EXISTS project_knowledge (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id     UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title          TEXT,
  source         TEXT,
  content        TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Project Knowledge Chunks (embedded chunks) ──────────────────────
CREATE TABLE IF NOT EXISTS project_knowledge_chunks (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_id      UUID REFERENCES project_knowledge(id) ON DELETE CASCADE,
  project_id        UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  content           TEXT NOT NULL,
  embedding         vector(1536),
  chunk_index       INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_knowledge_chunks_project_id
  ON project_knowledge_chunks (project_id);

-- ─── Project Memories (memories scoped to a project) ─────────────────
CREATE TABLE IF NOT EXISTS project_memories (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  memory_id         UUID REFERENCES memories(id) ON DELETE CASCADE,
  content           TEXT NOT NULL,
  category          TEXT NOT NULL DEFAULT 'general',
  importance        INTEGER NOT NULL DEFAULT 3,
  embedding         vector(1536),
  source_session_id UUID REFERENCES chat_sessions(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_memories_project_id
  ON project_memories (project_id);

CREATE INDEX IF NOT EXISTS idx_project_memories_memory_id
  ON project_memories (memory_id);
