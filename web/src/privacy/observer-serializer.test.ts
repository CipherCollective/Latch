import { describe, expect, it } from 'vitest';
import type {
  AuthorizationReceipt,
  AuthorizationResult,
  CapabilityOwnerState,
  PrivateRejectionCode,
  ProofStep,
} from '../types/domain';
import {
  buildObserverWorkspaceModel,
  PUBLIC_REJECTION_MESSAGE,
  serializeObserverReceipt,
  toObserverCapability,
} from './observer-serializer';

const CAPABILITY_ID = 'cap_public_001';
const POLICY_COMMITMENT = `0x${'1'.repeat(64)}`;
const SPEND_STATE_COMMITMENT = `0x${'2'.repeat(64)}`;
const REQUEST_COMMITMENT = `0x${'3'.repeat(64)}`;
const RECEIPT_COMMITMENT = `0x${'4'.repeat(64)}`;
const NULLIFIER = `0x${'5'.repeat(64)}`;

const PRIVATE_VALUES = [
  'SECRET_CAPABILITY_ALIAS',
  'SECRET_AGENT_ASH',
  '19.750001',
  '999.000001',
  'SECRET_CATEGORY_TRADING',
  'SECRET_MERCHANT_ID',
  'SECRET_MERCHANT_NAME',
  'SECRET_SERVICE_ID',
  'SECRET_SERVICE_NAME',
  'SECRET_PRIVATE_REASON',
  'SECRET_REMAINING_BUDGET',
  'SECRET_USES_REMAINING',
  'SECRET_WALLET_NAME',
  'SECRET_WALLET_ADDRESS',
  'SECRET_DESTINATION',
  'SECRET_EPHEMERAL_KEY',
  'SECRET_VIEW_TAG',
  'SECRET_TX_HASH',
  'https://secret-explorer.example/SECRET_TX_HASH',
  'SECRET_SAFE_DETAIL',
  'SECRET_OWNER_EVENT_TEXT',
  'Research procurement',
  'Research Agent A',
  'developer-tools',
  'trading-data',
  'CodeShield security report',
  'merchant-codeshield',
  'demo-meta:codeshield',
  'req-codeshield-001',
  'AlphaSignal trading dataset',
  'merchant-alphasignal',
  'demo-meta:alphasignal',
  'req-alphasignal-001',
] as const;

const BANNED_KEYS = [
  'alias',
  'policy',
  'agent',
  'agentName',
  'amount',
  'category',
  'allowedCategory',
  'merchant',
  'merchantId',
  'service',
  'serviceId',
  'serviceName',
  'privateReason',
  'remainingBudget',
  'totalBudget',
  'perTransactionLimit',
  'maxUses',
  'usesRemaining',
  'wallet',
  'walletName',
  'address',
  'unshieldedAddress',
  'oneTimeDestination',
  'destination',
  'ephemeralPublicKey',
  'viewTag',
  'tx',
  'txHash',
  'explorerUrl',
  'safeDetail',
  'requestNonce',
  'displayName',
  'metaAddress',
  'ownerAddress',
  'walletAddress',
  'shieldedAddress',
  'networkId',
  'kind',
  'fixture',
  'witness',
  'witnesses',
  'seed',
  'secret',
  'key',
] as const;

const hostileCapability = {
  capabilityId: CAPABILITY_ID,
  status: 'active',
  policyCommitment: POLICY_COMMITMENT,
  spendStateCommitment: SPEND_STATE_COMMITMENT,
  alias: 'SECRET_CAPABILITY_ALIAS',
  policy: {
    agentName: 'SECRET_AGENT_ASH',
    perTransactionLimit: '19.750001',
    totalBudget: '999.000001',
    maxUses: 73,
    allowedCategory: 'SECRET_CATEGORY_TRADING',
    merchant: {
      merchantId: 'SECRET_MERCHANT_ID',
      displayName: 'SECRET_MERCHANT_NAME',
    },
  },
  usesRemaining: 'SECRET_USES_REMAINING',
  remainingBudget: 'SECRET_REMAINING_BUDGET',
  agent: { name: 'SECRET_AGENT_ASH' },
  amount: '19.750001',
  category: 'SECRET_CATEGORY_TRADING',
  service: { serviceId: 'SECRET_SERVICE_ID', serviceName: 'SECRET_SERVICE_NAME' },
  privateReason: 'SECRET_PRIVATE_REASON',
  wallet: { walletName: 'SECRET_WALLET_NAME', address: 'SECRET_WALLET_ADDRESS' },
  unshieldedAddress: 'SECRET_WALLET_ADDRESS',
  destination: {
    destination: 'SECRET_DESTINATION',
    ephemeralPublicKey: 'SECRET_EPHEMERAL_KEY',
    viewTag: 'SECRET_VIEW_TAG',
  },
  tx: {
    txHash: 'SECRET_TX_HASH',
    explorerUrl: 'https://secret-explorer.example/SECRET_TX_HASH',
  },
} as unknown as CapabilityOwnerState;

const hostileReceipt = {
  capabilityId: CAPABILITY_ID,
  requestCommitment: REQUEST_COMMITMENT,
  receiptCommitment: RECEIPT_COMMITMENT,
  nullifier: NULLIFIER,
  oneTimeDestination: {
    destination: 'SECRET_DESTINATION',
    ephemeralPublicKey: 'SECRET_EPHEMERAL_KEY',
    viewTag: 'SECRET_VIEW_TAG',
    fixture: true,
    merchant: { merchantId: 'SECRET_MERCHANT_ID' },
    policy: { amount: '19.750001', category: 'SECRET_CATEGORY_TRADING' },
  },
  tx: {
    kind: 'midnight-transaction',
    networkId: 'preprod',
    txHash: 'SECRET_TX_HASH',
    explorerUrl: 'https://secret-explorer.example/SECRET_TX_HASH',
    wallet: { name: 'SECRET_WALLET_NAME', address: 'SECRET_WALLET_ADDRESS' },
  },
  policy: hostileCapability.policy,
  agent: { agentName: 'SECRET_AGENT_ASH' },
  amount: '19.750001',
  category: 'SECRET_CATEGORY_TRADING',
  merchant: { merchantId: 'SECRET_MERCHANT_ID', displayName: 'SECRET_MERCHANT_NAME' },
  service: { serviceId: 'SECRET_SERVICE_ID', serviceName: 'SECRET_SERVICE_NAME' },
  privateReason: 'SECRET_PRIVATE_REASON',
  remainingBudget: 'SECRET_REMAINING_BUDGET',
  usesRemaining: 'SECRET_USES_REMAINING',
} as unknown as AuthorizationReceipt;

const hostileProofSteps = [
  {
    id: 'prepare-witness',
    label: 'Prepare private witness',
    status: 'passed',
    safeDetail: 'SECRET_SAFE_DETAIL',
    ownerEventText: 'SECRET_OWNER_EVENT_TEXT',
    policy: hostileCapability.policy,
  },
  {
    id: 'submit-proof',
    label: 'Submit proof',
    status: 'passed',
    safeDetail: 'SECRET_MERCHANT_NAME',
    privateReason: 'SECRET_PRIVATE_REASON',
  },
] as unknown as ProofStep[];

function collectKeysAndStringValues(value: unknown): { keys: string[]; values: string[] } {
  const keys: string[] = [];
  const values: string[] = [];

  const visit = (candidate: unknown) => {
    if (typeof candidate === 'string') {
      values.push(candidate);
      return;
    }

    if (Array.isArray(candidate)) {
      candidate.forEach(visit);
      return;
    }

    if (candidate !== null && typeof candidate === 'object') {
      for (const [key, nested] of Object.entries(candidate)) {
        keys.push(key);
        visit(nested);
      }
    }
  };

  visit(value);
  return { keys, values };
}

function expectNoPrivateMaterial(value: unknown) {
  const observed = collectKeysAndStringValues(value);
  const serialized = JSON.stringify(value);
  for (const bannedKey of BANNED_KEYS) expect(observed.keys).not.toContain(bannedKey);
  for (const privateValue of PRIVATE_VALUES) {
    expect(observed.values).not.toContain(privateValue);
    expect(serialized).not.toContain(privateValue);
  }
}

function rejectionFor(code: PrivateRejectionCode): Extract<AuthorizationResult, { status: 'rejected' }> {
  return {
    status: 'rejected',
    proofSteps: hostileProofSteps,
    publicMessage: PUBLIC_REJECTION_MESSAGE,
    privateReason: code,
  };
}

describe('observer serializer privacy boundary', () => {
  it('projects a hostile owner capability through an exact four-field allowlist', () => {
    const projection = toObserverCapability(hostileCapability);

    expect(projection).toEqual({
      capabilityId: CAPABILITY_ID,
      status: 'active',
      policyCommitment: POLICY_COMMITMENT,
      spendStateCommitment: SPEND_STATE_COMMITMENT,
    });
    expect(Object.keys(projection)).toEqual([
      'capabilityId',
      'status',
      'policyCommitment',
      'spendStateCommitment',
    ]);
    expect(Object.getPrototypeOf(projection)).toBe(Object.prototype);
    expectNoPrivateMaterial(projection);
  });

  it('builds an approved workspace from fresh public projections only', () => {
    const model = buildObserverWorkspaceModel({
      capability: hostileCapability,
      proofSteps: hostileProofSteps,
      receipt: hostileReceipt,
      rejection: null,
      verification: 'verified',
      authorizationBusy: false,
    });

    expect(model.proof).toEqual({
      overall: 'approved',
      steps: [],
    });
    expect(model.receipt).toEqual({
      capabilityId: CAPABILITY_ID,
      requestCommitment: REQUEST_COMMITMENT,
      receiptCommitment: RECEIPT_COMMITMENT,
      nullifier: NULLIFIER,
      capabilityStatus: 'active',
      proofStatus: 'approved',
      verificationStatus: 'verified',
    });
    expect(model.rejection).toBeNull();
    expect(model.transcript).toEqual([
      'Private purchase request submitted',
      'Private authorization approved',
      'Public receipt commitment available',
    ]);
    expectNoPrivateMaterial(model);
  });

  it('serializes only the seven approved observer receipt fields', () => {
    const model = buildObserverWorkspaceModel({
      capability: hostileCapability,
      proofSteps: hostileProofSteps,
      receipt: hostileReceipt,
      rejection: null,
      verification: 'verified',
      authorizationBusy: false,
    });
    if (!model.receipt) throw new Error('Expected an approved observer receipt.');

    const poisonedProjection = Object.assign(model.receipt, {
      policy: hostileCapability.policy,
      agentName: 'SECRET_AGENT_ASH',
      merchant: { merchantId: 'SECRET_MERCHANT_ID' },
      wallet: { address: 'SECRET_WALLET_ADDRESS' },
      oneTimeDestination: hostileReceipt.oneTimeDestination,
      tx: hostileReceipt.tx,
      privateReason: 'SECRET_PRIVATE_REASON',
    });
    const serialized = serializeObserverReceipt(poisonedProjection);
    const parsed = JSON.parse(serialized) as Record<string, unknown>;

    expect(parsed).toEqual({
      capabilityId: CAPABILITY_ID,
      requestCommitment: REQUEST_COMMITMENT,
      receiptCommitment: RECEIPT_COMMITMENT,
      nullifier: NULLIFIER,
      capabilityStatus: 'active',
      proofStatus: 'approved',
      verificationStatus: 'verified',
    });
    expect(Object.keys(parsed)).toEqual([
      'capabilityId',
      'requestCommitment',
      'receiptCommitment',
      'nullifier',
      'capabilityStatus',
      'proofStatus',
      'verificationStatus',
    ]);
    expectNoPrivateMaterial(parsed);
    for (const privateValue of PRIVATE_VALUES) expect(serialized).not.toContain(privateValue);
  });

  it('removes every proof step and stale receipt whenever any failure is observable', () => {
    const failedSteps = [
      hostileProofSteps[0],
      {
        id: 'evaluate-constraints',
        label: 'SECRET_OWNER_EVENT_TEXT',
        status: 'failed',
        safeDetail: 'SECRET_PRIVATE_REASON',
      },
    ] as unknown as ProofStep[];
    const model = buildObserverWorkspaceModel({
      capability: hostileCapability,
      proofSteps: failedSteps,
      receipt: hostileReceipt,
      rejection: null,
      verification: 'verified',
      authorizationBusy: false,
    });

    expect(model.proof).toEqual({ overall: 'rejected', steps: [] });
    expect(model.receipt).toBeNull();
    expect(model.rejection).toBe(PUBLIC_REJECTION_MESSAGE);
    expect(model.transcript).toEqual([
      'Private purchase request submitted',
      PUBLIC_REJECTION_MESSAGE,
    ]);
    expectNoPrivateMaterial(model);
  });

  it('emits a byte-identical generic rejection for every private reason code', () => {
    const codes: PrivateRejectionCode[] = [
      'PER_TX_LIMIT',
      'TOTAL_BUDGET',
      'MAX_USES',
      'CATEGORY',
      'REPLAY',
      'REVOKED',
      'UNKNOWN',
    ];
    const outputs = codes.map((code) =>
      buildObserverWorkspaceModel({
        capability: hostileCapability,
        proofSteps: hostileProofSteps,
        receipt: null,
        rejection: rejectionFor(code),
        verification: 'idle',
        authorizationBusy: false,
      }),
    );
    const expectedBytes = Array.from(PUBLIC_REJECTION_MESSAGE, (character) => character.charCodeAt(0));

    for (const model of outputs) {
      expect(model.proof).toEqual({ overall: 'rejected', steps: [] });
      expect(model.rejection).toBe(PUBLIC_REJECTION_MESSAGE);
      expect(Array.from(model.rejection ?? '', (character) => character.charCodeAt(0))).toEqual(expectedBytes);
      expectNoPrivateMaterial(model);
    }
    expect(new Set(outputs.map((model) => model.rejection)).size).toBe(1);
    expect(new Set(outputs.map((model) => JSON.stringify(model))).size).toBe(1);
  });

  it('uses only fixed generic transcript text and never owner event text', () => {
    const running = buildObserverWorkspaceModel({
      capability: hostileCapability,
      proofSteps: [
        {
          id: 'submit-proof',
          label: 'Submit proof',
          status: 'running',
          safeDetail: 'SECRET_OWNER_EVENT_TEXT',
        },
      ],
      receipt: hostileReceipt,
      rejection: null,
      verification: 'idle',
      authorizationBusy: true,
    });

    expect(running.proof.overall).toBe('running');
    expect(running.proof.steps).toEqual([]);
    expect(running.receipt).toBeNull();
    expect(running.transcript).toEqual([
      'Private purchase request submitted',
      'Private authorization proof in progress',
    ]);
    expect(JSON.stringify(running)).not.toContain('SECRET_OWNER_EVENT_TEXT');
  });

  it('rejects poisoned public leaves instead of serializing nested injected objects', () => {
    const poisoned = Object.assign({}, toObserverCapability(hostileCapability), {
      capabilityId: { policy: 'SECRET_PRIVATE_REASON' },
    }) as unknown as CapabilityOwnerState;

    expect(() => toObserverCapability(poisoned)).toThrow(/capabilityId must be a string/i);

    expect(() => toObserverCapability({
      ...hostileCapability,
      capabilityId: 'SECRET_AGENT_ASH',
    })).toThrow(/opaque capability identifier/i);
    expect(() => toObserverCapability({
      ...hostileCapability,
      policyCommitment: 'Research Agent A',
    })).toThrow(/32-byte hexadecimal commitment/i);

    const model = buildObserverWorkspaceModel({
      capability: hostileCapability,
      proofSteps: hostileProofSteps,
      receipt: hostileReceipt,
      rejection: null,
      verification: 'verified',
      authorizationBusy: false,
    });
    if (!model.receipt) throw new Error('Expected an approved observer receipt.');
    const receiptProjection = model.receipt;
    expect(() => serializeObserverReceipt({
      ...receiptProjection,
      nullifier: 'SECRET_PRIVATE_REASON',
    })).toThrow(/32-byte hexadecimal commitment/i);
  });
});
