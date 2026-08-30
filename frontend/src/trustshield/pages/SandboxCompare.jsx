import { useState } from 'react';
import { Link } from 'react-router-dom';
import { GitCompare, Play, ArrowLeft, Plus, Minus, Equal } from 'lucide-react';
import { apiPost } from '../lib/api';
import ScoreRing from '../components/ScoreRing';
import { Loader, ErrorBanner, PageHeader } from '../components/ui';
import { classificationMeta, severityMeta } from '../lib/risk';

const TYPE_OPTIONS = [
  { value: 'custom', label: 'Custom Input' },
  { value: 'message', label: 'Message / SMS' },
  { value: 'email', label: 'Email' },
  { value: 'url', label: 'URL' },
  { value: 'qr', label: 'QR (decoded text)' },
];

const PRESET_A = { inputType: 'message', content: 'Your monthly bank statement is ready. Log in through your usual banking app to view it. No action is required.' };
const PRESET_B = { inputType: 'message', content: 'URGENT! Your account will be suspended. Verify immediately and share the OTP sent to your phone.' };

export default function SandboxCompare() {
  const [a, setA] = useState(PRESET_A);
  const [b, setB] = useState(PRESET_B);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);

  async function run(e) {
    e.preventDefault();
    setError(''); setData(null);
    if (!a.content.trim() || !b.content.trim()) { setError('Both scenarios need content.'); return; }
    setLoading(true);
    try {
      setData(await apiPost('/sandbox/compare', { scenarioA: a, scenarioB: b }));
    } catch (err) {
      setError(err.message || 'Unable to compare scenarios.');
    } finally { setLoading(false); }
  }

  return (
    <div>
      <Link to="/sandbox" className="ts-btn ts-btn-ghost" data-testid="back-to-sandbox" style={{ marginBottom: 18 }}>
        <ArrowLeft size={17} /> Back to Sandbox
      </Link>
      <PageHeader icon={GitCompare} title="Compare Scenarios"
        subtitle="Run two scenarios through the same analysis pipeline and see exactly which signals cause the difference." />

      <form onSubmit={run} className="ts-card ts-card-pad" data-testid="compare-form" style={{ marginBottom: 18 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }} className="ts-compare-cols">
          <Editor label="Scenario A" testid="a" value={a} onChange={setA} />
          <Editor label="Scenario B" testid="b" value={b} onChange={setB} />
        </div>
        <button type="submit" className="ts-btn ts-btn-primary" data-testid="compare-run-btn" disabled={loading} style={{ marginTop: 16 }}>
          <Play size={17} /> {loading ? 'Comparing…' : 'Compare Scenarios'}
        </button>
      </form>

      <ErrorBanner message={error} />
      {loading && <Loader label="Analyzing both scenarios…" />}

      {!loading && data && (
        <div style={{ display: 'grid', gap: 16 }} data-testid="compare-result">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }} className="ts-compare-cols">
            <ResultCard title="Scenario A" run={data.scenarioA} />
            <ResultCard title="Scenario B" run={data.scenarioB} />
          </div>

          <div className="ts-card ts-card-pad" data-testid="compare-summary">
            <h3 style={{ margin: '0 0 10px', fontSize: 15, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--ts-muted)' }}>Why the scores differ</h3>
            <p style={{ margin: '0 0 14px', lineHeight: 1.6, fontSize: 15 }} data-testid="compare-summary-text">{data.comparison.summary}</p>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 14 }}>
              <span className="ts-mono" style={{ fontWeight: 700 }}>Score delta:</span>
              <span className="ts-chip" style={{ color: data.comparison.scoreDelta >= 0 ? '#f87171' : '#34d399' }}>
                {data.comparison.scoreDelta >= 0 ? '+' : ''}{data.comparison.scoreDelta}
              </span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            <SignalGroup title="Shared signals" icon={Equal} color="#93a4bd" signals={data.comparison.sharedSignals} testid="shared-signals" />
            <SignalGroup title="Only in A" icon={Minus} color="#60a5fa" signals={data.comparison.uniqueToA} testid="unique-a" />
            <SignalGroup title="Only in B" icon={Plus} color="#f87171" signals={data.comparison.uniqueToB} testid="unique-b" />
          </div>
        </div>
      )}
      <style>{`@media (max-width: 820px){.ts-compare-cols{grid-template-columns:1fr !important;}}`}</style>
    </div>
  );
}

function Editor({ label, testid, value, onChange }) {
  return (
    <div>
      <label className="ts-label">{label} — Input Type</label>
      <select className="ts-input" data-testid={`compare-type-${testid}`} value={value.inputType}
        onChange={e => onChange({ ...value, inputType: e.target.value })} style={{ marginBottom: 10 }}>
        {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <textarea className="ts-textarea" data-testid={`compare-content-${testid}`} style={{ minHeight: 120 }}
        value={value.content} maxLength={20000}
        onChange={e => onChange({ ...value, content: e.target.value })} />
    </div>
  );
}

function ResultCard({ title, run }) {
  const meta = classificationMeta(run.classification);
  return (
    <div className="ts-card ts-card-pad" style={{ borderColor: meta.ring + '55' }} data-testid={`compare-card-${title.endsWith('A') ? 'a' : 'b'}`}>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        <ScoreRing score={run.riskScore} classification={run.classification} size={92} />
        <div>
          <div style={{ fontSize: 13, color: 'var(--ts-muted)' }}>{title}</div>
          <div className="ts-chip" style={{ marginTop: 6, color: meta.color, borderColor: meta.ring + '66' }}>{meta.label}</div>
          <div style={{ fontSize: 12.5, color: 'var(--ts-muted)', marginTop: 6 }}>{run.threatCategory} · {run.signals.length} signals</div>
        </div>
      </div>
    </div>
  );
}

function SignalGroup({ title, icon: Icon, color, signals, testid }) {
  return (
    <div className="ts-card ts-card-pad" data-testid={testid}>
      <h4 style={{ margin: '0 0 10px', fontSize: 13, display: 'flex', gap: 7, alignItems: 'center', color }}>
        <Icon size={15} /> {title} ({signals.length})
      </h4>
      {signals.length === 0 ? (
        <p style={{ margin: 0, fontSize: 12.5, color: 'var(--ts-muted)' }}>None</p>
      ) : (
        <div style={{ display: 'grid', gap: 6 }}>
          {signals.map(s => {
            const sev = severityMeta(s.severity);
            return (
              <div key={s.code} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12.5, alignItems: 'center' }}>
                <span>{s.name}</span>
                <span className="ts-mono" style={{ color: sev.color, fontWeight: 700 }}>+{s.scoreContribution}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
