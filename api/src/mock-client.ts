import { advanceSpendStateAfterAuthorization, createMoatPrivateState } from '@latch/contract';

import {
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
  PolicyInput,
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
const UINT64_MAX = (1n << 64n) - 1n;
const UINT32_MAX = (1n << 32n) - 1n;

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

/** Mirror Compact createCapability policy asserts (Uint ranges + positivity). */
export function assertCreatablePolicy(policy: PolicyInput): void {
  const perTx = policy.perTransactionLimit;
  const budget = policy.totalBudget;
  const uses = BigInt(policy.maxUses);

  if (perTx <= 0n || budget <= 0n || uses <= 0n) {
    throw new Error('invalid policy: limits must be positive');
  }
  if (perTx > budget) {
    throw new Error('invalid policy: perTransactionLimit exceeds totalBudget');
  }
  if (perTx > UINT64_MAX || budget > UINT64_MAX) {
    throw new Error('invalid policy: amount exceeds Uint<64>');
  }
  if (uses > UINT32_MAX) {
    throw new Error('invalid policy: maxUses exceeds Uint<32>');
  }

  const hex = policy.agentKeyHash.startsWith('0x') ? policy.agentKeyHash.slice(2) : policy.agentKeyHash;
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error('invalid policy: agentKeyHash must be 32-byte hex');
  }
}

/**
 * Deterministic demo MoatClient — clearly labeled demo fixtures, no chain txs.
 */
export class MockMoatClient implements MoatClient {
  readonly #capabilities = new Map<string, StoredCapability>();
  readonly #receipts = new Set<string>();
  readonly #nullifiers = new Set<string>();
  readonly #locks = new Map<string, Promise<unknown>>();
  readonly #stepDelayMs: number;

  constructor(options?: { stepDelayMs?: number }) {
    this.#stepDelayMs = options?.stepDelayMs ?? 0;
  }

  async #withCapabilityLock<T>(capabilityId: string, fn: () => Promise<T>): Promise<T> {
    const previous = this.#locks.get(capabilityId) ?? Promise.resolve();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    // Single shared promise reference: must store the same object we compare on cleanup.
    // Swallow prior rejection so a failed authorize does not poison the chain.
    const chained = previous.catch(() => undefined).then(() => gate);
    this.#locks.set(capabilityId, chained);
    await previous.catch(() => undefined);
    try {
      return await fn();
    } finally {
      release();
      if (this.#locks.get(capabilityId) === chained) this.#locks.delete(capabilityId);
    }
  }

  /** @internal Regression helper — lock map must not leak entries after authorize/revoke. */
  debugLockEntryCount(): number {
    return this.#locks.size;
  }

  /** @internal Regression helper — reserved nullifiers visible for tests. */
  debugHasNullifier(nullifierHex: string): boolean {
    return this.#nullifiers.has(nullifierHex);
  }

  async connectWallet(): Promise<WalletSnapshot> {
    return {
      connected: false,
      networkId: 'demo',
    };
  }

  async createCapability(input: CreateCapabilityInput): Promise<CreateCapabilityResult> {
    assertCreatablePolicy(input.policy);

    const ownerSecret = randomBytes32();
    const policySalt = randomBytes32();
    const stateSalt = randomBytes32();
    // Bind the public policy agent key hash from the caller (Atharv / UI).
    // Demo nullifiers still need a local agentSecret; the real client must use
    // an agentSecret that opens this same hash via hashAgentKey.
    const agentKeyHash = normalizeBytes32(input.policy.agentKeyHash);
    const agentSecret = randomBytes32();
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

    return this.#withCapabilityLock(input.capabilityId, async () => {
      const steps = proofTemplate();
      const emptyRequestCommitment = toHex32(randomBytes32());
      const stored = this.#capabilities.get(input.capabilityId);

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

      const privateState = {
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

      // Reserve before awaiting proof-step callbacks so concurrent calls cannot both approve.
      this.#nullifiers.add(nullifierHex);

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

      try {
        const proofSteps = await runSteps(steps, 'commit-receipt', input.onProofStep);

        // Re-check after yielding — revoke during steps must still win.
        if (stored.publicState.revoked) {
          this.#nullifiers.delete(nullifierHex);
          return {
            status: 'rejected',
            capabilityId: input.capabilityId,
            requestCommitment: toHex32(requestCommitment),
            publicMessage: PUBLIC_REJECTION,
            privateReason: 'revoked',
            proofSteps: proofSteps.map((step) =>
              step.id === 'commit-receipt' ? { ...step, status: 'failed' as const } : step,
            ),
          };
        }

        this.#receipts.add(receiptHex);
        stored.privateState = advanceSpendStateAfterAuthorization(privateState);
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
      } catch (error) {
        // onProofStep (or other post-reserve work) threw — do not leave a burned nullifier.
        this.#nullifiers.delete(nullifierHex);
        throw error;
      }
    });
  }

  async revokeCapability(capabilityId: string): Promise<TxResult> {
    return this.#withCapabilityLock(capabilityId, async () => {
      const stored = this.#capabilities.get(capabilityId);
      if (!stored) return { success: false };
      stored.publicState = { ...stored.publicState, revoked: true };
      return { success: true };
    });
  }

  async getCapability(capabilityId: string): Promise<CapabilityPublicState | null> {
    const publicState = this.#capabilities.get(capabilityId)?.publicState;
    return publicState ? { ...publicState } : null;
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
}
