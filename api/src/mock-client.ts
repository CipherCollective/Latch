import { advanceSpendStateAfterAuthorization, createMoatPrivateState } from '@latch/contract';

import {
  hashAgentKey,
  hashCapabilityId,
  hashCategory,
  hashNullifier,
  hashOwner,
  hashPolicy,
  hashReceipt,
  hashRequest,
  hashSpendState,
  normalizeBytes32,
  randomBytes32,
  toHex32,
} from './commitments.js';
import { generateOneTimeDestination } from './stealth.js';
import type {
  AuthorizationResult,
  CapabilityPublicState,
  CreateCapabilityInput,
  CreateCapabilityResult,
  MoatClient,
  PrivateRejectReason,
  ProofStep,
  SpendRequest,
  TxResult,
  WalletSnapshot,
} from './types.js';

type StoredCapability = {
  publicState: CapabilityPublicState;
  privateState: ReturnType<typeof createMoatPrivateState>;
};

const PUBLIC_REJECTION = 'Authorization rejected. No private policy values were disclosed.';

function proofTemplate(): ProofStep[] {
  return [
    { id: 'prepare-witness', label: 'Preparing private witness', status: 'waiting', detail: 'Demo mode' },
    { id: 'derive-destination', label: 'Deriving one-time destination', status: 'waiting', detail: 'Demo mode' },
    { id: 'open-policy', label: 'Opening policy commitment', status: 'waiting', detail: 'Demo mode' },
    { id: 'evaluate-constraints', label: 'Evaluating hidden spending constraints', status: 'waiting', detail: 'Demo mode' },
    { id: 'check-nullifier', label: 'Checking nullifier', status: 'waiting', detail: 'Demo mode' },
    { id: 'submit-proof', label: 'Generating/submitting Midnight proof', status: 'waiting', detail: 'Demo mode' },
    { id: 'commit-receipt', label: 'Receipt committed', status: 'waiting', detail: 'Demo mode' },
  ];
}

async function runSteps(
  steps: ProofStep[],
  throughId: string,
  onProofStep?: (step: ProofStep) => void,
  failAt?: string,
): Promise<ProofStep[]> {
  const updated = steps.map((step) => ({ ...step }));
  for (const step of updated) {
    step.status = 'running';
    onProofStep?.({ ...step });
    await Promise.resolve();
    if (failAt && step.id === failAt) {
      step.status = 'failed';
      onProofStep?.({ ...step });
      break;
    }
    step.status = 'passed';
    onProofStep?.({ ...step });
    if (step.id === throughId) break;
  }
  return updated;
}

/**
 * Deterministic demo MoatClient — clearly labeled demo fixtures, no chain txs.
 */
export class MockMoatClient implements MoatClient {
  readonly #capabilities = new Map<string, StoredCapability>();
  readonly #receipts = new Set<string>();
  readonly #nullifiers = new Set<string>();
  readonly #stepDelayMs: number;

  constructor(options?: { stepDelayMs?: number }) {
    this.#stepDelayMs = options?.stepDelayMs ?? 0;
  }

  async connectWallet(): Promise<WalletSnapshot> {
    return {
      connected: false,
      networkId: 'demo',
    };
  }

  async createCapability(input: CreateCapabilityInput): Promise<CreateCapabilityResult> {
    const ownerSecret = randomBytes32();
    const policySalt = randomBytes32();
    const stateSalt = randomBytes32();
    const agentSecret = randomBytes32();
    // Demo binds a generated agent secret; policy.agentKeyHash is accepted as metadata only.
    const agentKeyHash = hashAgentKey(agentSecret);
    const categoryHash = hashCategory(input.policy.allowedCategory);
    const capabilityId = hashCapabilityId(ownerSecret, policySalt);
    const ownerCommitment = hashOwner(ownerSecret);
    const policyCommitment = hashPolicy({
      capabilityId,
      agentKeyHash,
      perTransactionLimit: input.policy.perTransactionLimit,
      totalBudget: input.policy.totalBudget,
      maxUses: BigInt(input.policy.maxUses),
      allowedCategoryHash: categoryHash,
      policySalt,
    });
    const spendStateCommitment = hashSpendState({
      capabilityId,
      spentSoFar: 0n,
      useCount: 0n,
      stateSalt,
    });

    const privateState = createMoatPrivateState({
      ownerSecret,
      policySalt,
      agentKeyHash,
      perTransactionLimit: input.policy.perTransactionLimit,
      totalBudget: input.policy.totalBudget,
      maxUses: BigInt(input.policy.maxUses),
      allowedCategoryHash: categoryHash,
      stateSalt,
      agentSecret,
      requestCategoryHash: categoryHash,
      requestNonce: randomBytes32(),
      oneTimeDestinationHash: randomBytes32(),
      newStateSalt: randomBytes32(),
      amount: 0n,
    });

    const idHex = toHex32(capabilityId);
    this.#capabilities.set(idHex, {
      privateState,
      publicState: {
        capabilityId: idHex,
        policyCommitment: toHex32(policyCommitment),
        spendStateCommitment: toHex32(spendStateCommitment),
        ownerCommitment: toHex32(ownerCommitment),
        revoked: false,
      },
    });

    return {
      capabilityId: idHex,
      policyCommitment: toHex32(policyCommitment),
      spendStateCommitment: toHex32(spendStateCommitment),
      ownerCommitment: toHex32(ownerCommitment),
    };
  }

  async authorizeSpend(input: {
    capabilityId: string;
    request: SpendRequest;
    onProofStep?: (step: ProofStep) => void;
  }): Promise<AuthorizationResult> {
    if (this.#stepDelayMs > 0) await new Promise((r) => setTimeout(r, this.#stepDelayMs));

    const stored = this.#capabilities.get(input.capabilityId);
    const steps = proofTemplate();
    const emptyRequestCommitment = toHex32(randomBytes32());

    if (!stored) {
      return {
        status: 'rejected',
        capabilityId: input.capabilityId,
        requestCommitment: emptyRequestCommitment,
        publicMessage: PUBLIC_REJECTION,
        privateReason: 'revoked',
        proofSteps: await runSteps(steps, 'open-policy', input.onProofStep, 'open-policy'),
      };
    }

    if (stored.publicState.revoked) {
      return {
        status: 'rejected',
        capabilityId: input.capabilityId,
        requestCommitment: emptyRequestCommitment,
        publicMessage: PUBLIC_REJECTION,
        privateReason: 'revoked',
        proofSteps: await runSteps(steps, 'open-policy', input.onProofStep, 'open-policy'),
      };
    }

    const destination = await this.generateOneTimeDestination(
      input.request.merchant,
      input.request.requestNonce,
    );

    let privateState = {
      ...stored.privateState,
      amount: input.request.amount,
      requestCategoryHash: hashCategory(input.request.category),
      requestNonce: normalizeBytes32(input.request.requestNonce),
      oneTimeDestinationHash: normalizeBytes32(destination.destinationHash),
      newStateSalt: randomBytes32(),
    };

    const capabilityId = normalizeBytes32(input.capabilityId);
    const requestCommitment = hashRequest({
      amount: privateState.amount,
      categoryHash: privateState.requestCategoryHash,
      oneTimeDestinationHash: privateState.oneTimeDestinationHash,
      requestNonce: privateState.requestNonce,
    });

    const reject = async (reason: PrivateRejectReason, failAt: string): Promise<AuthorizationResult> => ({
      status: 'rejected',
      capabilityId: input.capabilityId,
      requestCommitment: toHex32(requestCommitment),
      publicMessage: PUBLIC_REJECTION,
      privateReason: reason,
      proofSteps: await runSteps(steps, failAt, input.onProofStep, failAt),
    });

    if (toHex32(normalizeBytes32(input.request.agentKeyHash)) !== toHex32(privateState.agentKeyHash)) {
      return reject('agent', 'evaluate-constraints');
    }

    if (input.request.amount <= 0n || input.request.amount > privateState.perTransactionLimit) {
      return reject('limit', 'evaluate-constraints');
    }
    if (privateState.spentSoFar + input.request.amount > privateState.totalBudget) {
      return reject('budget', 'evaluate-constraints');
    }
    if (toHex32(hashCategory(input.request.category)) !== toHex32(privateState.allowedCategoryHash)) {
      return reject('category', 'evaluate-constraints');
    }
    if (privateState.useCount >= privateState.maxUses) {
      return reject('uses', 'evaluate-constraints');
    }

    const nullifier = hashNullifier({
      capabilityId,
      requestNonce: privateState.requestNonce,
      agentSecret: privateState.agentSecret,
    });
    const nullifierHex = toHex32(nullifier);
    if (this.#nullifiers.has(nullifierHex)) {
      return reject('replay', 'check-nullifier');
    }

    const newSpendStateCommitment = hashSpendState({
      capabilityId,
      spentSoFar: privateState.spentSoFar + privateState.amount,
      useCount: privateState.useCount + 1n,
      stateSalt: privateState.newStateSalt,
    });
    const receiptCommitment = hashReceipt({
      capabilityId,
      requestCommitment,
      nullifier,
      newSpendStateCommitment,
    });
    const receiptHex = toHex32(receiptCommitment);

    const proofSteps = await runSteps(steps, 'commit-receipt', input.onProofStep);
    this.#nullifiers.add(nullifierHex);
    this.#receipts.add(receiptHex);

    const advanced = advanceSpendStateAfterAuthorization(privateState);
    stored.privateState = advanced;
    stored.publicState = {
      ...stored.publicState,
      spendStateCommitment: toHex32(newSpendStateCommitment),
    };

    return {
      status: 'approved',
      capabilityId: input.capabilityId,
      requestCommitment: toHex32(requestCommitment),
      receiptCommitment: receiptHex,
      nullifier: nullifierHex,
      oneTimeDestination: destination,
      publicMessage: 'Demo authorization fixture accepted. Not an on-chain transaction.',
      proofSteps,
    };
  }

  async revokeCapability(capabilityId: string): Promise<TxResult> {
    const stored = this.#capabilities.get(capabilityId);
    if (!stored) return { success: false };
    stored.publicState = { ...stored.publicState, revoked: true };
    return { success: true };
  }

  async getCapability(capabilityId: string): Promise<CapabilityPublicState | null> {
    return this.#capabilities.get(capabilityId)?.publicState ?? null;
  }

  async verifyReceipt(receiptCommitment: string): Promise<boolean> {
    return this.#receipts.has(receiptCommitment);
  }

  async generateOneTimeDestination(
    merchant: Parameters<MoatClient['generateOneTimeDestination']>[0],
    requestNonce: string,
  ) {
    return generateOneTimeDestination(merchant, requestNonce);
  }

  /** Demo/test helper — not part of the public MoatClient surface Atharv should rely on. */
  demoAgentKeyHash(capabilityId: string): string | undefined {
    const stored = this.#capabilities.get(capabilityId);
    return stored ? toHex32(stored.privateState.agentKeyHash) : undefined;
  }
}
