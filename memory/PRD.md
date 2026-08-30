# TrustShield — PRD & Build Log

## Product
TrustShield: AI-powered digital fraud detection & digital trust platform.
Stack: React + Vite (frontend, port 5175) · Node.js + Express (backend, port 4000) ·
PostgreSQL (`nexnetra`) · Python ML micro-service (port 5001, optional/fails-open).

## Existing (pre-feature) capabilities — UNCHANGED
- Scanners: URL, Email, Message, QR (rule-based engine in `backend/src/services/trustshield/`).
- Explainable risk engine: riskScore, classification, threatCategory, explanation,
  recommendedAction, signals (central `SIGNAL_DEFS` catalog).
- Persistence: `scans` + `scan_signals` tables. Dashboard + scan history.
- Migrations under `backend/migrations/` (001–003).

---

## FEATURE (2026-06): TrustShield Sandbox — DELIVERED

Defensive, analysis-only training/demonstration environment. Reuses the EXISTING
risk engine — no second detection system, no external calls, no ML/LLM added.

### What was implemented
- **Backend service layer** (`sandboxService.js`) orchestrating the existing analyzers
  → adds per-signal **evidence**, **attack-chain reconstruction**, **cross-signal correlation**, deterministic **confidence** score.
- **Attack-chain + correlation** (`trustshield/attackChain.js`) — generated dynamically
  from detected signal categories (never hardcoded); inferred impact stage.
- **Scenario catalog** (`services/sandbox/scenarios.js`) — 10 safe synthetic scenarios,
  difficulty tiers (beginner/intermediate/advanced), reserved `.test`/`.example` domains.
- **Persistence** (`sandboxRepository.js`) → new tables `sandbox_runs` (+ signals/chain/
  correlation as JSONB) and `sandbox_evidence`. Fully separate from production `scans`.
- **Routes** (`sandboxRoutes.js`, mounted at `/api/sandbox`): analyze, compare, scenarios,
  runs (list/detail), clear history. Dedicated rate-limiter (40/min) on analyze/compare.
- **Frontend**: `/sandbox` and `/sandbox/compare`; new sidebar "Sandbox" nav. Reuses
  existing ScoreRing / risk helpers / ui components / theme.

### Validation (all passing)
- Backend: 40 vitest tests (15 existing + 25 new). Frontend: 7 vitest tests (2+5 new).
- `vite build` OK. Migration 004 applies idempotently.
- API smoke via preview ingress: analyze/compare/scenarios/runs/edge-cases/404/persistence.
- Regression: URL/Email/Message/QR scanners, dashboard, history still work.
- No .env committed (git-ignored); no hardcoded secrets; no external URLs contacted.

### Files
Created: `backend/migrations/004_sandbox.sql`, `backend/src/services/sandboxService.js`,
`backend/src/services/sandbox/scenarios.js`, `backend/src/services/trustshield/attackChain.js`,
`backend/src/repositories/sandboxRepository.js`, `backend/src/routes/sandboxRoutes.js`,
`backend/test/sandbox.test.js`, `backend/test/sandbox.repo.test.js`,
`frontend/src/trustshield/pages/Sandbox.jsx`, `frontend/src/trustshield/pages/SandboxCompare.jsx`,
`frontend/src/trustshield/components/SandboxResult.jsx`, `frontend/src/trustshield/components/AttackChain.jsx`,
`frontend/src/trustshield/pages/__tests__/Sandbox.test.jsx`.
Modified (minimal, non-breaking): `backend/src/server.js`,
`backend/src/services/trustshield/index.js` (export `mlUrlSignal`),
`backend/src/services/trustshield/contentSignals.js` (add `contentEvidence`),
`frontend/src/trustshield/TrustShieldRouter.jsx` + `components/Layout.jsx`.

## Run commands
```
npm install
npm run migrate            # applies 001–004
npm run dev:all            # backend :4000 + frontend :5175
# tests: (backend) cd backend && npx vitest run  |  (frontend) cd frontend && npx vitest run
```

## Backlog / future
- P1: Educational scenario walkthrough overlay (step-through the pipeline).
- P2: Export a sandbox run as a shareable PDF/JSON report.
- P2: Optional live URL reputation (behind SSRF-safe fetch) — currently offline only.
