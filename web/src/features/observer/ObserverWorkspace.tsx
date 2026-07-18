import { useEffect, useRef, useState } from 'react';
import { Clipboard, ShieldCheck } from 'lucide-react';
import {
  observerTranscriptForStatus,
  serializeObserverReceipt,
  type ObserverWorkspaceModel,
} from '../../privacy/observer-serializer';

interface ObserverWorkspaceProps {
  model: ObserverWorkspaceModel;
  onVerifyReceipt: () => Promise<void>;
}

const proofStatusCopy: Record<ObserverWorkspaceModel['proof']['overall'], string> = {
  idle: 'No fixture evaluation',
  running: 'Fixture evaluation in progress',
  approved: 'Fixture approved',
  rejected: 'Fixture rejected',
};

const verificationStatusCopy: Record<
  NonNullable<ObserverWorkspaceModel['receipt']>['verificationStatus'],
  string
> = {
  idle: 'Not independently verified',
  verifying: 'Verification in progress',
  verified: 'Verification passed',
  invalid: 'Verification failed',
  unavailable: 'Verification unavailable. Retry to check this receipt.',
};

function PublicField({ label, value }: { label: string; value: string }) {
  return (
    <div className="observer-field">
      <dt>{label}</dt>
      <dd>
        <code title={value}>{value}</code>
      </dd>
    </div>
  );
}

export function ObserverWorkspace({ model, onVerifyReceipt }: ObserverWorkspaceProps) {
  const [copyAnnouncement, setCopyAnnouncement] = useState('');
  const [verificationAnnouncement, setVerificationAnnouncement] = useState('');
  const headingRef = useRef<HTMLHeadingElement>(null);
  const { capability, proof, receipt, rejection } = model;
  // Derive final DOM output from fixed public copy. `model.transcript` remains
  // informational only and can never become an owner-text rendering bypass.
  const transcript = observerTranscriptForStatus(proof.overall);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const copyReceipt = async () => {
    if (!receipt) return;

    try {
      await navigator.clipboard.writeText(serializeObserverReceipt(receipt));
      setCopyAnnouncement('Public receipt JSON copied.');
    } catch {
      setCopyAnnouncement('Public receipt JSON could not be copied.');
    }
  };

  const verifyReceipt = async () => {
    setVerificationAnnouncement('');
    try {
      await onVerifyReceipt();
    } catch {
      setVerificationAnnouncement('Receipt verification could not complete.');
    }
  };

  return (
    <div className="observer-workspace">
      <section className="observer-introduction" aria-labelledby="observer-workspace-title">
        <span className="eyebrow">Public observer · allowlisted projection</span>
        <h1 id="observer-workspace-title" ref={headingRef} tabIndex={-1}>Public observer</h1>
        <p>
          This view renders only the public protocol projection. Other fields remain outside this view.
        </p>
      </section>

      <section className="observer-capability" aria-labelledby="observer-capability-title">
        <div className="observer-section-heading">
          <div>
            <span className="eyebrow">Public capability state</span>
            <h2 id="observer-capability-title">Capability commitments</h2>
          </div>
          <span className={`status-badge status-${capability.status}`}>
            {capability.status === 'active' ? 'Active' : 'Revoked'}
          </span>
        </div>
        <dl className="observer-fields">
          <PublicField label="Capability ID" value={capability.capabilityId} />
          <PublicField label="Policy commitment" value={capability.policyCommitment} />
          <PublicField label="Spend-state commitment" value={capability.spendStateCommitment} />
        </dl>
      </section>

      <section className="observer-proof" aria-labelledby="observer-proof-title" aria-busy={proof.overall === 'running'}>
        <div className="observer-section-heading">
          <div>
            <span className="eyebrow">Public fixture projection</span>
            <h2 id="observer-proof-title">Demo evaluation status</h2>
          </div>
          <span className={`observer-proof-status observer-proof-${proof.overall}`}>
            {proofStatusCopy[proof.overall]}
          </span>
        </div>

        <p>Per-step labels, timing, and failure locations are not included in this projection.</p>

        <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          Overall demo evaluation status: {proofStatusCopy[proof.overall]}.
        </p>
      </section>

      <section className="observer-transcript" aria-labelledby="observer-transcript-title">
        <span className="eyebrow">Public transcript</span>
        <h2 id="observer-transcript-title">Safe activity</h2>
        {transcript.length > 0 ? (
          <ol aria-label="Public transcript entries">
            {transcript.map((entry, index) => (
              <li key={`${index}-${entry}`}>{entry}</li>
            ))}
          </ol>
        ) : (
          <p>No public activity has been reported.</p>
        )}
      </section>

      {rejection ? (
        <section className="observer-rejection" aria-labelledby="observer-rejection-title">
          <h2 id="observer-rejection-title">Authorization rejected</h2>
          <p role="alert" aria-live="assertive" aria-atomic="true">
            {rejection}
          </p>
        </section>
      ) : null}

      {receipt ? (
        <section className="observer-receipt" aria-labelledby="observer-receipt-title">
          <div className="observer-section-heading">
            <div>
              <span className="eyebrow">Allowlisted public receipt</span>
              <h2 id="observer-receipt-title">Authorization receipt</h2>
            </div>
            <span className="verified-authorization-badge">
              <ShieldCheck aria-hidden="true" size={16} />
              {proofStatusCopy[receipt.proofStatus]}
            </span>
          </div>

          <dl className="observer-fields">
            <PublicField label="Capability ID" value={receipt.capabilityId} />
            <PublicField label="Request commitment" value={receipt.requestCommitment} />
            <PublicField label="Receipt commitment" value={receipt.receiptCommitment} />
            <PublicField label="Nullifier" value={receipt.nullifier} />
            <div className="observer-field">
              <dt>Capability status</dt>
              <dd>{receipt.capabilityStatus === 'active' ? 'Active' : 'Revoked'}</dd>
            </div>
            <div className="observer-field">
              <dt>Demo evaluation status</dt>
              <dd>{proofStatusCopy[receipt.proofStatus]}</dd>
            </div>
            <div className="observer-field">
              <dt>Verification status</dt>
              <dd>{verificationStatusCopy[receipt.verificationStatus]}</dd>
            </div>
          </dl>

          <div className="receipt-actions">
            <button className="button button-secondary" type="button" onClick={() => void copyReceipt()}>
              <Clipboard aria-hidden="true" size={16} />
              Copy public receipt JSON
            </button>
            <button
              className="button button-primary"
              type="button"
              disabled={receipt.verificationStatus === 'verifying'}
              onClick={() => void verifyReceipt()}
            >
              <ShieldCheck aria-hidden="true" size={16} />
              {receipt.verificationStatus === 'verifying' ? 'Verifying receipt…' : 'Verify receipt'}
            </button>
          </div>

          <div aria-live="polite" aria-atomic="true">
            <p className="sr-only" role="status">
              {copyAnnouncement}
            </p>
            <p className="observer-verification-status" role="status">
              {verificationAnnouncement || verificationStatusCopy[receipt.verificationStatus]}
            </p>
          </div>
        </section>
      ) : null}
    </div>
  );
}
