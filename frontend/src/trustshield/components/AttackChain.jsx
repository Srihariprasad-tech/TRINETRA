import { ArrowDown, Zap } from 'lucide-react';

// Attack-chain visualization. Renders the structured, signal-derived chain that
// the backend produced. Nothing is hardcoded here — empty chain renders nothing.
export default function AttackChain({ chain }) {
  if (!chain || chain.length < 2) return null;
  return (
    <div className="ts-card ts-card-pad ts-fade-in" data-testid="attack-chain">
      <h3 style={{ margin: '0 0 4px', fontSize: 15, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--ts-muted)' }}>
        Reconstructed Attack Chain
      </h3>
      <p style={{ margin: '0 0 18px', color: 'var(--ts-muted)', fontSize: 13.5 }}>
        Generated from the detected signals — how this scenario would unfold step by step.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 0 }}>
        {chain.map((node, i) => (
          <div key={node.stage + i}>
            <div data-testid={`chain-stage-${node.stage}`}
              style={{
                display: 'flex', gap: 13, padding: '14px 16px', borderRadius: 12,
                background: node.stage === 'impact' ? 'rgba(248,113,113,0.08)' : 'rgba(34,211,238,0.05)',
                border: `1px solid ${node.stage === 'impact' ? 'rgba(248,113,113,0.3)' : 'var(--ts-border)'}`
              }}>
              <span style={{
                flexShrink: 0, width: 30, height: 30, borderRadius: 9, display: 'grid', placeItems: 'center',
                background: node.stage === 'impact' ? 'rgba(248,113,113,0.15)' : 'rgba(34,211,238,0.12)',
                border: `1px solid ${node.stage === 'impact' ? 'rgba(248,113,113,0.4)' : 'rgba(34,211,238,0.3)'}`,
                fontWeight: 700, fontSize: 13
              }} className="ts-mono">{i + 1}</span>
              <div style={{ flex: 1 }}>
                <strong style={{ fontSize: 14.5, color: node.stage === 'impact' ? '#fca5a5' : 'var(--ts-text)' }}>{node.label}</strong>
                <p style={{ margin: '3px 0 0', fontSize: 13, color: 'var(--ts-muted)', lineHeight: 1.5 }}>{node.description}</p>
                {node.signals?.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                    {node.signals.map(s => (
                      <span key={s.code} className="ts-chip" style={{ fontSize: 11, padding: '3px 9px', gap: 5 }}>
                        <Zap size={11} color="#a3e635" /> {s.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {i < chain.length - 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0' }}>
                <ArrowDown size={18} color="var(--ts-muted)" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
