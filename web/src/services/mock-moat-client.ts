import { fixtureHash } from '../demo/fixture-hash';
import { parseDecimal } from '../lib/decimal';
import type { MoatClient } from './moat-client';
import type {
  AuthorizationResult,
  CapabilityOwnerState,
  CreateCapabilityInput,
  CreateCapabilityResult,
  MerchantMetaAddress,
  OneTimeDestination,
  SpendRequest,
  TxResult,
  WalletSnapshot,
} from '../types/domain';

const PUBLIC_REJECTION = 'Authorization rejected. No private policy values were disclosed.' as const;

function cloneCapability(state: CapabilityOwnerState): CapabilityOwnerState {
  return { ...state, policy: { ...state.policy } };
}

export class MockMoatClient implements MoatClient {
  private capability: CapabilityOwnerState | null = null;

  async connectWallet(): Promise<WalletSnapshot> {
    return { mode: 'demo', connectionState: 'disconnected', networkId: 'demo' };
  }

  async createCapability(input: CreateCapabilityInput): Promise<CreateCapabilityResult> {
    const perTransaction = parseDecimal(input.policy.perTransactionLimit);
    const totalBudget = parseDecimal(input.policy.totalBudget);
    if (!perTransaction || !totalBudget) throw new Error('Invalid normalized demo policy.');

    const normalizedInput: CreateCapabilityInput = {
      alias: input.alias.trim(),
      policy: {
        agentName: input.policy.agentName.trim(),
        perTransactionLimit: perTransaction.canonical,
        totalBudget: totalBudget.canonical,
        maxUses: input.policy.maxUses,
        allowedCategory: input.policy.allowedCategory.trim(),
      },
    };
    const capabilityDigest = await fixtureHash('capability-id', normalizedInput);
    const capabilityId = `cap_demo_${capabilityDigest.slice(2, 18)}`;
    const policyCommitment = await fixtureHash('policy-commitment', normalizedInput.policy);
    const spendStateCommitment = await fixtureHash('spend-state-commitment', {
      capabilityId,
      remainingBudget: normalizedInput.policy.totalBudget,
      usesRemaining: normalizedInput.policy.maxUses,
    });

    this.capability = {
      capabilityId,
      alias: normalizedInput.alias,
      policy: normalizedInput.policy,
      status: 'active',
      usesRemaining: normalizedInput.policy.maxUses,
      remainingBudget: normalizedInput.policy.totalBudget,
      policyCommitment,
      spendStateCommitment,
    };

    return {
      capabilityId,
      policyCommitment,
      spendStateCommitment,
      status: 'active',
      createdAtLabel: 'Demo session',
      tx: { kind: 'demo-fixture', networkId: 'demo' },
    };
  }

  async getCapability(capabilityId: string): Promise<CapabilityOwnerState> {
    if (!this.capability || this.capability.capabilityId !== capabilityId) {
      throw new Error('Capability not found.');
    }
    return cloneCapability(this.capability);
  }

  async revokeCapability(capabilityId: string): Promise<TxResult> {
    if (!this.capability || this.capability.capabilityId !== capabilityId) {
      throw new Error('Capability not found.');
    }
    this.capability = { ...this.capability, status: 'revoked' };
    return { kind: 'demo-fixture', networkId: 'demo' };
  }

  async authorizeSpend(_input: {
    capabilityId: string;
    request: SpendRequest;
  }): Promise<AuthorizationResult> {
    return { status: 'rejected', proofSteps: [], publicMessage: PUBLIC_REJECTION, privateReason: 'UNKNOWN' };
  }

  async verifyReceipt(_receiptCommitment: string): Promise<boolean> {
    return false;
  }

  async generateOneTimeDestination(
    merchant: MerchantMetaAddress,
    requestNonce: string,
  ): Promise<OneTimeDestination> {
    const input = { merchant, requestNonce };
    const [destination, ephemeralPublicKey, viewTag] = await Promise.all([
      fixtureHash('destination', input),
      fixtureHash('ephemeral-key', input),
      fixtureHash('view-tag', input),
    ]);
    return {
      destination: `demo_dest_${destination.slice(2, 22)}`,
      ephemeralPublicKey,
      viewTag: viewTag.slice(2, 10),
      fixture: true,
    };
  }
}

