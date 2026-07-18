import { useEffect, useRef, useState } from 'react';
import { Check, Clipboard, Eye, RotateCcw, Shield, ShieldOff } from 'lucide-react';
import { AgentActivityConsole, type ActivityEvent, type DemoRequestKind } from '../authorization/AgentActivityConsole';
import { AuthorizationOutcome } from '../authorization/AuthorizationOutcome';
import { ProofProgress } from '../authorization/ProofProgress';
import type {
  AuthorizationReceipt,
  AuthorizationResult,
  CapabilityOwnerState,
  ProofStep,
} from '../../types/domain';

type RejectedAuthorization = Extract<AuthorizationResult, { status: 'rejected' }>;
type VerificationState = 'idle' | 'verifying' | 'verified' | 'invalid';

interface CapabilityDashboardProps {
  capability: CapabilityOwnerState;
  operationBusy: boolean;
  authorizationBusy: boolean;
  clientError: string | null;
  proofSteps: ProofStep[];
  activeRequestLabel?: string;
  approvedReceipt: AuthorizationReceipt | null;
  rejection: RejectedAuthorization | null;
  verification: VerificationState;
  canReplay: boolean;
  events: ActivityEvent[];
  onRevoke: () => Promise<void>;
  onRunAuthorization: (kind: DemoRequestKind) => Promise<void>;
  onVerifyReceipt: () => Promise<void>;
  onStartOver: () => void;
}

export function CapabilityDashboard({
  capability,
  operationBusy,
  authorizationBusy,
  clientError,
  proofSteps,
  activeRequestLabel,
  approvedReceipt,
  rejection,
  verification,
  canReplay,
  events,
  onRevoke,
  onRunAuthorization,
  onVerifyReceipt,
  onStartOver,
}: CapabilityDashboardProps) {
  const interactionBusy = operationBusy || authorizationBusy;
  const [copyStatus, setCopyStatus] = useState('');
  const [confirmingRevoke, setConfirmingRevoke] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const revokeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const copy = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopyStatus(`${label} copied.`);
    } catch {
      setCopyStatus(`Could not copy ${label.toLowerCase()}.`);
    }
  };

  const cancelRevoke = () => {
    setConfirmingRevoke(false);
    requestAnimationFrame(() => revokeButtonRef.current?.focus());
  };

  const confirmRevoke = async () => {
    await onRevoke();
    setConfirmingRevoke(false);
  };

  return (
    <section className="workflow-section" aria-labelledby="dashboard-title">
      <div className="workspace-topline">
        <div className="workflow-heading dashboard-heading">
          <span className="eyebrow">Owner view · private values visible</span>
          <h1 id="dashboard-title" ref={headingRef} tabIndex={-1}>
            {capability.alias}
          </h1>
          <p>Capability alias shown instead of an owner wallet.</p>
        </div>
        <div className="dashboard-actions">
          <span className={`status-badge status-${capability.status}`}>
            {capability.status === 'active' ? <Shield aria-hidden="true" size={15} /> : <ShieldOff aria-hidden="true" size={15} />}
            {capability.status === 'active' ? 'Active' : 'Revoked'}
          </span>
          <button className="button button-secondary" type="button" onClick={onStartOver} disabled={interactionBusy}>
            <RotateCcw aria-hidden="true" size={16} />
            New capability
          </button>
        </div>
      </div>

      <div className="dashboard-grid">
        <article className="panel-light capability-card">
          <div className="form-section-heading">
            <Shield aria-hidden="true" size={20} />
            <div>
              <h2>Capability control</h2>
              <p>Demo capability fixture · not an on-chain transaction</p>
            </div>
          </div>

          <div className="metrics-grid">
            <div>
              <span>Uses remaining</span>
              <strong>{capability.usesRemaining}</strong>
              <small>of {capability.policy.maxUses}</small>
            </div>
            <div>
              <span>Remaining budget</span>
              <strong>{capability.remainingBudget}</strong>
              <small>credits</small>
            </div>
          </div>

          <dl className="policy-summary">
            <div>
              <dt>Delegated agent</dt>
              <dd>{capability.policy.agentName}</dd>
            </div>
            <div>
              <dt>Per transaction</dt>
              <dd>{capability.policy.perTransactionLimit} credits</dd>
            </div>
            <div>
              <dt>Allowed category</dt>
              <dd>{capability.policy.allowedCategory}</dd>
            </div>
          </dl>

          {capability.status === 'active' ? (
            confirmingRevoke ? (
              <div className="revoke-confirmation" role="group" aria-labelledby="revoke-title">
                <div>
                  <strong id="revoke-title">Revoke this capability?</strong>
                  <span>All later requests will be rejected. Existing demo receipts remain unchanged.</span>
                </div>
                <div>
                  <button className="button button-ghost-light" type="button" onClick={cancelRevoke} disabled={interactionBusy}>
                    Cancel
                  </button>
                  <button className="button button-danger" type="button" onClick={() => void confirmRevoke()} disabled={interactionBusy} autoFocus>
                    {interactionBusy ? 'Revoking…' : 'Confirm revoke'}
                  </button>
                </div>
              </div>
            ) : (
              <button
                ref={revokeButtonRef}
                className="text-action text-action-danger"
                type="button"
                onClick={() => setConfirmingRevoke(true)}
                disabled={interactionBusy}
              >
                Revoke capability
              </button>
            )
          ) : (
            <div className="revoked-note" role="status">
              <Check aria-hidden="true" size={16} />
              Demo revocation fixture committed. New requests are disabled.
            </div>
          )}
        </article>

        <article className="commitment-card">
          <div className="commitment-heading">
            <div>
              <span className="eyebrow">Public surface</span>
              <h2>Commitments only</h2>
            </div>
            <Eye aria-hidden="true" size={20} />
          </div>
          <HashRow label="Capability ID" value={capability.capabilityId} onCopy={copy} />
          <HashRow label="Policy commitment" value={capability.policyCommitment} onCopy={copy} />
          <HashRow label="Spend-state commitment" value={capability.spendStateCommitment} onCopy={copy} />
          <div className="chain-learned">
            <strong>What this fixture exposes</strong>
            <p>An opaque ID, commitments, and revocation status—not readable limits.</p>
          </div>
        </article>
      </div>

      {clientError ? (
        <div className="workflow-error" role="alert" aria-live="assertive">
          {clientError}
        </div>
      ) : null}

      <AgentActivityConsole
        capabilityStatus={capability.status}
        busy={interactionBusy}
        canReplay={canReplay}
        events={events}
        onRun={onRunAuthorization}
        onReset={onStartOver}
      />

      {authorizationBusy || proofSteps.length > 0 || approvedReceipt || rejection ? (
        <div className="authorization-grid">
          <ProofProgress steps={proofSteps} busy={authorizationBusy} requestLabel={activeRequestLabel} />
          <AuthorizationOutcome
            receipt={approvedReceipt}
            rejection={rejection}
            verification={verification}
            onVerify={onVerifyReceipt}
          />
        </div>
      ) : null}

      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {copyStatus}
      </div>
    </section>
  );
}

function HashRow({
  label,
  value,
  onCopy,
}: {
  label: string;
  value: string;
  onCopy: (label: string, value: string) => Promise<void>;
}) {
  return (
    <div className="hash-row">
      <div>
        <span>{label}</span>
        <code title={value}>{shorten(value)}</code>
      </div>
      <button type="button" onClick={() => void onCopy(label, value)} aria-label={`Copy full ${label.toLowerCase()}`}>
        <Clipboard aria-hidden="true" size={16} />
      </button>
    </div>
  );
}

function shorten(value: string): string {
  if (value.length <= 28) return value;
  return `${value.slice(0, 14)}…${value.slice(-10)}`;
}
