// Prebuilt SAFE synthetic scenario catalog for the TrustShield Sandbox.
// Every domain uses reserved/synthetic TLDs (.test / .example) or obviously fake
// hosts. No real people, credentials, or malicious infrastructure are referenced.
// `expectedRiskRange` is illustrative only — the risk ENGINE always decides the score.

export const DIFFICULTIES = ['beginner', 'intermediate', 'advanced'];

export const SCENARIOS = [
  {
    id: 'safe-bank-notification',
    name: 'Safe Banking Notification',
    description: 'A legitimate-looking, low-pressure account notification with no risky asks.',
    inputType: 'message',
    difficulty: 'beginner',
    category: 'Custom Input',
    sampleContent: 'Your monthly bank statement is ready. Log in through your usual banking app to view it. No action is required.',
    expectedRiskRange: [0, 29],
    educationalExplanation: 'A genuine notification informs you without urgency, threats, links, or requests for credentials. Notice how none of the classic pressure tactics are present.'
  },
  {
    id: 'account-suspension',
    name: 'Suspicious Account Suspension',
    description: 'Classic phishing: urgency + suspension threat + credential/link request.',
    inputType: 'message',
    difficulty: 'beginner',
    category: 'Scam Message',
    sampleContent: 'URGENT: Your bank account will be suspended today. Verify your account immediately using the secure link below: http://secure-example.test/account/verify',
    expectedRiskRange: [50, 90],
    educationalExplanation: 'Urgency plus a suspension threat plus a verification link is a textbook phishing combination. Each element alone is weak; together they form a strong pattern.'
  },
  {
    id: 'fake-delivery',
    name: 'Fake Delivery Message',
    description: 'A parcel-redelivery lure that pushes you to a look-alike link.',
    inputType: 'message',
    difficulty: 'beginner',
    category: 'Scam Message',
    sampleContent: 'Your package could not be delivered. Confirm your address and pay the $1.99 redelivery fee now: http://delivery-update.example/track',
    expectedRiskRange: [40, 80],
    educationalExplanation: 'Delivery scams pair a plausible pretext with a small payment and a suspicious link to harvest card details.'
  },
  {
    id: 'fake-tax-refund',
    name: 'Fake Tax Refund',
    description: 'A reward-style lure impersonating a tax authority.',
    inputType: 'email',
    difficulty: 'intermediate',
    category: 'Phishing Email',
    sampleContent: 'Subject: You are eligible for a tax refund\n\nDear Customer, our records show you are owed a refund of $842.50. To claim your refund, confirm your bank account number and complete your KYC at http://tax-refund.example/claim within 24 hours.',
    expectedRiskRange: [50, 90],
    educationalExplanation: 'Combines a reward (refund), a generic greeting, a deadline, a request for banking details, and a suspicious link — several subtle signals reinforcing one another.'
  },
  {
    id: 'credential-verification',
    name: 'Credential Verification Scam',
    description: 'Impersonates a brand and asks you to re-enter your password.',
    inputType: 'email',
    difficulty: 'intermediate',
    category: 'Credential Theft',
    sampleContent: 'Subject: Unusual sign-in to your Netflix account\n\nWe detected an unusual sign-in. To secure your account, please confirm your identity and re-enter your password at http://netflix-verify.example/login',
    expectedRiskRange: [50, 90],
    educationalExplanation: 'Brand impersonation plus a request to confirm/re-enter a password is a direct credential-theft attempt.'
  },
  {
    id: 'investment-scam',
    name: 'Investment Scam',
    description: 'Guaranteed-return "opportunity" with financial pressure.',
    inputType: 'message',
    difficulty: 'intermediate',
    category: 'Financial Fraud',
    sampleContent: 'Exclusive investment opportunity! Guaranteed 20% weekly returns, completely risk-free. Deposit now via crypto to double your money in 7 days. Limited slots available.',
    expectedRiskRange: [40, 80],
    educationalExplanation: 'Guaranteed, risk-free, unusually high returns are impossible. Add urgency ("limited slots") and a crypto deposit request and the fraud pattern is clear.'
  },
  {
    id: 'executive-impersonation',
    name: 'Executive Impersonation',
    description: 'Low-obviousness CEO-fraud request with cross-signal correlation.',
    inputType: 'email',
    difficulty: 'advanced',
    category: 'Impersonation',
    sampleContent: 'Subject: Quick favour\n\nHi, I\'m in back-to-back meetings and can\'t take calls. I need you to process an urgent wire transfer to a new vendor before end of day. Keep this confidential for now and reply once done.',
    expectedRiskRange: [30, 70],
    educationalExplanation: 'Advanced social engineering: no links or spelling mistakes, just authority, urgency, secrecy, and a payment request. The danger comes from the combination, not any single word.'
  },
  {
    id: 'urgent-payment',
    name: 'Urgent Payment Request',
    description: 'Overdue-invoice pressure with a payment demand.',
    inputType: 'email',
    difficulty: 'advanced',
    category: 'Social Engineering',
    sampleContent: 'Subject: Final notice — overdue invoice\n\nThis is your final notice. Your invoice is overdue and legal action will follow if payment is not made immediately. Make a payment via wire transfer today to avoid penalties.',
    expectedRiskRange: [30, 70],
    educationalExplanation: 'Fear (legal action) plus urgency (final notice) plus a payment demand — a pressure stack designed to override caution.'
  },
  {
    id: 'fake-support',
    name: 'Fake Support Message',
    description: 'Impersonated support asking for a one-time code.',
    inputType: 'message',
    difficulty: 'advanced',
    category: 'AI-Generated Scam',
    sampleContent: 'Hello, this is your account support team. We noticed suspicious activity and need to verify it\'s really you. Please share the one-time verification code we just sent to your phone so we can secure your account.',
    expectedRiskRange: [40, 80],
    educationalExplanation: 'No legitimate support team ever asks for your OTP. The polished, helpful tone is designed to make the request feel routine.'
  },
  {
    id: 'qr-payment-scam',
    name: 'QR Payment Scam',
    description: 'A QR code whose decoded destination is a look-alike payment page.',
    inputType: 'qr',
    difficulty: 'intermediate',
    category: 'QR Scam',
    sampleContent: 'http://paypa1-secure.example/payment/verify?amount=499',
    expectedRiskRange: [40, 90],
    educationalExplanation: 'The sandbox analyzes the DECODED destination statically — it never opens it. A look-alike domain ("paypa1") plus payment/verify keywords reveals the scam.'
  }
];

export function getScenario(id) {
  return SCENARIOS.find(s => s.id === id) || null;
}
