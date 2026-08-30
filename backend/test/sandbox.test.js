import { describe, it, expect } from 'vitest';
import {
  analyzeSandbox, diffRuns, validateInput, MAX_CONTENT_LEN, SUPPORTED_TYPES
} from '../src/services/sandboxService.js';
import { buildAttackChain, buildCorrelation } from '../src/services/trustshield/attackChain.js';

const codes = (r) => r.signals.map(s => s.code);

describe('Sandbox input validation', () => {
  it('accepts every supported input type name', () => {
    expect(SUPPORTED_TYPES).toEqual(['url', 'email', 'message', 'qr', 'custom']);
  });
  it('rejects empty content', () => {
    expect(() => validateInput('message', '')).toThrow();
    expect(() => validateInput('message', '   ')).toThrow();
  });
  it('rejects unsupported input type', () => {
    expect(() => validateInput('webhook', 'hello world')).toThrow(/Unsupported/);
  });
  it('rejects oversized input', () => {
    expect(() => validateInput('message', 'a'.repeat(MAX_CONTENT_LEN + 1))).toThrow(/exceeds/);
  });
});

describe('Sandbox analyze — safe content', () => {
  it('rates a benign banking notification as SAFE with no signals', async () => {
    const r = await analyzeSandbox({ inputType: 'message', content: 'Your monthly bank statement is ready. Log in through your usual banking app.' });
    expect(r.classification).toBe('SAFE');
    expect(r.riskScore).toBeLessThanOrEqual(29);
    expect(r.signals.length).toBe(0);
    expect(r.attackChain.length).toBe(0);
  });
});

describe('Sandbox analyze — phishing message', () => {
  it('detects urgency + suspension + OTP and builds an attack chain + correlation', async () => {
    const r = await analyzeSandbox({
      inputType: 'message',
      content: 'URGENT: Your account will be suspended today. Verify immediately and share your OTP.'
    });
    expect(['SUSPICIOUS', 'HIGH_RISK']).toContain(r.classification);
    expect(codes(r)).toEqual(expect.arrayContaining(['URGENCY', 'ACCOUNT_SUSPENSION', 'OTP_REQUEST']));
    // evidence-first: every signal has matching evidence
    expect(r.evidence.length).toBe(r.signals.length);
    for (const e of r.evidence) {
      expect(typeof e.value).toBe('string');
      expect(e.confidence).toBeGreaterThan(0);
      expect(e.source).toBeTruthy();
    }
    // attack chain has delivery + at least one substantive stage
    expect(r.attackChain.length).toBeGreaterThanOrEqual(2);
    expect(r.attackChain[0].stage).toBe('delivery');
    // correlation explains the combination
    expect(r.correlation.summary).toMatch(/combination|reinforce|pattern/i);
    expect(r.correlation.patternStrength).not.toBe('none');
    // confidence bounded 0..1
    expect(r.confidence).toBeGreaterThan(0);
    expect(r.confidence).toBeLessThanOrEqual(1);
  });
});

describe('Sandbox analyze — suspicious URL', () => {
  it('flags brand impersonation on a look-alike domain', async () => {
    const r = await analyzeSandbox({ inputType: 'url', content: 'http://paypa1.com/login/verify-account' });
    expect(codes(r)).toContain('BRAND_IMPERSONATION');
    expect(['SUSPICIOUS', 'HIGH_RISK']).toContain(r.classification);
  });
  it('rejects a malformed URL', async () => {
    await expect(analyzeSandbox({ inputType: 'url', content: 'not a url at all' })).rejects.toThrow();
  });
});

describe('Sandbox analyze — email scam', () => {
  it('detects a KYC/refund email scam', async () => {
    const r = await analyzeSandbox({
      inputType: 'email',
      content: 'Dear Customer, you are owed a refund. Confirm your bank account number and complete your KYC at http://tax-refund.example/claim within 24 hours.'
    });
    expect(['SUSPICIOUS', 'HIGH_RISK']).toContain(r.classification);
    expect(codes(r)).toContain('FINANCIAL_REQUEST');
  });
});

describe('Sandbox analyze — QR decoded text', () => {
  it('analyzes the decoded destination statically and returns it', async () => {
    const r = await analyzeSandbox({ inputType: 'qr', content: 'http://paypa1-secure.example/payment/verify' });
    expect(r.decodedDestination).toBe('http://paypa1-secure.example/payment/verify');
    expect(r.inputType).toBe('qr');
  });
});

describe('Sandbox compare (diffRuns)', () => {
  it('explains which extra signals make one scenario riskier', async () => {
    const a = await analyzeSandbox({ inputType: 'message', content: 'Your monthly bank statement is ready. Log in through your usual banking app.' });
    const b = await analyzeSandbox({ inputType: 'message', content: 'URGENT! Your account will be suspended. Verify immediately and share the OTP.' });
    const d = diffRuns(a, b);
    expect(d.scoreDelta).toBeGreaterThan(0);
    expect(d.uniqueToB.length).toBeGreaterThan(0);
    expect(d.summary).toMatch(/scored/i);
  });
});

describe('Attack chain / correlation units', () => {
  it('returns an empty chain when fewer than two stages exist', () => {
    expect(buildAttackChain('message', [])).toEqual([]);
  });
  it('never hardcodes — chain reflects the categories present', () => {
    const signals = [
      { code: 'CREDENTIAL_REQUEST', name: 'Credential request', severity: 'HIGH', category: 'PHISHING', reason: 'x' }
    ];
    const chain = buildAttackChain('email', signals);
    const stages = chain.map(c => c.stage);
    expect(stages).toContain('delivery');
    expect(stages).toContain('credential_theft');
    expect(stages).toContain('impact');
    expect(stages).not.toContain('financial_fraud');
  });
  it('correlation for a single signal is flagged weak', () => {
    const c = buildCorrelation([{ code: 'URGENCY', name: 'Urgency pressure', severity: 'MEDIUM', category: 'SUSPICIOUS_CONTENT', reason: 'x' }], 'SUSPICIOUS_CONTENT');
    expect(c.patternStrength).toBe('weak');
  });
});
