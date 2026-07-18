import { Moat, advanceSpendStateAfterAuthorization, createMoatPrivateState, type MoatPrivateState } from '@latch/contract';

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
import type { DeployedMoat } from './deploy.js';
import { moatContractAddress } from './deploy.js';
import { assertCreatablePolicy } from './mock-client.js';
import { MOAT_PRIVATE_STATE_ID } from './moat-compiled.js';
import type { MoatProviders } from './providers.js';
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

const PUBLIC_REJECTION = 'Authorization rejected. No private policy values were disclosed.';

function proofTemplate(detail = 'Midnight proof path'): ProofStep[] {
  return [
    { id: 'prepare-witness', label: 'Preparing private witness', status: 'waiting', detail },
    { id: 'derive-destination', label: 'Deriving one-time destination', status: 'waiting', detail },
    { id: 'open-policy', label: 'Opening policy commitment', status: 'waiting', detail },
    { id: 'evaluate-constraints', label: 'Evaluating hidden spending constraints', status: 'waiting', detail },
    { id: 'check-nullifier', label: 'Checking nullifier', status: 'waiting', detail },
    { id: 'submit-proof', label: 'Generating/submitting Midnight proof', status: 'waiting', detail },
    { id: 'commit-receipt', label: 'Receipt committed', status: 'waiting', detail },
  ];
}

async function markSteps(
  steps: ProofStep[],
  throughId: string,
  onProofStep?: (step: ProofStep) => void,
  failAt?: string,
): Promise<ProofStep[]> {
  const updated = steps.map((s) => ({ ...s }));
  for (const step of updated) {
    step.status = 'running';
    onProofStep?.({ ...step });
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

export type RealMoatClientOptions = {
  providers: MoatProviders;
  deployed: DeployedMoat;
  networkId: string;
  /** Optional wallet addresses for connectWallet snapshot. */
  shieldedAddress?: string;
  unshieldedAddress?: string;
};

/**
 * Midnight-backed MoatClient. Requires a funded wallet provider + deployed/joined contract.
 * Capability openings are kept in-process (hackathon); agent secrets must be registered so
 * `hashAgentKey(agentSecret)` opens the policy `agentKeyHash` (circuit requirement).
 */
export class RealMoatClient implements MoatClient {
  readonly #providers: MoatProviders;
  readonly #deployed: DeployedMoat;
  readonly #networkId: string;
  readonly #shieldedAddress?: string;
  readonly #unshieldedAddress?: string;
  readonly #openings = new Map<string, MoatPrivateState>();
  readonly #agentSecrets = new Map<string, Uint8Array>();

  constructor(options: RealMoatClientOptions) {
    this.#providers = options.providers;
    this.#deployed = options.deployed;
    this.#networkId = options.networkId;
    this.#shieldedAddress = options.shieldedAddress;
    this.#unshieldedAddress = options.unshieldedAddress;
    this.#providers.privateStateProvider.setContractAddress(moatContractAddress(options.deployed));
  }

  /**
   * Register the agent preimage used by `authorizeSpend` nullifiers / agent binding.
   * Required before a real spend — the circuit asserts `hashAgentKey(agentSecret) == agentKeyHash`.
   */
  registerAgentSecret(agentKeyHash: string, agentSecret: Uint8Array | string): void {
    const secret = typeof agentSecret === 'string' ? normalizeBytes32(agentSecret) : agentSecret;
    if (secret.length !== 32) throw new Error('agentSecret must be 32 bytes');
    const expected = toHex32(normalizeBytes32(agentKeyHash));
    const actual = toHex32(hashAgentKey(secret));
    if (actual !== expected) {
      throw new Error('agentSecret does not open agentKeyHash');
    }
    this.#agentSecrets.set(expected, secret);
  }

  async connectWallet(): Promise<WalletSnapshot> {
    return {
      connected: true,
      networkId: this.#networkId,
      shieldedAddress: this.#shieldedAddress,
      unshieldedAddress: this.#unshieldedAddress,
    };
  }

  async createCapability(input: CreateCapabilityInput): Promise<CreateCapabilityResult> {
    assertCreatablePolicy(input.policy);

    const ownerSecret = randomBytes32();
    const policySalt = randomBytes32();
    const stateSalt = randomBytes32();
    const agentKeyHash = normalizeBytes32(input.policy.agentKeyHash);
    const agentSecret = this.#agentSecrets.get(toHex32(agentKeyHash));
    if (!agentSecret) {
      throw new Error(
        'registerAgentSecret(agentKeyHash, agentSecret) before createCapability so authorizeSpend can open the policy',
      );
    }

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

    await this.#providers.privateStateProvider.set(MOAT_PRIVATE_STATE_ID, privateState);
    const tx = await this.#deployed.callTx.createCapability(policyCommitment, spendStateCommitment);
    const idHex = toHex32(capabilityId);
    this.#openings.set(idHex, privateState);

    return {
      capabilityId: idHex,
      policyCommitment: toHex32(policyCommitment),
      spendStateCommitment: toHex32(spendStateCommitment),
      ownerCommitment: toHex32(ownerCommitment),
      txHash: String(tx.public.txId),
    };
  }

  async authorizeSpend(input: {
    capabilityId: string;
    request: SpendRequest;
    onProofStep?: (step: ProofStep) => void;
  }): Promise<AuthorizationResult> {
    const steps = proofTemplate();
    const openings = this.#openings.get(input.capabilityId);
    if (!openings) {
      return {
        status: 'rejected',
        capabilityId: input.capabilityId,
        requestCommitment: toHex32(randomBytes32()),
        publicMessage: PUBLIC_REJECTION,
        privateReason: 'revoked',
        proofSteps: await markSteps(steps, 'open-policy', input.onProofStep, 'open-policy'),
      };
    }

    const destination = await generateOneTimeDestination(
      input.request.merchant,
      input.request.requestNonce,
    );

    let privateState: MoatPrivateState = {
      ...openings,
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
      proofSteps: await markSteps(steps, failAt, input.onProofStep, failAt),
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

    try {
      await markSteps(steps, 'check-nullifier', input.onProofStep);
      await this.#providers.privateStateProvider.set(MOAT_PRIVATE_STATE_ID, privateState);
      input.onProofStep?.({
        id: 'submit-proof',
        label: 'Generating/submitting Midnight proof',
        status: 'running',
        detail: 'Midnight proof path',
      });
      const tx = await this.#deployed.callTx.authorizeSpend(capabilityId);
      const proofSteps = await markSteps(steps, 'commit-receipt', input.onProofStep);
      privateState = advanceSpendStateAfterAuthorization(privateState);
      this.#openings.set(input.capabilityId, privateState);
      await this.#providers.privateStateProvider.set(MOAT_PRIVATE_STATE_ID, privateState);

      return {
        status: 'approved',
        capabilityId: input.capabilityId,
        requestCommitment: toHex32(requestCommitment),
        receiptCommitment: toHex32(receiptCommitment),
        nullifier: toHex32(nullifier),
        oneTimeDestination: destination,
        txHash: String(tx.public.txId),
        publicMessage: 'Authorization accepted on Midnight.',
        proofSteps,
      };
    } catch {
      return {
        status: 'rejected',
        capabilityId: input.capabilityId,
        requestCommitment: toHex32(requestCommitment),
        publicMessage: PUBLIC_REJECTION,
        privateReason: 'replay',
        proofSteps: await markSteps(steps, 'submit-proof', input.onProofStep, 'submit-proof'),
      };
    }
  }

  async revokeCapability(capabilityId: string): Promise<TxResult> {
    const openings = this.#openings.get(capabilityId);
    if (!openings) return { success: false };
    await this.#providers.privateStateProvider.set(MOAT_PRIVATE_STATE_ID, openings);
    const tx = await this.#deployed.callTx.revokeCapability(normalizeBytes32(capabilityId));
    return { success: true, txHash: String(tx.public.txId) };
  }

  async getCapability(capabilityId: string): Promise<CapabilityPublicState | null> {
    const address = moatContractAddress(this.#deployed);
    const contractState = await this.#providers.publicDataProvider.queryContractState(address);
    if (!contractState) return null;
    const ledger = Moat.ledger(contractState.data);
    const key = normalizeBytes32(capabilityId);
    if (!ledger.capabilities.member(key)) return null;
    const record = ledger.capabilities.lookup(key);
    return {
      capabilityId,
      policyCommitment: toHex32(record.policyCommitment),
      spendStateCommitment: toHex32(record.spendStateCommitment),
      ownerCommitment: toHex32(record.ownerCommitment),
      revoked: record.revoked,
    };
  }

  async verifyReceipt(receiptCommitment: string): Promise<boolean> {
    const address = moatContractAddress(this.#deployed);
    const contractState = await this.#providers.publicDataProvider.queryContractState(address);
    if (!contractState) return false;
    const ledger = Moat.ledger(contractState.data);
    return ledger.verifiedReceipts.member(normalizeBytes32(receiptCommitment));
  }

  async generateOneTimeDestination(
    merchant: Parameters<MoatClient['generateOneTimeDestination']>[0],
    requestNonce: string,
  ) {
    return generateOneTimeDestination(merchant, requestNonce);
  }
}
