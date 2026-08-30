import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FlaskConical, ShieldCheck, Play, Trash2, GitCompare, Lock, RotateCcw } from 'lucide-react';
import { apiGet, apiPost, apiDelete } from '../lib/api';
import SandboxResult from '../components/SandboxResult';
import { Loader, ErrorBanner, PageHeader } from '../components/ui';
import { classificationMeta, prettyType, formatDate } from '../lib/risk';

const DIFFICULTIES = ['all', 'beginner', 'intermediate', 'advanced'];
const TYPE_OPTIONS = [
  { value: 'custom', label: 'Custom Input' },
  { value: 'message', label: 'Message / SMS' },
  { value: 'email', label: 'Email' },
  { value: 'url', label: 'URL' },
  { value: 'qr', label: 'QR (decoded text)' },
];
const DIFF_COLOR = { beginner: '#34d399', intermediate: '#fbbf24', advanced: '#f87171' };

export default function Sandbox() {
  const [scenarios, setScenarios] = useState([]);
  const [difficulty, setDifficulty] = useState('all');
  const [inputType, setInputType] = useState('custom');
  const [content, setContent] = useState('');
  const [activeScenario, setActiveScenario] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [runs, setRuns] = useState([]);
  const [runsError, setRunsError] = useState('');

  useEffect(() => {
    apiGet('/sandbox/scenarios')
      .then(d => setScenarios(d.scenarios || []))
      .catch(err => setError(err.message || 'Unable to load scenarios.'));
    loadRuns();
  }, []);

  function loadRuns() {
    apiGet('/sandbox/runs?limit=8')
      .then(setRuns)
      .catch(err => setRunsError(err.message || 'Unable to load sandbox history.'));
  }

  function loadScenario(s) {
    setActiveScenario(s.id);
    setInputType(s.inputType);
    setContent(s.sampleContent);
    setResult(null);
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function analyze(e) {
    e?.preventDefault();
    setError(''); setResult(null);
    if (!content.trim()) { setError('Enter or load some content to analyze.'); return; }
    setLoading(true);
    try {
      const r = await apiPost('/sandbox/analyze', { inputType, content, scenarioId: activeScenario });
      setResult(r);
      loadRuns();
    } catch (err) {
      setError(err.message || 'Unable to analyze this scenario.');
    } finally { setLoading(false); }
  }

  async function openRun(id) {
    setError(''); setLoading(true); setResult(null);
    try {
      setResult(await apiGet(`/sandbox/runs/${id}`));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(err.message || 'Unable to open run.');
    } finally { setLoading(false); }
  }

  async function clearHistory() {
    setRunsError('');
    try {
      await apiDelete('/sandbox/runs');
      setRuns([]);
    } catch (err) {
      setRunsError(err.message || 'Unable to clear history.');
    }
  }

  const filtered = difficulty === 'all' ? scenarios : scenarios.filter(s => s.difficulty === difficulty);

  return (
    <div>
      <PageHeader icon={FlaskConical} title="TrustShield Sandbox"
        subtitle="Safely test fraud scenarios and see how TrustShield detects, explains, and correlates threats." />

      {/* Safety banner */}
      <div data-testid="safety-banner" style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '11px 15px', borderRadius: 12,
        background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.3)', color: '#6ee7b7', marginBottom: 20, fontSize: 13.5 }}>
        <Lock size={16} /> Defensive &amp; analysis-only. The sandbox never opens links, scans real destinations, executes content, or contacts external servers.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 340px) minmax(0, 1fr)', gap: 18 }} className="ts-sandbox-cols">
        {/* Left: scenario catalog */}
        <div style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
          <div className="ts-card ts-card-pad">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
              <h3 style={{ margin: 0, fontSize: 16 }}>Scenario Library</h3>
              <Link to="/sandbox/compare" className="ts-chip" data-testid="compare-link"
                style={{ textDecoration: 'none', color: 'var(--ts-accent)', cursor: 'pointer' }}>
                <GitCompare size={14} /> Compare
              </Link>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
              {DIFFICULTIES.map(d => (
                <button key={d} type="button" data-testid={`difficulty-${d}`} onClick={() => setDifficulty(d)}
                  className="ts-chip" style={{ cursor: 'pointer', textTransform: 'capitalize',
                    color: difficulty === d ? '#041016' : 'var(--ts-muted)',
                    background: difficulty === d ? 'var(--ts-accent)' : 'rgba(120,160,210,0.06)',
                    borderColor: difficulty === d ? 'var(--ts-accent)' : 'var(--ts-border-strong)' }}>
                  {d}
                </button>
              ))}
            </div>
            {filtered.length === 0 ? (
              <p style={{ color: 'var(--ts-muted)', fontSize: 13.5, margin: 0 }} data-testid="scenarios-empty">No scenarios for this difficulty.</p>
            ) : (
              <div style={{ display: 'grid', gap: 9 }} data-testid="scenario-list">
                {filtered.map(s => (
                  <div key={s.id} data-testid={`scenario-card-${s.id}`}
                    style={{ padding: '12px 13px', borderRadius: 12, cursor: 'pointer',
                      background: activeScenario === s.id ? 'rgba(34,211,238,0.08)' : 'rgba(120,160,210,0.04)',
                      border: `1px solid ${activeScenario === s.id ? 'rgba(34,211,238,0.4)' : 'var(--ts-border)'}` }}
                    onClick={() => loadScenario(s)}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                      <strong style={{ fontSize: 13.5 }}>{s.name}</strong>
                      <span className="ts-mono" style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: DIFF_COLOR[s.difficulty] }}>{s.difficulty}</span>
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--ts-muted)', marginTop: 2 }}>{s.category} · {prettyType(s.inputType)}</div>
                    <p style={{ margin: '6px 0 0', fontSize: 12.5, color: 'var(--ts-muted)', lineHeight: 1.45 }}>{s.description}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent runs */}
          <div className="ts-card ts-card-pad" data-testid="sandbox-history">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 16 }}>Recent Sandbox Runs</h3>
              {runs.length > 0 && (
                <button type="button" className="ts-btn ts-btn-danger" data-testid="clear-history"
                  onClick={clearHistory} style={{ padding: '6px 11px', fontSize: 12.5 }}>
                  <Trash2 size={14} /> Clear
                </button>
              )}
            </div>
            <ErrorBanner message={runsError} />
            {runs.length === 0 ? (
              <p style={{ color: 'var(--ts-muted)', fontSize: 13.5, margin: 0 }} data-testid="history-empty">No sandbox runs yet. Analyze a scenario to begin.</p>
            ) : (
              <div style={{ display: 'grid', gap: 7 }}>
                {runs.map(r => {
                  const meta = classificationMeta(r.classification);
                  return (
                    <button key={r.id} data-testid={`sandbox-run-${r.id}`} onClick={() => openRun(r.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 11px', borderRadius: 10, width: '100%', textAlign: 'left', cursor: 'pointer',
                        background: 'rgba(120,160,210,0.05)', border: '1px solid var(--ts-border)' }}>
                      <span className="ts-chip" style={{ fontSize: 10.5, minWidth: 62, justifyContent: 'center' }}>{prettyType(r.inputType)}</span>
                      <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: 'var(--ts-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{formatDate(r.createdAt)}</span>
                      <span className="ts-mono" style={{ fontWeight: 700, color: meta.color }}>{r.riskScore}</span>
                      <span style={{ fontSize: 11, color: meta.color }}>{meta.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right: editor + results */}
        <div style={{ display: 'grid', gap: 16, alignContent: 'start' }}>
          <form onSubmit={analyze} className="ts-card ts-card-pad" data-testid="sandbox-form">
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 12 }}>
              <div style={{ flex: '0 0 200px' }}>
                <label className="ts-label" htmlFor="sandbox-input-type">Input Type</label>
                <select id="sandbox-input-type" data-testid="sandbox-input-type" className="ts-input"
                  value={inputType} onChange={e => { setInputType(e.target.value); setActiveScenario(null); }}>
                  {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              {activeScenario && (
                <button type="button" className="ts-chip" data-testid="clear-scenario"
                  onClick={() => { setActiveScenario(null); }} style={{ cursor: 'pointer', color: 'var(--ts-muted)' }}>
                  <RotateCcw size={13} /> Custom edit
                </button>
              )}
            </div>
            <label className="ts-label" htmlFor="sandbox-content">Input Content</label>
            <textarea id="sandbox-content" data-testid="sandbox-content" className="ts-textarea"
              placeholder="Load a scenario from the library, or paste your own suspicious message, email, URL or QR text here…"
              value={content} onChange={e => { setContent(e.target.value); setActiveScenario(null); }} maxLength={20000} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, flexWrap: 'wrap', gap: 10 }}>
              <span data-testid="sandbox-char-count" style={{ fontSize: 12.5, color: 'var(--ts-muted)' }} className="ts-mono">
                {content.length} / 20000 characters
              </span>
              <button type="submit" className="ts-btn ts-btn-primary" data-testid="sandbox-analyze-btn" disabled={loading}>
                <Play size={17} /> {loading ? 'Analyzing…' : 'Analyze Scenario'}
              </button>
            </div>
          </form>

          <ErrorBanner message={error} />
          {loading && <Loader label="Running through the analysis pipeline…" />}
          {!loading && result && <SandboxResult result={result} />}
          {!loading && !result && !error && (
            <div className="ts-card ts-card-pad" data-testid="sandbox-empty" style={{ textAlign: 'center', color: 'var(--ts-muted)' }}>
              <ShieldCheck size={28} color="#22d3ee" style={{ marginBottom: 10 }} />
              <p style={{ margin: 0 }}>Pick a scenario or enter content, then press <strong style={{ color: 'var(--ts-text)' }}>Analyze Scenario</strong> to see the full detection pipeline: signals → scoring → explanation → evidence → attack chain.</p>
            </div>
          )}
        </div>
      </div>
      <style>{`@media (max-width: 1000px){.ts-sandbox-cols{grid-template-columns:1fr !important;}}`}</style>
    </div>
  );
}
