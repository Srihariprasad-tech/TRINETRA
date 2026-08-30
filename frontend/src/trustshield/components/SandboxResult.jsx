import { AlertTriangle, ShieldCheck, ShieldAlert, Info, ArrowRight, Layers, Search, GitBranch } from 'lucide-react';
import ScoreRing from './ScoreRing';
import AttackChain from './AttackChain';
import { classificationMeta, severityMeta, prettyCategory } from '../lib/risk';

const ICONS = { SAFE: ShieldCheck, SUSPICIOUS: ShieldAlert, HIGH_RISK: AlertTriangle };

// Full sandbox result. Evidence-first: every conclusion is backed by the
// signal, its score contribution, the matched evidence, source and confidence.
export default function SandboxResult({ result }) {
  if (!result) return null;
  const meta = classificationMeta(result.classification);
  const Icon = ICONS[result.classification] || Info;
  const signals = result.signals || [];
  const evidence = result.evidence || [];
  const correlation = result.correlation || {};
  const confidencePct = Math.round((result.confidence ?? 0) * 100);

  return (
    <div style={{ display: 'grid', gap: 16 }} data-testid="sandbox-result">
      {/* Header / summary */}
      <div className="ts-card ts-fade-in" style={{ overflow: 'hidden', borderColor: meta.ring + '55' }}>
        <div style={{ padding: '22px 24px', display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap',
          background: `linear-gradient(90deg, ${meta.glow}, transparent)` }}>
          <ScoreRing score={result.riskScore} classification={result.classification} size={128} />
          <div style={{ flex: 1, minWidth: 220 }}>
            <div className="ts-chip" data-testid="result-classification"
              style={{ color: meta.color, borderColor: meta.ring + '66', background: meta.glow }}>
              <Icon size={15} /> {meta.label.toUpperCase()}
            </div>
            <h2 style={{ margin: '12px 0 4px', fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em' }} data-testid="result-category">
              {prettyCategory(result.threatCategory)}
            </h2>
            <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', color: 'var(--ts-muted)', fontSize: 13.5 }}>
              <span>Threat: <span className="ts-mono" style={{ color: 'var(--ts-text)' }}>{result.threatCategory}</span></span>
              <span data-testid="result-confidence">Confidence: <span className="ts-mono" style={{ color: 'var(--ts-text)' }}>{confidencePct}%</span></span>
              <span data-testid="result-signal-count">Signals: <span className="ts-mono" style={{ color: 'var(--ts-text)' }}>{signals.length}</span></span>
            </div>
          </div>
        </div>

        {result.decodedDestination && (
          <div style={{ padding: '14px 24px', borderTop: '1px solid var(--ts-border)' }} data-testid="decoded-destination">
            <span className="ts-label" style={{ marginBottom: 4 }}>Decoded destination (analyzed statically — never opened)</span>
            <code className="ts-mono" style={{ wordBreak: 'break-all', color: 'var(--ts-accent-2)', fontSize: 14 }}>{result.decodedDestination}</code>
          </div>
        )}

        <div style={{ padding: '18px 24px', borderTop: '1px solid var(--ts-border)' }}>
          <h3 style={{ margin: '0 0 8px', fontSize: 13, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--ts-muted)' }}>Explanation</h3>
          <p style={{ margin: 0, lineHeight: 1.6, fontSize: 15 }} data-testid="result-explanation">{result.explanation}</p>
        </div>

        <div style={{ padding: '18px 24px', borderTop: '1px solid var(--ts-border)', background: meta.glow }} data-testid="result-recommendation">
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <ArrowRight size={18} color={meta.color} style={{ marginTop: 2, flexShrink: 0 }} />
            <div>
              <strong style={{ color: meta.color, fontSize: 14 }}>Recommended action</strong>
              <p style={{ margin: '4px 0 0', lineHeight: 1.6, fontSize: 15 }}>{result.recommendedAction}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Explainability — per signal with evidence */}
      <div className="ts-card ts-card-pad ts-fade-in">
        <h3 style={{ margin: '0 0 4px', fontSize: 15, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--ts-muted)', display: 'flex', gap: 8, alignItems: 'center' }}>
          <Search size={16} color="#22d3ee" /> Explainability — why this score
        </h3>
        <p style={{ margin: '0 0 16px', color: 'var(--ts-muted)', fontSize: 13.5 }}>
          Each detected signal, what it contributed, and the exact evidence behind it.
        </p>
        {signals.length === 0 ? (
          <p style={{ color: 'var(--ts-muted)', margin: 0 }} data-testid="no-signals">No risk signals were detected. The content appears clean.</p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 11 }} data-testid="signal-list">
            {signals.map((s, i) => {
              const sev = severityMeta(s.severity);
              const ev = evidence.find(e => e.code === s.code);
              return (
                <li key={s.code + i} data-testid={`signal-item-${s.code}`}
                  style={{ padding: '14px 15px', borderRadius: 12, background: 'rgba(120,160,210,0.05)', border: '1px solid var(--ts-border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
                    <strong style={{ fontSize: 14.5, display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ width: 8, height: 8, borderRadius: 999, background: sev.color, boxShadow: `0 0 8px ${sev.color}` }} />
                      {s.name}
                      <span className="ts-mono ts-chip" style={{ fontSize: 10.5, padding: '2px 8px' }}>{s.code}</span>
                    </strong>
                    <span style={{ fontSize: 12, fontWeight: 700, color: sev.color }}>{sev.label} · +{s.scoreContribution}</span>
                  </div>
                  <p style={{ margin: '8px 0 0', fontSize: 13.5, color: 'var(--ts-muted)', lineHeight: 1.5 }}>{s.description}</p>
                  {ev && (
                    <div style={{ marginTop: 10, padding: '9px 12px', borderRadius: 9, background: 'rgba(4,10,20,0.5)', border: '1px solid var(--ts-border)' }}
                      data-testid={`evidence-${s.code}`}>
                      <div style={{ fontSize: 12, color: 'var(--ts-muted)', marginBottom: 3 }}>Evidence ({ev.evidenceType.replace(/_/g, ' ')})</div>
                      <code className="ts-mono" style={{ color: 'var(--ts-accent-2)', fontSize: 13, wordBreak: 'break-word' }}>“{ev.value}”</code>
                      <div style={{ display: 'flex', gap: 16, marginTop: 6, fontSize: 11.5, color: 'var(--ts-muted)' }}>
                        <span>Source: <span className="ts-mono" style={{ color: 'var(--ts-text)' }}>{ev.source}</span></span>
                        <span>Confidence: <span className="ts-mono" style={{ color: 'var(--ts-text)' }}>{Math.round(ev.confidence * 100)}%</span></span>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Cross-signal correlation */}
      {correlation.summary && (
        <div className="ts-card ts-card-pad ts-fade-in" data-testid="correlation-panel">
          <h3 style={{ margin: '0 0 10px', fontSize: 15, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--ts-muted)', display: 'flex', gap: 8, alignItems: 'center' }}>
            <Layers size={16} color="#a3e635" /> Cross-Signal Correlation
            {correlation.patternStrength && correlation.patternStrength !== 'none' && (
              <span className="ts-chip" style={{ fontSize: 10.5, marginLeft: 4 }}>{correlation.patternStrength} pattern</span>
            )}
          </h3>
          <p style={{ margin: 0, lineHeight: 1.6, fontSize: 14.5 }} data-testid="correlation-summary">{correlation.summary}</p>
        </div>
      )}

      {/* Attack chain */}
      <AttackChain chain={result.attackChain} />

      {/* Raw evidence table */}
      {evidence.length > 0 && (
        <div className="ts-card ts-card-pad ts-fade-in" data-testid="evidence-panel">
          <h3 style={{ margin: '0 0 14px', fontSize: 15, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--ts-muted)', display: 'flex', gap: 8, alignItems: 'center' }}>
            <GitBranch size={16} color="#22d3ee" /> Extracted Evidence
          </h3>
          <div style={{ display: 'grid', gap: 8 }}>
            {evidence.map((e, i) => (
              <div key={i} data-testid={`evidence-row-${i}`}
                style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', padding: '10px 13px', borderRadius: 10,
                  background: 'rgba(120,160,210,0.05)', border: '1px solid var(--ts-border)', fontSize: 13 }}>
                <code className="ts-mono" style={{ color: 'var(--ts-accent-2)', flex: 1, minWidth: 160, wordBreak: 'break-word' }}>“{e.value}”</code>
                <span className="ts-chip" style={{ fontSize: 11 }}>{e.signalName || e.code}</span>
                <span style={{ color: 'var(--ts-muted)', fontSize: 11.5 }} className="ts-mono">{e.source}</span>
                <span style={{ color: 'var(--ts-muted)', fontSize: 11.5 }} className="ts-mono">{Math.round(e.confidence * 100)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
