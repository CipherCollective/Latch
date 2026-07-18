import { fixtureHash } from '../demo/fixture-hash';
import { compareDecimal, parseDecimal, subtractDecimal } from '../lib/decimal';
import type { MoatClient } from './moat-client';
import type {
  AuthorizationResult,
  CapabilityOwnerState,
  CreateCapabilityInput,
  CreateCapabilityResult,
  MerchantMetaAddress,
  OneTimeDestination,
  PrivateRejectionCode,
  ProofStep,
  ProofStepId,
  SpendRequest,
  TxResult,
  WalletSnapshot,
} from '../types/domain';

const PUBLIC_REJECTION = 'Authorization rejected. No private policy values were disclosed.' as const;

const PROOF_STEP_DEFINITIONS: ReadonlyArray<Pick<ProofStep, 'id' | 'label'>> = [
  { id: 'prepare-witness', label: 'Preparing private witness' },
  { id: 'derive-destination', label: 'Deriving one-time destination' },
  { id: 'open-policy', label: 'Opening policy commitment' },
  { id: 'evaluate-constraints', label: 'Evaluating hidden spending constraints' },
  { id: 'check-nullifier', label: 'Checking nullifier' },
  { id: 'submit-proof', label: 'Modeling proof submission (demo fixture)' },
  { id: 'commit-receipt', label: 'Receipt committed' },
];

const PASSED_DETAILS: Partial<Record<ProofStepId, string>> = {
  'prepare-witness': 'Private inputs prepared locally.',
  'derive-destination': 'Demo one-time destination fixture derived.',
  'open-policy': 'Policy commitment opened privately.',
  'evaluate-constraints': 'Hidden constraints satisfied.',
  'check-nullifier': 'Authorization has not been consumed.',
  'submit-proof': 'Demo proof fixture completed.',
  'commit-receipt': 'Authorization receipt stored.',
};

export interface MockMoatClientOptions {
  stepDelayMs?: number;
}

function cloneCapability(state: CapabilityOwnerState): CapabilityOwnerState {
  return { ...state, policy: { ...state.policy } };
}

export class MockMoatClient implements MoatClient {
  private capability: CapabilityOwnerState | null = null;
  private readonly consumedNullifiers = new Set<string>();
  private readonly approvedReceiptCommitments = new Set<string>();
  private readonly stepDelayMs: number;
  private authorizationTail: Promise<void> = Promise.resolve();

  constructor(options: MockMoatClientOptions = {}) {
    const requestedDelay = options.stepDelayMs ?? 0;
    this.stepDelayMs = Number.isFinite(requestedDelay) && requestedDelay > 0
      ? Math.floor(requestedDelay)
      : 0;
  }

  async connectWallet(): Promise<WalletSnapshot> {
    return { mode: 'demo', connectionState: 'disconnected', networkId: 'demo' };
  }

  async createCapability(input: CreateCapabilityInput): Promise<CreateCapabilityResult> {
    const perTransaction = parseDecimal(input.policy.perTransactionLimit);
    const totalBudget = parseDecimal(input.policy.totalBudget);
    if (
      !input.alias.trim()
      || !input.policy.agentName.trim()
      || !input.policy.allowedCategory.trim()
      || !perTransaction
      || perTransaction.coefficient <= 0n
      || !totalBudget
      || totalBudget.coefficient <= 0n
      || compareDecimal(perTransaction.canonical, totalBudget.canonical) === 1
      || !Number.isInteger(input.policy.maxUses)
      || input.policy.maxUses < 1
      || input.policy.maxUses > 99
    ) {
      throw new Error('Invalid normalized demo policy.');
    }

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
    this.consumedNullifiers.clear();
    this.approvedReceiptCommitments.clear();

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

  async authorizeSpend(input: {
    capabilityId: string;
    request: SpendRequest;
    onProofStep?: (step: ProofStep) => void;
  }): Promise<AuthorizationResult> {
    const previousAuthorization = this.authorizationTail;
    let releaseAuthorization: (() => void) | undefined;
    this.authorizationTail = new Promise<void>((resolve) => {
      releaseAuthorization = resolve;
    });

    await previousAuthorization;
    try {
      return await this.authorizeSpendSerial(input);
    } finally {
      releaseAuthorization?.();
    }
  }

  async verifyReceipt(receiptCommitment: string): Promise<boolean> {
    return this.approvedReceiptCommitments.has(receiptCommitment);
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

  private async authorizeSpendSerial(input: {
    capabilityId: string;
    request: SpendRequest;
    onProofStep?: (step: ProofStep) => void;
  }): Promise<AuthorizationResult> {
    const proofSteps: ProofStep[] = PROOF_STEP_DEFINITIONS.map((step) => ({
      ...step,
      status: 'waiting',
    }));

    for (const step of proofSteps) {
      try {
        input.onProofStep?.({ ...step });
      } catch {
        // Presentation callbacks cannot change authorization semantics.
      }
    }

    const transition = async (
      id: ProofStepId,
      terminalStatus: 'passed' | 'failed',
      safeDetail?: string,
    ): Promise<void> => {
      const index = proofSteps.findIndex((step) => step.id === id);
      const currentStep = proofSteps[index];
      if (!currentStep) throw new Error(`Unknown proof step: ${id}`);

      const notify = (step: ProofStep) => {
        try {
          input.onProofStep?.({ ...step });
        } catch {
          // Presentation callbacks cannot change authorization semantics.
        }
      };

      const runningStep: ProofStep = {
        ...currentStep,
        status: 'running',
        safeDetail: undefined,
      };
      proofSteps[index] = runningStep;
      notify(runningStep);
      if (this.stepDelayMs > 0) {
        await new Promise<void>((resolve) => setTimeout(resolve, this.stepDelayMs));
      }
      const terminalStep: ProofStep = { ...runningStep, status: terminalStatus, safeDetail };
      proofSteps[index] = terminalStep;
      notify(terminalStep);
    };

    const reject = (privateReason: PrivateRejectionCode): AuthorizationResult => ({
      status: 'rejected',
      proofSteps: proofSteps.map((step) => ({ ...step })),
      publicMessage: PUBLIC_REJECTION,
      privateReason,
    });

    await transition('prepare-witness', 'passed', PASSED_DETAILS['prepare-witness']);

    if (!this.capability || this.capability.capabilityId !== input.capabilityId) {
      await transition('open-policy', 'failed', 'Authorization could not continue.');
      return reject('UNKNOWN');
    }

    const nullifier = await fixtureHash('nullifier', {
      capabilityId: input.capabilityId,
      requestNonce: input.request.requestNonce,
    });

    // Replay is checked before private policy constraints, even though its visual
    // row follows the constraints row in the canonical timeline.
    if (this.consumedNullifiers.has(nullifier)) {
      await transition('check-nullifier', 'failed', 'Authorization could not continue.');
      return reject('REPLAY');
    }

    const oneTimeDestination = await this.generateOneTimeDestination(
      input.request.merchant,
      input.request.requestNonce,
    );
    await transition('derive-destination', 'passed', PASSED_DETAILS['derive-destination']);
    await transition('open-policy', 'passed', PASSED_DETAILS['open-policy']);

    const rejection = this.evaluatePolicy(this.capability, input.request);
    if (rejection) {
      await transition('evaluate-constraints', 'failed', 'Authorization could not continue.');
      return reject(rejection);
    }

    await transition(
      'evaluate-constraints',
      'passed',
      PASSED_DETAILS['evaluate-constraints'],
    );
    await transition('check-nullifier', 'passed', PASSED_DETAILS['check-nullifier']);
    await transition('submit-proof', 'passed', PASSED_DETAILS['submit-proof']);

    const nextBudget = subtractDecimal(this.capability.remainingBudget, input.request.amount);
    if (nextBudget === null) {
      await transition('commit-receipt', 'failed', 'Authorization could not continue.');
      return reject('UNKNOWN');
    }

    const nextUses = this.capability.usesRemaining - 1;
    const requestCommitment = await fixtureHash('request-commitment', {
      capabilityId: input.capabilityId,
      request: input.request,
    });
    const spendStateCommitment = await fixtureHash('spend-state-commitment', {
      capabilityId: input.capabilityId,
      remainingBudget: nextBudget,
      usesRemaining: nextUses,
    });
    const receiptCommitment = await fixtureHash('receipt-commitment', {
      capabilityId: input.capabilityId,
      nullifier,
      requestCommitment,
      spendStateCommitment,
      oneTimeDestination,
    });

    // This synchronous block is the demo's atomic commit point. No nullifier,
    // receipt, budget, use, or state commitment is updated on a rejected path.
    this.capability = {
      ...this.capability,
      remainingBudget: nextBudget,
      usesRemaining: nextUses,
      spendStateCommitment,
    };
    this.consumedNullifiers.add(nullifier);
    this.approvedReceiptCommitments.add(receiptCommitment);

    await transition('commit-receipt', 'passed', PASSED_DETAILS['commit-receipt']);

    return {
      status: 'approved',
      proofSteps: proofSteps.map((step) => ({ ...step })),
      receipt: {
        capabilityId: input.capabilityId,
        requestCommitment,
        receiptCommitment,
        nullifier,
        oneTimeDestination,
        tx: { kind: 'demo-fixture', networkId: 'demo' },
      },
    };
  }

  private evaluatePolicy(
    capability: CapabilityOwnerState,
    request: SpendRequest,
  ): PrivateRejectionCode | null {
    if (capability.status !== 'active') return 'REVOKED';
    if (capability.usesRemaining <= 0) return 'MAX_USES';

    const amount = parseDecimal(request.amount);
    if (!amount || amount.coefficient <= 0n) return 'UNKNOWN';

    const perTransactionComparison = compareDecimal(
      amount.canonical,
      capability.policy.perTransactionLimit,
    );
    if (perTransactionComparison === null) return 'UNKNOWN';
    if (perTransactionComparison > 0) return 'PER_TX_LIMIT';

    const totalBudgetComparison = compareDecimal(amount.canonical, capability.remainingBudget);
    if (totalBudgetComparison === null) return 'UNKNOWN';
    if (totalBudgetComparison > 0) return 'TOTAL_BUDGET';

    if (request.category !== capability.policy.allowedCategory) return 'CATEGORY';
    return null;
  }
}
