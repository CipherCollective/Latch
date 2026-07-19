import type {
  AuthorizationReceipt,
  AuthorizationResult,
  CapabilityOwnerState,
  CapabilityPublicState,
  ProofStep,
} from '../types/domain';

export const PUBLIC_REJECTION_MESSAGE =
  'Authorization rejected. No private policy values were disclosed.' as const;

export type ObserverVerificationStatus = 'idle' | 'verifying' | 'verified' | 'invalid' | 'unavailable';

export interface ObserverProofState {
  overall: 'idle' | 'running' | 'approved' | 'rejected';
  steps: Array<{
    label: string;
    status: ProofStep['status'];
  }>;
}

export interface ObserverReceiptProjection {
  capabilityId: string;
  requestCommitment: string;
  receiptCommitment: string;
  nullifier: string;
  capabilityStatus: CapabilityPublicState['status'];
  proofStatus: ObserverProofState['overall'];
  verificationStatus: ObserverVerificationStatus;
}

export interface ObserverWorkspaceModel {
  capability: CapabilityPublicState;
  proof: ObserverProofState;
  receipt: ObserverReceiptProjection | null;
  rejection: typeof PUBLIC_REJECTION_MESSAGE | null;
  transcript: string[];
}

type RejectedAuthorization = Extract<AuthorizationResult, { status: 'rejected' }>;

interface ObserverWorkspaceInput {
  capability: CapabilityOwnerState | CapabilityPublicState;
  proofSteps: readonly ProofStep[];
  receipt: AuthorizationReceipt | null;
  rejection: RejectedAuthorization | null;
  verification: ObserverVerificationStatus;
  authorizationBusy: boolean;
}

function requireString(value: unknown, path: string): string {
  if (typeof value !== 'string') {
    throw new TypeError(`${path} must be a string.`);
  }

  return value;
}

function requireCapabilityId(value: unknown, path: string): string {
  const id = requireString(value, path);
  if (!/^(?:cap_[a-z0-9_-]{8,128}|0x[0-9a-fA-F]{64})$/.test(id)) {
    throw new TypeError(`${path} must be an opaque capability identifier.`);
  }
  return id.startsWith('0x') ? `0x${id.slice(2).toLowerCase()}` : id;
}

function requireCommitment(value: unknown, path: string): string {
  const commitment = requireString(value, path);
  if (!/^0x[0-9a-fA-F]{64}$/.test(commitment)) {
    throw new TypeError(`${path} must be a 32-byte hexadecimal commitment.`);
  }
  return `0x${commitment.slice(2).toLowerCase()}`;
}

function requireCapabilityStatus(value: unknown): CapabilityPublicState['status'] {
  if (value !== 'active' && value !== 'revoked') {
    throw new TypeError('capability status must be active or revoked.');
  }

  return value;
}

function requireProofStepStatus(value: unknown, path: string): ProofStep['status'] {
  if (value !== 'waiting' && value !== 'running' && value !== 'passed' && value !== 'failed') {
    throw new TypeError(`${path} must be a recognized proof status.`);
  }

  return value;
}

function requireApprovedProofStatus(value: unknown): 'approved' {
  if (value !== 'approved') {
    throw new TypeError('proofStatus must be approved for an observer receipt.');
  }
  return value;
}

function requireVerificationStatus(value: unknown): ObserverVerificationStatus {
  if (
    value !== 'idle' &&
    value !== 'verifying' &&
    value !== 'verified' &&
    value !== 'invalid' &&
    value !== 'unavailable'
  ) {
    throw new TypeError('verificationStatus must be a recognized verification status.');
  }

  return value;
}

/**
 * Constructs a public capability value from scratch. No owner-scoped object or
 * nested reference is retained by the observer model.
 */
export function toObserverCapability(
  owner: CapabilityOwnerState | CapabilityPublicState,
): CapabilityPublicState {
  return {
    capabilityId: requireCapabilityId(owner.capabilityId, 'capabilityId'),
    status: requireCapabilityStatus(owner.status),
    policyCommitment: requireCommitment(owner.policyCommitment, 'policyCommitment'),
    spendStateCommitment: requireCommitment(owner.spendStateCommitment, 'spendStateCommitment'),
  };
}

/**
 * Returns fresh, fixed observer copy for a validated aggregate proof state.
 * Unknown runtime values produce no transcript so the final rendering boundary
 * cannot disclose caller-provided activity text.
 */
export function observerTranscriptForStatus(overall: unknown): string[] {
  if (overall === 'idle') return [];
  if (overall === 'running') {
    return ['Private purchase request submitted', 'Demo authorization fixture in progress'];
  }
  if (overall === 'approved') {
    return [
      'Private purchase request submitted',
      'Private authorization approved',
      'Public receipt commitment available',
    ];
  }

  if (overall === 'rejected') {
    return ['Private purchase request submitted', PUBLIC_REJECTION_MESSAGE];
  }

  return [];
}

function projectObserverReceipt(
  receipt: AuthorizationReceipt,
  capability: CapabilityPublicState,
  verificationStatus: ObserverVerificationStatus,
): ObserverReceiptProjection {
  const capabilityId = requireCapabilityId(receipt.capabilityId, 'receipt.capabilityId');
  if (capabilityId !== capability.capabilityId) {
    throw new TypeError('receipt.capabilityId must match the projected capability.');
  }
  return {
    capabilityId,
    requestCommitment: requireCommitment(receipt.requestCommitment, 'receipt.requestCommitment'),
    receiptCommitment: requireCommitment(receipt.receiptCommitment, 'receipt.receiptCommitment'),
    nullifier: requireCommitment(receipt.nullifier, 'receipt.nullifier'),
    capabilityStatus: requireCapabilityStatus(capability.status),
    proofStatus: 'approved',
    verificationStatus: requireVerificationStatus(verificationStatus),
  };
}

/**
 * Builds the complete render model for observer mode without accepting owner
 * transcript events. Rejections deliberately discard all individual proof
 * steps so the failed assertion cannot be inferred from its position.
 */
export function buildObserverWorkspaceModel({
  capability,
  proofSteps,
  receipt,
  rejection,
  verification,
  authorizationBusy,
}: ObserverWorkspaceInput): ObserverWorkspaceModel {
  const publicCapability = toObserverCapability(capability);
  const proofStatuses = proofSteps.map((step, index) =>
    requireProofStepStatus(step.status, `proofSteps[${index}].status`),
  );
  const hasFailedStep = proofStatuses.some((status) => status === 'failed');
  const isRejected = rejection !== null || hasFailedStep;
  const overall: ObserverProofState['overall'] = isRejected
    ? 'rejected'
    : authorizationBusy
      ? 'running'
      : receipt !== null
        ? 'approved'
        : 'idle';
  const proof: ObserverProofState = {
    overall,
    // Observer mode intentionally exposes only the aggregate result. Raw
    // labels, step positions, details, and timing can encode private failure
    // information even when their property names look harmless.
    steps: [],
  };

  return {
    capability: publicCapability,
    proof,
    receipt:
      receipt !== null && overall === 'approved'
        ? projectObserverReceipt(receipt, publicCapability, verification)
        : null,
    rejection: isRejected ? PUBLIC_REJECTION_MESSAGE : null,
    transcript: observerTranscriptForStatus(overall),
  };
}

/**
 * Serializes a fresh receipt allowlist. Runtime-injected properties on the
 * projection object are intentionally unreachable from the returned JSON.
 */
export function serializeObserverReceipt(projection: ObserverReceiptProjection): string {
  const payload: ObserverReceiptProjection = {
    capabilityId: requireCapabilityId(projection.capabilityId, 'capabilityId'),
    requestCommitment: requireCommitment(projection.requestCommitment, 'requestCommitment'),
    receiptCommitment: requireCommitment(projection.receiptCommitment, 'receiptCommitment'),
    nullifier: requireCommitment(projection.nullifier, 'nullifier'),
    capabilityStatus: requireCapabilityStatus(projection.capabilityStatus),
    proofStatus: requireApprovedProofStatus(projection.proofStatus),
    verificationStatus: requireVerificationStatus(projection.verificationStatus),
  };

  return JSON.stringify(payload, null, 2);
}
