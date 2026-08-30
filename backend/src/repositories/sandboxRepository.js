import { query, getClient } from '../utils/db.js';

// Persist a sandbox run plus its evidence in a single transaction.
// Signals, attack-chain and correlation are stored as JSONB on the run row so we
// do NOT duplicate the production scan_signals table (spec: reuse, don't duplicate).
export async function saveRun({ inputType, inputContent, scenarioId = null, result }) {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO sandbox_runs
         (input_type, input_content, scenario_id, risk_score, classification, threat_category,
          confidence, explanation, recommended_action, signals, attack_chain, correlation)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING id, created_at`,
      [
        inputType,
        (inputContent || '').slice(0, 20000),
        scenarioId,
        result.riskScore,
        result.classification,
        result.threatCategory,
        result.confidence,
        result.explanation,
        result.recommendedAction,
        JSON.stringify(result.signals || []),
        JSON.stringify(result.attackChain || []),
        JSON.stringify(result.correlation || {})
      ]
    );
    const runId = rows[0].id;

    for (const e of (result.evidence || [])) {
      await client.query(
        `INSERT INTO sandbox_evidence (sandbox_run_id, evidence_type, value, source, confidence, metadata)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [runId, e.evidenceType, e.value, e.source, e.confidence, JSON.stringify(e.metadata || {})]
      );
    }

    await client.query('COMMIT');
    return { id: runId, createdAt: rows[0].created_at };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function listRuns(limit = 25, offset = 0) {
  const { rows } = await query(
    `SELECT id, input_type, scenario_id, risk_score, classification, threat_category, confidence, created_at
     FROM sandbox_runs ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
    [Math.min(limit, 100), offset]
  );
  return rows.map(mapSummary);
}

export async function getRunById(id) {
  const { rows } = await query('SELECT * FROM sandbox_runs WHERE id = $1', [id]);
  if (!rows.length) return null;
  const { rows: evRows } = await query(
    `SELECT evidence_type, value, source, confidence, metadata
     FROM sandbox_evidence WHERE sandbox_run_id = $1 ORDER BY id`,
    [id]
  );
  return mapFull(rows[0], evRows);
}

// Clear ONLY sandbox data. Production scans are never touched (separate tables).
export async function clearAllRuns() {
  const { rowCount } = await query('DELETE FROM sandbox_runs');
  return rowCount;
}

function mapSummary(r) {
  return {
    id: r.id,
    inputType: r.input_type,
    scenarioId: r.scenario_id,
    riskScore: r.risk_score,
    classification: r.classification,
    threatCategory: r.threat_category,
    confidence: Number(r.confidence),
    createdAt: r.created_at
  };
}

function mapFull(r, evRows) {
  return {
    id: r.id,
    inputType: r.input_type,
    inputContent: r.input_content,
    scenarioId: r.scenario_id,
    riskScore: r.risk_score,
    classification: r.classification,
    threatCategory: r.threat_category,
    confidence: Number(r.confidence),
    explanation: r.explanation,
    recommendedAction: r.recommended_action,
    signals: r.signals || [],
    attackChain: r.attack_chain || [],
    correlation: r.correlation || {},
    evidence: evRows.map(e => ({
      evidenceType: e.evidence_type,
      value: e.value,
      source: e.source,
      confidence: Number(e.confidence),
      metadata: e.metadata || {}
    })),
    createdAt: r.created_at
  };
}
