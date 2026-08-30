import express from 'express';
import rateLimit from 'express-rate-limit';
import { analyzeSandbox, diffRuns, MAX_CONTENT_LEN, SUPPORTED_TYPES } from '../services/sandboxService.js';
import { SCENARIOS, getScenario } from '../services/sandbox/scenarios.js';
import * as repo from '../repositories/sandboxRepository.js';

const router = express.Router();

// Dedicated, stricter limiter for the compute-bearing analyze endpoints, on top
// of the global API limiter. Prevents abuse / DoS of the sandbox pipeline.
const analyzeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many sandbox analyses. Please wait a minute and try again.' }
});

function badRequest(res, message) {
  return res.status(400).json({ error: message });
}

// GET /api/sandbox/scenarios — prebuilt safe scenario catalog.
router.get('/scenarios', (req, res) => {
  res.json({ scenarios: SCENARIOS, supportedTypes: SUPPORTED_TYPES, maxContentLength: MAX_CONTENT_LEN });
});

// POST /api/sandbox/analyze — run one scenario through the analysis pipeline.
router.post('/analyze', analyzeLimiter, async (req, res, next) => {
  try {
    const { inputType, content, scenarioId } = req.body || {};
    if (typeof inputType !== 'string') return badRequest(res, 'An "inputType" string is required.');
    const result = await analyzeSandbox({ inputType, content, scenarioId: scenarioId || null });
    const saved = await repo.saveRun({ inputType, inputContent: content, scenarioId: scenarioId || null, result });
    return res.status(201).json({ sandboxRunId: saved.id, createdAt: saved.createdAt, ...result });
  } catch (err) {
    if (err.status === 400) return badRequest(res, err.message);
    next(err);
  }
});

// POST /api/sandbox/compare — run two scenarios and explain the difference.
router.post('/compare', analyzeLimiter, async (req, res, next) => {
  try {
    const { scenarioA, scenarioB } = req.body || {};
    if (!scenarioA || !scenarioB) return badRequest(res, 'Both "scenarioA" and "scenarioB" objects are required.');
    const a = await analyzeSandbox({ inputType: scenarioA.inputType, content: scenarioA.content });
    const b = await analyzeSandbox({ inputType: scenarioB.inputType, content: scenarioB.content });
    const [savedA, savedB] = await Promise.all([
      repo.saveRun({ inputType: scenarioA.inputType, inputContent: scenarioA.content, result: a }),
      repo.saveRun({ inputType: scenarioB.inputType, inputContent: scenarioB.content, result: b })
    ]);
    return res.status(201).json({
      scenarioA: { sandboxRunId: savedA.id, ...a },
      scenarioB: { sandboxRunId: savedB.id, ...b },
      comparison: diffRuns(a, b)
    });
  } catch (err) {
    if (err.status === 400) return badRequest(res, err.message);
    next(err);
  }
});

// GET /api/sandbox/runs — recent sandbox history.
router.get('/runs', async (req, res, next) => {
  try {
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 25));
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
    return res.json(await repo.listRuns(limit, offset));
  } catch (err) { next(err); }
});

// GET /api/sandbox/runs/:id — full detail of a past run.
router.get('/runs/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return badRequest(res, 'Invalid run id.');
    const run = await repo.getRunById(id);
    if (!run) return res.status(404).json({ error: 'Sandbox run not found.' });
    return res.json(run);
  } catch (err) { next(err); }
});

// DELETE /api/sandbox/runs — clear ONLY sandbox history (never production scans).
router.delete('/runs', async (req, res, next) => {
  try {
    const deleted = await repo.clearAllRuns();
    return res.json({ deleted });
  } catch (err) { next(err); }
});

export default router;
