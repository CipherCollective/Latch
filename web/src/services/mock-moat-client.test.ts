import { describe, expect, it } from 'vitest';
import { DEFAULT_CAPABILITY_INPUT } from '../demo/defaults';
import { MockMoatClient } from './mock-moat-client';

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
    const client = new MockMoatClient();
    const created = await client.createCapability(DEFAULT_CAPABILITY_INPUT);
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
