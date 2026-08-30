import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Sandbox from '../Sandbox';

// Mock the API client so the component test is deterministic and offline.
vi.mock('../../lib/api', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiDelete: vi.fn(),
}));

import { apiGet, apiPost } from '../../lib/api';

const SCENARIOS = [
  {
    id: 'account-suspension', name: 'Suspicious Account Suspension', description: 'Classic phishing.',
    inputType: 'message', difficulty: 'beginner', category: 'Scam Message',
    sampleContent: 'URGENT: verify your account immediately.', expectedRiskRange: [50, 90], educationalExplanation: 'x'
  },
];

const RESULT = {
  sandboxRunId: 1, inputType: 'message', riskScore: 40, classification: 'SUSPICIOUS',
  threatCategory: 'OTP_SCAM', confidence: 0.9, explanation: 'Flagged for urgency.',
  recommendedAction: 'Be careful.', decodedDestination: null,
  signals: [{ code: 'URGENCY', name: 'Urgency pressure', description: 'Time pressure.', scoreContribution: 10, severity: 'MEDIUM', category: 'SUSPICIOUS_CONTENT', reason: 'urgency' }],
  evidence: [{ code: 'URGENCY', signalName: 'Urgency pressure', evidenceType: 'matched_phrase', value: 'URGENT', source: 'content_analyzer', confidence: 0.75, metadata: {} }],
  attackChain: [], correlation: { summary: '', factors: [] }
};

function renderSandbox() {
  return render(<MemoryRouter><Sandbox /></MemoryRouter>);
}

describe('Sandbox page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiGet.mockImplementation((path) => {
      if (path.startsWith('/sandbox/scenarios')) return Promise.resolve({ scenarios: SCENARIOS, supportedTypes: ['url', 'email', 'message', 'qr', 'custom'], maxContentLength: 20000 });
      if (path.startsWith('/sandbox/runs')) return Promise.resolve([]);
      return Promise.resolve(null);
    });
  });

  it('renders header, safety banner and loads scenarios', async () => {
    renderSandbox();
    expect(screen.getByText('TrustShield Sandbox')).toBeInTheDocument();
    expect(screen.getByTestId('safety-banner')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('scenario-card-account-suspension')).toBeInTheDocument());
    // empty state visible before any analysis
    expect(screen.getByTestId('sandbox-empty')).toBeInTheDocument();
  });

  it('loads a scenario into the editor when its card is clicked', async () => {
    renderSandbox();
    await waitFor(() => screen.getByTestId('scenario-card-account-suspension'));
    fireEvent.click(screen.getByTestId('scenario-card-account-suspension'));
    expect(screen.getByTestId?.('sandbox-content') || screen.getByTestId('sandbox-content')).toHaveValue('URGENT: verify your account immediately.');
  });

  it('analyzes and renders the result', async () => {
    apiPost.mockResolvedValue(RESULT);
    renderSandbox();
    await waitFor(() => screen.getByTestId('scenario-card-account-suspension'));
    fireEvent.click(screen.getByTestId('scenario-card-account-suspension'));
    fireEvent.click(screen.getByTestId('sandbox-analyze-btn'));
    await waitFor(() => expect(screen.getByTestId('sandbox-result')).toBeInTheDocument());
    expect(screen.getByTestId('result-classification')).toHaveTextContent('SUSPICIOUS');
    expect(screen.getByTestId('signal-item-URGENCY')).toBeInTheDocument();
    expect(screen.getByTestId('evidence-URGENCY')).toHaveTextContent('URGENT');
  });

  it('shows an error when analysis fails', async () => {
    apiPost.mockRejectedValue(new Error('Content exceeds the 20000-character sandbox limit.'));
    renderSandbox();
    await waitFor(() => screen.getByTestId('scenario-card-account-suspension'));
    fireEvent.click(screen.getByTestId('scenario-card-account-suspension'));
    fireEvent.click(screen.getByTestId('sandbox-analyze-btn'));
    await waitFor(() => expect(screen.getByTestId('error-banner')).toHaveTextContent(/sandbox limit/i));
  });

  it('shows an inline error when analyzing empty content', async () => {
    renderSandbox();
    await waitFor(() => screen.getByTestId('scenario-list'));
    fireEvent.click(screen.getByTestId('sandbox-analyze-btn'));
    await waitFor(() => expect(screen.getByTestId('error-banner')).toBeInTheDocument());
    expect(apiPost).not.toHaveBeenCalled();
  });
});
