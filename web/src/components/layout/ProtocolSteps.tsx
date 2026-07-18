import { Fingerprint, ScanLine, ShieldCheck } from 'lucide-react';

const steps = [
  {
    label: 'Delegate',
    description: 'Commit a spending capability without publishing its limits.',
    icon: Fingerprint,
  },
  {
    label: 'Prove',
    description: 'Evaluate each request against the hidden policy on Midnight.',
    icon: ScanLine,
  },
  {
    label: 'Spend',
    description: 'Issue one verifiable, single-use authorization at a time.',
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
