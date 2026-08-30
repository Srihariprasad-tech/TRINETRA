// TrustShield Sandbox service.
//
// This is a thin, DEFENSIVE orchestration layer. It does NOT contain its own
// detection logic — it reuses the exact same analyzers and risk engine used by
// the production scanners (trustshield/*), then adds sandbox-only presentation:
// per-signal evidence, an attack-chain, and cross-signal correlation.
//
// It NEVER opens URLs, executes content, or contacts external destinations
// (URL analysis is fully offline; the optional ML call is a local service that
// fails open). QR/URL content is analyzed statically as text only.

import { analyzeUrlString } from './trustshield/urlAnalyzer.js';
import { analyzeContent, contentEvidence } from './trustshield/contentSignals.js';
import { buildResult } from './trustshield/riskEngine.js';
import { mlUrlSignal } from './trustshield/index.js';
import { SIGNAL_DEFS } from './trustshield/constants.js';
import { buildAttackChain, buildCorrelation } from './trustshield/attackChain.js';

export const SUPPORTED_TYPES = ['url', 'email', 'message', 'qr', 'custom'];
export const MAX_CONTENT_LEN = 20000;

const SEV_CONF = { HIGH: 0.9, MEDIUM: 0.75, LOW: 0.55 };

// Signals whose primary evidence is the URL/host itself.
const URL_SIGNAL_CODES = new Set([
  'IP_HOSTNAME', 'NO_HTTPS', 'PUNYCODE_DOMAIN', 'AT_SYMBOL_OBFUSCATION', 'SUSPICIOUS_ENCODING',
  'LONG_URL', 'EXCESSIVE_SUBDOMAINS', 'CREDENTIAL_KEYWORDS', 'PAYMENT_KEYWORDS',
  'SUSPICIOUS_TLD', 'BRAND_IMPERSONATION', 'SUSPICIOUS_LINK'
]);

export function validateInput(inputType, content) {
  if (!SUPPORTED_TYPES.includes(inputType)) {
    const e = new Error(`Unsupported inputType "${inputType}". Supported: ${SUPPORTED_TYPES.join(', ')}.`);
    e.status = 400; throw e;
  }
  if (typeof content !== 'string' || !content.trim()) {
    const e = new Error('A non-empty "content" string is required.');
    e.status = 400; throw e;
  }
  if (content.length > MAX_CONTENT_LEN) {
    const e = new Error(`Content exceeds the ${MAX_CONTENT_LEN}-character sandbox limit.`);
    e.status = 400; throw e;
  }
}

function looksLikeUrl(text) {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(text) || /^[a-z0-9-]+(\.[a-z0-9-]+)+/i.test(text);
}

// Route the input to the correct EXISTING analyzer. Returns raw internal signals
// (which still carry category + reason) plus context.
async function runEngine(inputType, content) {
  if (inputType === 'url') {
    const { signals, host, parsed, invalid } = analyzeUrlString(content);
    if (invalid) { const e = new Error('Invalid URL format.'); e.status = 400; throw e; }
    const { signal } = await mlUrlSignal(parsed);
    return { rawSignals: signal ? [...signals, signal] : signals, host, resultType: 'url', decoded: null };
  }

  if (inputType === 'qr') {
    const text = content.trim();
    if (looksLikeUrl(text)) {
      const { signals, host, parsed, invalid } = analyzeUrlString(text);
      if (!invalid) {
        const { signal } = await mlUrlSignal(parsed);
        return { rawSignals: signal ? [...signals, signal] : signals, host, resultType: 'qr', decoded: text };
      }
    }
    return { rawSignals: analyzeContent(text), host: null, resultType: 'qr', decoded: text };
  }

  // email / message / custom → shared content analysis
  return {
    rawSignals: analyzeContent(content),
    host: null,
    resultType: inputType === 'custom' ? 'message' : inputType,
    decoded: null
  };
}

function enrich(signal) {
  const def = SIGNAL_DEFS[signal.code] || {};
  return {
    ...signal,
    category: def.category || 'SUSPICIOUS_CONTENT',
    reason: def.reason || signal.name.toLowerCase()
  };
}

function buildEvidence(inputType, host, enriched, contentEvid) {
  const evMap = new Map(contentEvid.map(e => [e.code, e]));
  return enriched.map(s => {
    let value, source;
    const cm = evMap.get(s.code);
    if (cm) { value = cm.phrase; source = 'content_analyzer'; }
    else if (s.code === 'ML_MODEL_RISK') { value = 'URL structural features'; source = 'ml_model'; }
    else if (URL_SIGNAL_CODES.has(s.code)) { value = host || s.reason; source = 'url_analyzer'; }
    else { value = s.reason; source = 'content_analyzer'; }
    return {
      code: s.code,
      signalName: s.name,
      evidenceType: cm ? 'matched_phrase' : 'signal_reason',
      value: String(value ?? s.reason).slice(0, 300),
      source,
      confidence: SEV_CONF[s.severity] ?? 0.6,
      metadata: { severity: s.severity, category: s.category, scoreContribution: s.scoreContribution }
    };
  });
}

// Overall confidence in the classification, derived deterministically from the
// number and strength of corroborating signals (explainable, no black box).
function computeConfidence(enriched) {
  if (!enriched.length) return 0.8; // confident the content looks clean
  const distinctCategories = new Set(enriched.map(s => s.category)).size;
  const highs = enriched.filter(s => s.severity === 'HIGH').length;
  const c = 0.55 + 0.05 * enriched.length + 0.05 * distinctCategories + 0.05 * highs;
  return Math.min(0.98, Math.round(c * 1000) / 1000);
}

// Run one input through the full pipeline. Returns the sandbox result object
// (NOT persisted — the route/repository persists it).
export async function analyzeSandbox({ inputType, content, scenarioId = null }) {
  validateInput(inputType, content);
  const { rawSignals, host, resultType, decoded } = await runEngine(inputType, content);
  const result = buildResult(resultType, rawSignals);
  const enriched = result.signals.map(enrich);
  const contentEvid = inputType === 'url' ? [] : contentEvidence(content);
  const evidence = buildEvidence(inputType, host, enriched, contentEvid);

  return {
    inputType,
    scenarioId,
    riskScore: result.riskScore,
    classification: result.classification,
    threatCategory: result.threatCategory,
    confidence: computeConfidence(enriched),
    explanation: result.explanation,
    recommendedAction: result.recommendedAction,
    decodedDestination: decoded,
    signals: enriched,
    evidence,
    attackChain: buildAttackChain(inputType, enriched),
    correlation: buildCorrelation(enriched, result.threatCategory)
  };
}

// Compare two already-analyzed sandbox results and explain the difference.
export function diffRuns(a, b) {
  const codesA = new Set(a.signals.map(s => s.code));
  const codesB = new Set(b.signals.map(s => s.code));
  const lookup = (code) =>
    a.signals.find(s => s.code === code) || b.signals.find(s => s.code === code) || { code };
  const toRow = (code) => {
    const s = lookup(code);
    return { code, name: s.name || code, severity: s.severity, scoreContribution: s.scoreContribution };
  };

  const shared = [...codesA].filter(c => codesB.has(c)).map(toRow);
  const uniqueToA = [...codesA].filter(c => !codesB.has(c)).map(toRow);
  const uniqueToB = [...codesB].filter(c => !codesA.has(c)).map(toRow);

  return {
    scoreDelta: b.riskScore - a.riskScore,
    sharedSignals: shared,
    uniqueToA,
    uniqueToB,
    summary: buildCompareSummary(a, b, uniqueToA, uniqueToB)
  };
}

function buildCompareSummary(a, b, uniqueToA, uniqueToB) {
  const higher = b.riskScore >= a.riskScore ? { key: 'B', run: b, extra: uniqueToB }
    : { key: 'A', run: a, extra: uniqueToA };
  if (a.riskScore === b.riskScore) {
    return `Both scenarios scored ${a.riskScore}/100 (${a.classification}). Their detected signals are largely equivalent.`;
  }
  const extraNames = higher.extra.map(s => s.name.toLowerCase());
  const reason = extraNames.length
    ? `The higher-risk scenario additionally triggered ${extraNames.length === 1 ? extraNames[0] : extraNames.slice(0, -1).join(', ') + ' and ' + extraNames.slice(-1)}.`
    : 'The difference comes from stronger individual signal contributions rather than new signal types.';
  return `Scenario ${higher.key} scored ${higher.run.riskScore}/100 (${higher.run.classification}) versus ` +
    `${(higher.key === 'B' ? a : b).riskScore}/100 (${(higher.key === 'B' ? a : b).classification}). ${reason}`;
}
