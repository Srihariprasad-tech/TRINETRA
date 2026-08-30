import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { analyzeSandbox } from '../src/services/sandboxService.js';
import * as repo from '../src/repositories/sandboxRepository.js';
import pool, { query } from '../src/utils/db.js';

// DB-backed persistence tests. Skipped automatically if PostgreSQL is not
// reachable (e.g. a CI box without a database), so the suite never hard-fails.
let dbUp = false;
const created = [];

beforeAll(async () => {
  try {
    await query('SELECT 1');
    dbUp = true;
  } catch {
    dbUp = false;
  }
});

afterAll(async () => {
  if (dbUp) {
    for (const id of created) {
      try { await query('DELETE FROM sandbox_runs WHERE id = $1', [id]); } catch { /* ignore */ }
    }
  }
  await pool.end().catch(() => {});
});

describe('Sandbox persistence', () => {
  it('persists a run + its signals + evidence and reads them back', async () => {
    if (!dbUp) return; // soft-skip when no DB
    const result = await analyzeSandbox({
      inputType: 'message',
      content: 'URGENT: verify your account immediately and share your OTP to avoid suspension.'
    });
    const saved = await repo.saveRun({ inputType: 'message', inputContent: 'test content', result });
    created.push(saved.id);
    expect(saved.id).toBeGreaterThan(0);

    const full = await repo.getRunById(saved.id);
    expect(full).not.toBeNull();
    expect(full.riskScore).toBe(result.riskScore);
    expect(full.classification).toBe(result.classification);
    // signals persisted as JSONB and read back intact
    expect(full.signals.length).toBe(result.signals.length);
    // evidence persisted in its own table
    expect(full.evidence.length).toBe(result.evidence.length);
    // attack chain persisted
    expect(Array.isArray(full.attackChain)).toBe(true);
  });

  it('lists recent runs (newest first)', async () => {
    if (!dbUp) return;
    const runs = await repo.listRuns(5, 0);
    expect(Array.isArray(runs)).toBe(true);
  });

  it('returns null for a missing run id', async () => {
    if (!dbUp) return;
    expect(await repo.getRunById(999999999)).toBeNull();
  });
});
