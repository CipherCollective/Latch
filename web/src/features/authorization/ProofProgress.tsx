import { CheckCircle2, CircleDashed, LoaderCircle, XCircle } from 'lucide-react';
import type { ProofStep } from '../../types/domain';

interface ProofProgressProps {
  steps: ProofStep[];
  busy: boolean;
  requestLabel?: string;
}

const statusLabels: Record<ProofStep['status'], string> = {
  waiting: 'Waiting',
  running: 'Running',
  passed: 'Passed',
  failed: 'Failed',
};

function StepIcon({ status }: { status: ProofStep['status'] }) {
  const shared = { 'aria-hidden': true, size: 18 } as const;

  switch (status) {
    case 'waiting':
      return <CircleDashed {...shared} />;
    case 'running':
      return <LoaderCircle {...shared} />;
    case 'passed':
      return <CheckCircle2 {...shared} />;
    case 'failed':
      return <XCircle {...shared} />;
  }
}

function majorState(steps: ProofStep[], busy: boolean): string {
  if (steps.some((step) => step.status === 'failed')) {
    return 'Authorization rejected.';
  }

  if (steps.length > 0 && steps.every((step) => step.status === 'passed') && !busy) {
    return 'Authorization proof completed.';
  }

  if (busy || steps.some((step) => step.status === 'running')) {
    return steps.length === 0 ? 'Authorization started.' : 'Authorization proof in progress.';
  }

  return '';
}

export function ProofProgress({ steps, busy, requestLabel }: ProofProgressProps) {
  const announcement = majorState(steps, busy);

  return (
    <section className="proof-progress" aria-labelledby="proof-progress-title" aria-busy={busy}>
      <div className="proof-progress-heading">
        <div>
          <span className="eyebrow">Private proof</span>
          <h2 id="proof-progress-title">Authorization progress</h2>
        </div>
        {requestLabel ? <span className="proof-request-label">{requestLabel}</span> : null}
      </div>

      {steps.length > 0 ? (
        <ol className="proof-step-list">
          {steps.map((step) => (
            <li
              className={`proof-step proof-step-${step.status}`}
              data-status={step.status}
              key={step.id}
              aria-current={step.status === 'running' ? 'step' : undefined}
            >
              <span className="proof-step-icon">
                <StepIcon status={step.status} />
              </span>
              <span className="proof-step-copy">
                <span className="proof-step-label">{step.label}</span>
                {step.safeDetail ? <span className="proof-step-detail">{step.safeDetail}</span> : null}
              </span>
              <span className="proof-step-status">{statusLabels[step.status]}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="proof-empty-state">Proof steps will appear when the authorization client reports them.</p>
      )}

      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>
    </section>
  );
}
