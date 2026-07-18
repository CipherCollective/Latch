import { describe, expect, it } from 'vitest';
import { DEFAULT_CAPABILITY_INPUT } from '../demo/defaults';
import { ALPHA_SIGNAL_REQUEST, CODE_SHIELD_REQUEST } from '../demo/requests';
import type { ProofStep, SpendRequest } from '../types/domain';
import { MockMoatClient } from './mock-moat-client';

const EXPECTED_STEP_LABELS = [
  'Preparing private witness',
  'Deriving one-time destination',
  'Opening policy commitment',
  'Evaluating hidden spending constraints',
  'Checking nullifier',
  'Modeling proof submission (demo fixture)',
  'Receipt committed',
];

async function createDefaultClient(options?: { stepDelayMs?: number }) {
  const client = new MockMoatClient(options);
  const created = await client.createCapability(DEFAULT_CAPABILITY_INPUT);
  return { client, created };
}

describe('MockMoatClient capability lifecycle', () => {
  it('creates a stable owner capability using demo fixtures only', async () => {
    const firstClient = new MockMoatClient();
    const secondClient = new MockMoatClient();

    const first = await firstClient.createCapability(DEFAULT_CAPABILITY_INPUT);
    const second = await secondClient.createCapability(DEFAULT_CAPABILITY_INPUT);
    const owner = await firstClient.getCapability(first.capabilityId);

    expect(first).toEqual(second);
    expect(first.capabilityId).toMatch(/^cap_demo_[0-9a-f]{16}$/);
    expect(first.policyCommitment).toMatch(/^0x[0-9a-f]{64}$/);
    expect(first.spendStateCommitment).toMatch(/^0x[0-9a-f]{64}$/);
    expect(first.tx).toEqual({ kind: 'demo-fixture', networkId: 'demo' });
    expect(first.tx).not.toHaveProperty('txHash');
    expect(first.tx).not.toHaveProperty('explorerUrl');
    expect(owner).toMatchObject({
      alias: 'Research procurement',
      status: 'active',
      usesRemaining: 3,
      remainingBudget: '50',
    });
  });

  it('returns copies and applies a terminal demo revocation', async () => {
    const { client, created } = await createDefaultClient();
    const firstRead = await client.getCapability(created.capabilityId);
    if (!('policy' in firstRead)) throw new Error('Expected owner state.');
    firstRead.policy.agentName = 'mutated outside client';

    const secondRead = await client.getCapability(created.capabilityId);
    expect('policy' in secondRead && secondRead.policy.agentName).toBe('Research Agent A');

    await expect(client.revokeCapability(created.capabilityId)).resolves.toEqual({
      kind: 'demo-fixture',
      networkId: 'demo',
    });
    await expect(client.getCapability(created.capabilityId)).resolves.toMatchObject({ status: 'revoked' });

    const before = await client.getCapability(created.capabilityId);
    const result = await client.authorizeSpend({
      capabilityId: created.capabilityId,
      request: CODE_SHIELD_REQUEST,
    });
    expect(result).toMatchObject({ status: 'rejected', privateReason: 'REVOKED' });
    await expect(client.getCapability(created.capabilityId)).resolves.toEqual(before);
  });

  it('does not invent wallet connectivity in demo mode', async () => {
    const client = new MockMoatClient();
    await expect(client.connectWallet()).resolves.toEqual({
      mode: 'demo',
      connectionState: 'disconnected',
      networkId: 'demo',
    });
  });
});

describe('MockMoatClient deterministic authorization', () => {
  it('approves CodeShield, consumes one use, and subtracts the exact amount', async () => {
    const { client, created } = await createDefaultClient();
    const result = await client.authorizeSpend({
      capabilityId: created.capabilityId,
      request: CODE_SHIELD_REQUEST,
    });

    expect(result.status).toBe('approved');
    if (result.status !== 'approved') throw new Error('Expected approval.');
    expect(result.proofSteps.map((step) => step.label)).toEqual(EXPECTED_STEP_LABELS);
    expect(result.proofSteps.every((step) => step.status === 'passed')).toBe(true);
    expect(result.receipt.requestCommitment).toMatch(/^0x[0-9a-f]{64}$/);
    expect(result.receipt.nullifier).toMatch(/^0x[0-9a-f]{64}$/);
    expect(result.receipt.receiptCommitment).toMatch(/^0x[0-9a-f]{64}$/);
    expect(result.receipt.oneTimeDestination).toMatchObject({ fixture: true });
    expect(result.receipt.oneTimeDestination.destination).toMatch(/^demo_dest_[0-9a-f]{20}$/);
    expect(result.receipt.oneTimeDestination.destination).not.toMatch(/^(mn_|addr|midnight)/i);
    expect(result.receipt.tx).toEqual({ kind: 'demo-fixture', networkId: 'demo' });
    expect(result.receipt.tx).not.toHaveProperty('txHash');
    expect(result.receipt.tx).not.toHaveProperty('explorerUrl');

    await expect(client.getCapability(created.capabilityId)).resolves.toMatchObject({
      usesRemaining: 2,
      remainingBudget: '38',
    });
  });

  it('rejects AlphaSignal without changing any capability state', async () => {
    const { client, created } = await createDefaultClient();
    const before = await client.getCapability(created.capabilityId);
    const result = await client.authorizeSpend({
      capabilityId: created.capabilityId,
      request: ALPHA_SIGNAL_REQUEST,
    });

    expect(result).toMatchObject({
      status: 'rejected',
      privateReason: 'PER_TX_LIMIT',
      publicMessage: 'Authorization rejected. No private policy values were disclosed.',
    });
    expect(result.proofSteps).toHaveLength(7);
    expect(result.proofSteps.find((step) => step.id === 'evaluate-constraints')?.status).toBe('failed');
    expect(result.proofSteps.find((step) => step.id === 'check-nullifier')?.status).toBe('waiting');
    await expect(client.getCapability(created.capabilityId)).resolves.toEqual(before);
  });

  it('rejects a consumed nullifier as replay without changing post-approval state', async () => {
    const { client, created } = await createDefaultClient();
    const approved = await client.authorizeSpend({
      capabilityId: created.capabilityId,
      request: CODE_SHIELD_REQUEST,
    });
    if (approved.status !== 'approved') throw new Error('Expected first request to approve.');
    const afterApproval = await client.getCapability(created.capabilityId);

    const replay = await client.authorizeSpend({
      capabilityId: created.capabilityId,
      request: CODE_SHIELD_REQUEST,
    });

    expect(replay).toMatchObject({ status: 'rejected', privateReason: 'REPLAY' });
    expect(replay.proofSteps.find((step) => step.id === 'check-nullifier')?.status).toBe('failed');
    expect(replay.proofSteps.find((step) => step.id === 'derive-destination')?.status).toBe('waiting');
    expect(replay.proofSteps.find((step) => step.id === 'evaluate-constraints')?.status).toBe('waiting');
    await expect(client.getCapability(created.capabilityId)).resolves.toEqual(afterApproval);
  });

  it('verifies only stored approved receipts and clears them for a new session', async () => {
    const { client, created } = await createDefaultClient();
    const rejected = await client.authorizeSpend({
      capabilityId: created.capabilityId,
      request: ALPHA_SIGNAL_REQUEST,
    });
    expect(rejected.status).toBe('rejected');
    await expect(client.verifyReceipt('0xnot-a-receipt')).resolves.toBe(false);

    const approved = await client.authorizeSpend({
      capabilityId: created.capabilityId,
      request: CODE_SHIELD_REQUEST,
    });
    if (approved.status !== 'approved') throw new Error('Expected approval.');
    await expect(client.verifyReceipt(approved.receipt.receiptCommitment)).resolves.toBe(true);
    await expect(client.verifyReceipt(approved.receipt.requestCommitment)).resolves.toBe(false);

    await client.createCapability(DEFAULT_CAPABILITY_INPUT);
    await expect(client.verifyReceipt(approved.receipt.receiptCommitment)).resolves.toBe(false);
  });

  it('emits monotonic proof callbacks with the seven required labels', async () => {
    const { client, created } = await createDefaultClient({ stepDelayMs: 1 });
    const updates: ProofStep[] = [];
    await expect(client.authorizeSpend({
      capabilityId: created.capabilityId,
      request: CODE_SHIELD_REQUEST,
      onProofStep: (step) => updates.push(step),
    })).resolves.toMatchObject({ status: 'approved' });

    const firstUpdateForEachStep = updates.filter(
      (step, index) => updates.findIndex((candidate) => candidate.id === step.id) === index,
    );
    expect(firstUpdateForEachStep.map((step) => step.label)).toEqual(EXPECTED_STEP_LABELS);
    for (const label of EXPECTED_STEP_LABELS) {
      const statuses = updates.filter((step) => step.label === label).map((step) => step.status);
      expect(statuses).toEqual(['waiting', 'running', 'passed']);
    }
  });

  it('rejects invalid capability invariants at the client boundary', async () => {
    const client = new MockMoatClient();
    await expect(client.createCapability({
      ...DEFAULT_CAPABILITY_INPUT,
      policy: { ...DEFAULT_CAPABILITY_INPUT.policy, perTransactionLimit: '51' },
    })).rejects.toThrow(/invalid normalized demo policy/i);
    await expect(client.createCapability({
      ...DEFAULT_CAPABILITY_INPUT,
      policy: { ...DEFAULT_CAPABILITY_INPUT.policy, maxUses: 0 },
    })).rejects.toThrow(/invalid normalized demo policy/i);
  });

  it('serializes concurrent uses of the same nonce so only one can commit', async () => {
    const { client, created } = await createDefaultClient();
    const [first, second] = await Promise.all([
      client.authorizeSpend({ capabilityId: created.capabilityId, request: CODE_SHIELD_REQUEST }),
      client.authorizeSpend({ capabilityId: created.capabilityId, request: CODE_SHIELD_REQUEST }),
    ]);

    expect([first.status, second.status]).toEqual(['approved', 'rejected']);
    expect(second).toMatchObject({ privateReason: 'REPLAY' });
    await expect(client.getCapability(created.capabilityId)).resolves.toMatchObject({
      usesRemaining: 2,
      remainingBudget: '38',
    });
  });

  it('does not consume a nullifier when the first attempt is rejected', async () => {
    const { client, created } = await createDefaultClient();
    const rejectedRequest: SpendRequest = {
      ...CODE_SHIELD_REQUEST,
      category: 'trading-data',
    };
    const rejected = await client.authorizeSpend({
      capabilityId: created.capabilityId,
      request: rejectedRequest,
    });
    expect(rejected).toMatchObject({ status: 'rejected', privateReason: 'CATEGORY' });

    const approved = await client.authorizeSpend({
      capabilityId: created.capabilityId,
      request: CODE_SHIELD_REQUEST,
    });
    expect(approved.status).toBe('approved');
  });
});
