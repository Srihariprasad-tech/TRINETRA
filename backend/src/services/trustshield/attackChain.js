// Lightweight attack-chain reconstruction + cross-signal correlation.
// The chain is GENERATED from detected signal categories — never hardcoded.
// It reuses the existing signal catalog (SIGNAL_DEFS) as the single source of truth.

// Canonical kill-chain stages, in order. Each stage claims a set of signal codes.
// A stage only appears in the output if at least one of its signals was detected.
const STAGES = [
  {
    key: 'delivery',
    label: 'Initial Contact / Delivery',
    description: 'How the suspicious content first reaches the victim.',
    codes: [] // filled dynamically from the input channel
  },
  {
    key: 'trust_manipulation',
    label: 'Trust Manipulation / Impersonation',
    description: 'The attacker borrows the identity of a trusted brand or person to lower the victim\'s guard.',
    codes: ['BRAND_IMPERSONATION', 'BRAND_IMPERSONATION_CONTENT', 'PUNYCODE_DOMAIN', 'GENERIC_GREETING']
  },
  {
    key: 'social_engineering',
    label: 'Social Engineering / Lure',
    description: 'A tempting or believable pretext (prize, job, investment, loan) is used to bait the victim.',
    codes: ['FAKE_REWARD', 'JOB_SCAM', 'INVESTMENT_SCAM', 'LOAN_SCAM']
  },
  {
    key: 'urgency_fear',
    label: 'Urgency / Fear Pressure',
    description: 'Time pressure and threats push the victim to act before they can verify.',
    codes: ['URGENCY', 'ACCOUNT_SUSPENSION', 'THREAT_LANGUAGE']
  },
  {
    key: 'malicious_redirect',
    label: 'Malicious Link / Redirect',
    description: 'The victim is steered toward a deceptive or obfuscated web destination.',
    codes: ['SUSPICIOUS_LINK', 'IP_HOSTNAME', 'AT_SYMBOL_OBFUSCATION', 'SUSPICIOUS_ENCODING',
      'SUSPICIOUS_TLD', 'EXCESSIVE_SUBDOMAINS', 'LONG_URL', 'NO_HTTPS',
      'CREDENTIAL_KEYWORDS', 'PAYMENT_KEYWORDS', 'ML_MODEL_RISK']
  },
  {
    key: 'credential_theft',
    label: 'Credential Request / Theft',
    description: 'Login details, passwords or one-time codes are harvested.',
    codes: ['CREDENTIAL_REQUEST', 'OTP_REQUEST']
  },
  {
    key: 'financial_fraud',
    label: 'Financial Fraud / Risk',
    description: 'Banking details or direct payments are extracted from the victim.',
    codes: ['FINANCIAL_REQUEST', 'PAYMENT_REQUEST']
  }
];

const CHANNEL_LABEL = {
  url: 'Suspicious link opened by the victim',
  qr: 'QR code scanned by the victim',
  email: 'Fraudulent email delivered to the inbox',
  message: 'Scam message / SMS delivered to the victim',
  custom: 'Untrusted content submitted for analysis'
};

// Build the ordered attack chain from detected (enriched) signals.
// `signals` items must contain at least { code }.
export function buildAttackChain(inputType, signals) {
  if (!signals || signals.length === 0) return [];
  const codeSet = new Set(signals.map(s => s.code));
  const byCode = new Map(signals.map(s => [s.code, s]));
  const chain = [];

  for (const stage of STAGES) {
    if (stage.key === 'delivery') {
      chain.push({
        stage: stage.key,
        label: stage.label,
        description: CHANNEL_LABEL[inputType] || stage.description,
        signals: []
      });
      continue;
    }
    const matched = stage.codes.filter(c => codeSet.has(c));
    if (matched.length === 0) continue;
    chain.push({
      stage: stage.key,
      label: stage.label,
      description: stage.description,
      signals: matched.map(c => ({ code: c, name: byCode.get(c)?.name || c }))
    });
  }

  // Inferred outcome stage — derived from what the earlier stages achieved.
  const hasCred = codeSet.has('CREDENTIAL_REQUEST') || codeSet.has('OTP_REQUEST') || codeSet.has('CREDENTIAL_KEYWORDS');
  const hasMoney = codeSet.has('FINANCIAL_REQUEST') || codeSet.has('PAYMENT_REQUEST') || codeSet.has('PAYMENT_KEYWORDS');
  if (hasCred || hasMoney) {
    const label = hasCred && hasMoney
      ? 'Account Compromise & Financial Loss'
      : hasCred ? 'Potential Account Compromise' : 'Potential Financial Loss';
    chain.push({
      stage: 'impact',
      label,
      description: 'If the victim complies, the attacker gains what they need to cause real harm.',
      signals: []
    });
  }

  // A single-stage chain (delivery only) is not a meaningful chain.
  return chain.length >= 2 ? chain : [];
}

// Cross-signal correlation: explain why the COMBINATION is stronger than any
// single signal. Generated from the distinct stages/categories that fired.
export function buildCorrelation(signals, threatCategory) {
  if (!signals || signals.length === 0) {
    return {
      summary: 'No corroborating signals were detected, so there is no attack pattern to correlate.',
      factors: [],
      patternStrength: 'none'
    };
  }
  if (signals.length === 1) {
    const s = signals[0];
    return {
      summary: `Only one signal was detected (${s.name}). A single indicator like this is weak on its own and is not conclusive evidence of an attack.`,
      factors: [{ code: s.code, name: s.name, reason: s.reason }],
      patternStrength: 'weak'
    };
  }

  const factors = signals.map(s => ({ code: s.code, name: s.name, reason: s.reason }));
  const distinctCategories = [...new Set(signals.map(s => s.category))];
  const names = signals.map(s => s.name.toLowerCase());
  const readable = names.length <= 3
    ? joinList(names)
    : `${joinList(names.slice(0, 3))} and ${names.length - 3} more`;

  let patternStrength = 'moderate';
  if (signals.length >= 4 || distinctCategories.length >= 3) patternStrength = 'strong';

  const category = (threatCategory && threatCategory !== 'NONE')
    ? threatCategory.replace(/_/g, ' ').toLowerCase()
    : 'social-engineering';

  const summary =
    `Individually, indicators such as ${names[0]} are not automatically malicious. ` +
    `Here, however, ${readable} appear together and reinforce one another, forming a recognizable ${category} pattern. ` +
    `This combination is far more dangerous than any single signal because each step removes one more reason for the victim to hesitate.`;

  return { summary, factors, patternStrength, distinctCategories };
}

function joinList(items) {
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}
