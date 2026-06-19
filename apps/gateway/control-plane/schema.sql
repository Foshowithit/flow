-- ============================================================================
-- Flow Control Plane — Postgres Schema
-- ============================================================================
-- Run: psql $DATABASE_URL -f control-plane/schema.sql
--
-- These tables record observable long-running loops for provider evals,
-- routing health, cost monitoring, and self-host operations.
-- See docs/control-plane.md for the architectural context.
-- ============================================================================

-- ── flow_runs ──────────────────────────────────────────────────────────────
-- Top-level run record. Each probe round, health check pass, or evaluation
-- campaign creates one row.
CREATE TABLE IF NOT EXISTS flow_runs (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    run_type        TEXT        NOT NULL,
    status          TEXT        NOT NULL,
    objective       TEXT,
    progress_path   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at    TIMESTAMPTZ,
    metadata_json   JSONB       DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_flow_runs_status      ON flow_runs(status);
CREATE INDEX IF NOT EXISTS idx_flow_runs_run_type     ON flow_runs(run_type);
CREATE INDEX IF NOT EXISTS idx_flow_runs_created_at   ON flow_runs(created_at);


-- ── flow_run_events ────────────────────────────────────────────────────────
-- Each step or sub-event within a run. For example: every probe attempt,
-- every routing decision, every error.
CREATE TABLE IF NOT EXISTS flow_run_events (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id          UUID        NOT NULL REFERENCES flow_runs(id) ON DELETE CASCADE,
    event_type      TEXT        NOT NULL,
    role            TEXT,
    message         TEXT,
    evidence_json   JSONB       DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_flow_run_events_run_id   ON flow_run_events(run_id);
CREATE INDEX IF NOT EXISTS idx_flow_run_events_type     ON flow_run_events(event_type);


-- ── provider_probe_results ─────────────────────────────────────────────────
-- Individual provider probe measurements. Each row is one probe request
-- against a specific provider/model endpoint.
CREATE TABLE IF NOT EXISTS provider_probe_results (
    id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id              UUID            REFERENCES flow_runs(id) ON DELETE SET NULL,
    provider            TEXT            NOT NULL,
    model               TEXT            NOT NULL,
    status              TEXT            NOT NULL,
    latency_ms          INTEGER,
    ttft_ms             INTEGER,
    tokens_in           INTEGER,
    tokens_out          INTEGER,
    estimated_cost_usd  NUMERIC(12,6),
    error_code          TEXT,
    evidence_json       JSONB           DEFAULT '{}'::jsonb,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_probe_results_provider  ON provider_probe_results(provider);
CREATE INDEX IF NOT EXISTS idx_probe_results_model     ON provider_probe_results(model);
CREATE INDEX IF NOT EXISTS idx_probe_results_status    ON provider_probe_results(status);
CREATE INDEX IF NOT EXISTS idx_probe_results_created   ON provider_probe_results(created_at);


-- ── provider_route_scores ──────────────────────────────────────────────────
-- Health scores for each provider route. Updated periodically by health-check
-- loops or derived from recent probe results.
CREATE TABLE IF NOT EXISTS provider_route_scores (
    id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    provider            TEXT            NOT NULL,
    model               TEXT            NOT NULL,
    score               NUMERIC(8,4),
    latency_p50_ms      INTEGER,
    latency_p95_ms      INTEGER,
    success_rate        NUMERIC(6,4),
    cost_per_1m_input   NUMERIC(12,6),
    cost_per_1m_output  NUMERIC(12,6),
    notes               TEXT,
    evidence_json       JSONB           DEFAULT '{}'::jsonb,
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_route_scores_provider   ON provider_route_scores(provider);
CREATE INDEX IF NOT EXISTS idx_route_scores_model      ON provider_route_scores(model);
CREATE INDEX IF NOT EXISTS idx_route_scores_updated    ON provider_route_scores(updated_at);
