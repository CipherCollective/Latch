import { Fingerprint, ScanLine, ShieldCheck } from 'lucide-react';

const steps = [
  {
    label: 'Delegate',
    description: 'Commit a private-policy fixture without publishing its readable limits.',
    icon: Fingerprint,
  },
  {
    label: 'Prove',
    description: 'Model evaluation against the hidden policy; verified Midnight proofs require the core handoff.',
    icon: ScanLine,
  },
  {
    label: 'Spend',
    description: 'Issue one deterministic, single-use authorization fixture at a time.',
    icon: ShieldCheck,
  },
] as const;

export function ProtocolSteps() {
  return (
    <section className="steps" aria-labelledby="steps-title">
      <div className="section-heading">
        <span className="eyebrow">Protocol flow</span>
        <h2 id="steps-title">A private control plane in three moves.</h2>
      </div>
      <ol className="step-grid">
        {steps.map(({ label, description, icon: Icon }, index) => (
          <li className="step-card" key={label}>
            <span className="step-number" aria-hidden="true">
              0{index + 1}
            </span>
            <Icon aria-hidden="true" size={22} strokeWidth={1.8} />
            <h3>{label}</h3>
            <p>{description}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
