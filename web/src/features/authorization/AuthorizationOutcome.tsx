import { useState } from 'react';
import { CheckCircle2, Clipboard, ExternalLink, ShieldAlert, ShieldCheck } from 'lucide-react';
import { serializeOwnerReceipt } from '../../lib/receipt-serialization';
import type { AuthorizationReceipt, AuthorizationResult, PrivateRejectionCode } from '../../types/domain';

type RejectedAuthorization = Extract<AuthorizationResult, { status: 'rejected' }>;
type VerificationState = 'idle' | 'verifying' | 'verified' | 'invalid';

interface AuthorizationOutcomeProps {
  receipt: AuthorizationReceipt | null;
  rejection: RejectedAuthorization | null;
  verification: VerificationState;
  onVerify: () => Promise<void>;
}

const privateRejectionExplanations: Record<PrivateRejectionCode, string> = {
  PER_TX_LIMIT: 'This request did not satisfy the private per-transaction limit.',
  TOTAL_BUDGET: 'This request did not fit within the private remaining budget.',
  MAX_USES: 'This capability has no private authorizations remaining.',
  CATEGORY: 'This request did not match the private allowed category.',
  REPLAY: 'This authorization was already consumed and cannot be replayed.',
  REVOKED: 'This capability has been revoked.',
  UNKNOWN: 'This request did not satisfy the private authorization policy.',
};

const verificationCopy: Record<VerificationState, string> = {
  idle: 'Receipt has not been independently verified.',
  verifying: 'Verifying receipt.',
  verified: 'Receipt verification passed.',
  invalid: 'Receipt verification failed.',
};

function safeHttpsUrl(value: string | undefined): string | null {
  if (!value) return null;

  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function ReceiptField({ label, value }: { label: string; value: string }) {
  return (
    <div className="receipt-field">
      <dt>{label}</dt>
      <dd>
        <code title={value}>{value}</code>
      </dd>
    </div>
  );
}

function RejectedOutcome({ rejection }: { rejection: RejectedAuthorization }) {
  const ownerExplanation = privateRejectionExplanations[rejection.privateReason ?? 'UNKNOWN'];

  return (
    <section className="authorization-outcome authorization-rejected" aria-labelledby="authorization-rejected-title">
      <div className="outcome-heading">
        <ShieldAlert aria-hidden="true" size={24} />
        <div>
          <span className="eyebrow">Owner-private result</span>
          <h2 id="authorization-rejected-title">Authorization rejected</h2>
        </div>
      </div>
      <p className="private-rejection-explanation">{ownerExplanation}</p>
      <div className="public-rejection-message">
        <strong>Public result</strong>
        <p>{rejection.publicMessage}</p>
      </div>
    </section>
  );
}

function ApprovedOutcome({
  receipt,
  verification,
  onVerify,
}: {
  receipt: AuthorizationReceipt;
  verification: VerificationState;
  onVerify: () => Promise<void>;
}) {
  const [copyStatus, setCopyStatus] = useState('');
  const [verifyFailure, setVerifyFailure] = useState('');
  const isDemoFixture = receipt.tx.kind === 'demo-fixture';
  const explorerUrl = receipt.tx.kind === 'midnight-transaction' ? safeHttpsUrl(receipt.tx.explorerUrl) : null;
  const realTxHash = receipt.tx.kind === 'midnight-transaction' ? receipt.tx.txHash : undefined;

  const copyReceipt = async () => {
    try {
      await navigator.clipboard.writeText(serializeOwnerReceipt(receipt));
      setCopyStatus('Receipt JSON copied.');
    } catch {
      setCopyStatus('Could not copy receipt JSON.');
    }
  };

  const verifyReceipt = async () => {
    setVerifyFailure('');
    try {
      await onVerify();
    } catch {
      setVerifyFailure('Receipt verification could not complete.');
    }
  };

  return (
    <section className="authorization-outcome authorization-approved" aria-labelledby="authorization-approved-title">
      <div className="outcome-heading approved-heading">
        <ShieldCheck aria-hidden="true" size={24} />
        <div>
          <span className="verified-authorization-badge">
            <CheckCircle2 aria-hidden="true" size={16} />
            Verified authorization
          </span>
          <h2 id="authorization-approved-title">Private gate passed</h2>
        </div>
      </div>

      {isDemoFixture ? <p className="demo-receipt-disclaimer">Demo authorization fixture - not an on-chain transaction</p> : null}

      <dl className="receipt-fields">
        <ReceiptField label="Capability ID" value={receipt.capabilityId} />
        <ReceiptField label="Request commitment" value={receipt.requestCommitment} />
        <ReceiptField label="Receipt commitment" value={receipt.receiptCommitment} />
        <ReceiptField label="Nullifier" value={receipt.nullifier} />
        <ReceiptField
          label={receipt.oneTimeDestination.fixture ? 'Demo one-time destination fixture' : 'One-time destination'}
          value={receipt.oneTimeDestination.destination}
        />
        {realTxHash ? <ReceiptField label="Transaction hash" value={realTxHash} /> : null}
      </dl>

      {explorerUrl && realTxHash ? (
        <a className="receipt-explorer-link" href={explorerUrl} target="_blank" rel="noreferrer noopener">
          View transaction in explorer
          <ExternalLink aria-hidden="true" size={15} />
        </a>
      ) : null}

      <details className="destination-details">
        <summary>Ephemeral destination details</summary>
        <dl>
          <ReceiptField label="Ephemeral public key" value={receipt.oneTimeDestination.ephemeralPublicKey} />
          <ReceiptField label="View tag" value={receipt.oneTimeDestination.viewTag} />
        </dl>
      </details>

      <div className="receipt-privacy-comparison">
        <div>
          <strong>What the chain learned</strong>
          <p>
            {isDemoFixture
              ? 'A deterministic authorization fixture was accepted and a demo nullifier was consumed.'
              : 'An authorization proof was accepted and a nullifier was consumed.'}
          </p>
        </div>
        <div>
          <strong>What stayed private</strong>
          <p>Not included in this receipt: policy values, purchase details, agent identity, or a private witness.</p>
        </div>
      </div>

      <div className="receipt-actions">
        <button className="button button-secondary" type="button" onClick={() => void copyReceipt()}>
          <Clipboard aria-hidden="true" size={16} />
          Copy receipt JSON
        </button>
        <button
          className="button button-primary"
          type="button"
          onClick={() => void verifyReceipt()}
          disabled={verification === 'verifying'}
        >
          <ShieldCheck aria-hidden="true" size={16} />
          {verification === 'verifying' ? 'Verifying receipt…' : 'Verify receipt'}
        </button>
      </div>

      <p
        className={`receipt-verification-status verification-${verification}`}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {verifyFailure || verificationCopy[verification]}
      </p>
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {copyStatus}
      </div>
    </section>
  );
}

export function AuthorizationOutcome({ receipt, rejection, verification, onVerify }: AuthorizationOutcomeProps) {
  if (!receipt && !rejection) return null;

  return (
    <div className="authorization-outcomes">
      {rejection ? <RejectedOutcome rejection={rejection} /> : null}
      {receipt ? <ApprovedOutcome receipt={receipt} verification={verification} onVerify={onVerify} /> : null}
    </div>
  );
}
