-- TrustShield Sandbox — controlled, defensive training/demonstration runs.
-- Fully separate from the production `scans` / `scan_signals` tables so that
-- clearing sandbox data can never touch real scan history.
-- Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS sandbox_runs (
  id                 SERIAL PRIMARY KEY,
  input_type         TEXT NOT NULL CHECK (input_type IN ('url','email','message','qr','custom')),
  input_content      TEXT,
  risk_score         INTEGER NOT NULL CHECK (risk_score BETWEEN 0 AND 100),
  classification     TEXT NOT NULL CHECK (classification IN ('SAFE','SUSPICIOUS','HIGH_RISK')),
  threat_category    TEXT NOT NULL,
  confidence         NUMERIC(4,3) NOT NULL DEFAULT 0 CHECK (confidence BETWEEN 0 AND 1),
  explanation        TEXT NOT NULL,
  recommended_action TEXT NOT NULL,
  scenario_id        TEXT,
  signals            JSONB NOT NULL DEFAULT '[]'::jsonb,
  attack_chain       JSONB NOT NULL DEFAULT '[]'::jsonb,
  correlation        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sandbox_runs_created_at ON sandbox_runs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sandbox_runs_input_type ON sandbox_runs(input_type);
CREATE INDEX IF NOT EXISTS idx_sandbox_runs_classification ON sandbox_runs(classification);

CREATE TABLE IF NOT EXISTS sandbox_evidence (
  id             SERIAL PRIMARY KEY,
  sandbox_run_id INTEGER NOT NULL REFERENCES sandbox_runs(id) ON DELETE CASCADE,
  evidence_type  TEXT NOT NULL,
  value          TEXT NOT NULL,
  source         TEXT NOT NULL,
  confidence     NUMERIC(4,3) NOT NULL DEFAULT 0 CHECK (confidence BETWEEN 0 AND 1),
  metadata       JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sandbox_evidence_run_id ON sandbox_evidence(sandbox_run_id);
