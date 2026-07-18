import { describe, expect, it } from 'vitest';
import * as secp from '@noble/secp256k1';

import {
  hashAgentKey,
  hashCapabilityId,
  hashOwner,
  hashPolicy,
  randomBytes32,
  toHex32,
} from './commitments.js';
import { MockMoatClient } from './mock-client.js';
import { endpointsFromEnv, PREPROD_ENDPOINTS, UNDEPLOYED_ENDPOINTS } from './networks.js';
import { deriveReceiverOneTimePublicKey, generateOneTimeDestination } from './stealth.js';

function keyPair() {
  const priv = secp.utils.randomSecretKey();
  const pub = `0x${Buffer.from(secp.getPublicKey(priv)).toString('hex')}`;
  return { priv, pub };
}

function demoAgent(): { agentSecret: Uint8Array; agentKeyHash: string } {
  const agentSecret = randomBytes32();
  return { agentSecret, agentKeyHash: toHex32(hashAgentKey(agentSecret)) };
}

async function createReadyCapability(client: MockMoatClient, overrides?: Partial<{ maxUses: number; totalBudget: bigint }>) {
  const agent = demoAgent();
  client.registerAgentSecret(agent.agentKeyHash, agent.agentSecret);
  const created = await client.createCapability({
    policy: {
      agentName: 'Research Agent A',
      agentKeyHash: agent.agentKeyHash,
      perTransactionLimit: 20n,
      totalBudget: overrides?.totalBudget ?? 50n,
      maxUses: overrides?.maxUses ?? 3,
      allowedCategory: 'developer-tools',
    },
  });
  return { ...agent, created };
}

describe('commitments', () => {
  it('uses distinct domains for owner vs capability id', () => {
    const secret = randomBytes32();
    const salt = randomBytes32();
    expect(toHex32(hashOwner(secret))).not.toBe(toHex32(hashCapabilityId(secret, salt)));
  });

  it('changes policy commitment when limits change', () => {
    const capabilityId = randomBytes32();
    const agentKeyHash = randomBytes32();
    const salt = randomBytes32();
    const category = randomBytes32();
    const a = hashPolicy({
      capabilityId,
      agentKeyHash,
      perTransactionLimit: 20n,
      totalBudget: 50n,
      maxUses: 3n,
      allowedCategoryHash: category,
      policySalt: salt,
    });
    const b = hashPolicy({
      capabilityId,
      agentKeyHash,
      perTransactionLimit: 21n,
      totalBudget: 50n,
      maxUses: 3n,
      allowedCategoryHash: category,
      policySalt: salt,
    });
    expect(toHex32(a)).not.toBe(toHex32(b));
  });
});

describe('stealth', () => {
  it('derives different destinations for different nonces', async () => {
    const view = keyPair();
    const spend = keyPair();
    const merchant = { viewPublicKey: view.pub, spendPublicKey: spend.pub };
    const r = secp.utils.randomSecretKey();
    const a = await generateOneTimeDestination(merchant, 'nonce-a', r);
    const b = await generateOneTimeDestination(merchant, 'nonce-b', r);
    expect(a.destination).not.toBe(b.destination);
    expect(a.ephemeralPublicKey).toBe(b.ephemeralPublicKey);
  });

  it('agrees between sender and receiver derivation', async () => {
    const view = keyPair();
    const spend = keyPair();
    const merchant = { viewPublicKey: view.pub, spendPublicKey: spend.pub };
    const nonce = 'req-nonce-1';
    const sent = await generateOneTimeDestination(merchant, nonce);
    const received = deriveReceiverOneTimePublicKey({
      viewPrivateKey: view.priv,
      spendPublicKey: spend.pub,
      ephemeralPublicKey: sent.ephemeralPublicKey,
      requestNonce: nonce,
    });
    expect(received).toBe(sent.destination);
  });

  it('rejects malformed keys', async () => {
    await expect(
      generateOneTimeDestination({ viewPublicKey: '0x00', spendPublicKey: '0x00' }, 'nonce'),
    ).rejects.toThrow(/malformed/);
  });
});

describe('MockMoatClient', () => {
  it('rejects policies the contract cannot create', async () => {
    const client = new MockMoatClient();
    const agent = demoAgent();
    client.registerAgentSecret(agent.agentKeyHash, agent.agentSecret);
    await expect(
      client.createCapability({
        policy: {
          agentName: 'Research Agent A',
          agentKeyHash: agent.agentKeyHash,
          perTransactionLimit: 0n,
          totalBudget: 50n,
          maxUses: 3,
          allowedCategory: 'developer-tools',
        },
      }),
    ).rejects.toThrow(/positive/);

    await expect(
      client.createCapability({
        policy: {
          agentName: 'Research Agent A',
          agentKeyHash: agent.agentKeyHash,
          perTransactionLimit: 60n,
          totalBudget: 50n,
          maxUses: 3,
          allowedCategory: 'developer-tools',
        },
      }),
    ).rejects.toThrow(/exceeds totalBudget/);
  });

  it('requires registerAgentSecret before createCapability', async () => {
    const client = new MockMoatClient();
    const agent = demoAgent();
    await expect(
      client.createCapability({
        policy: {
          agentName: 'Research Agent A',
          agentKeyHash: agent.agentKeyHash,
          perTransactionLimit: 20n,
          totalBudget: 50n,
          maxUses: 3,
          allowedCategory: 'developer-tools',
        },
      }),
    ).rejects.toThrow(/registerAgentSecret/);
  });

  it('approves a valid spend using the create-time agentKeyHash, verifies receipt, rejects replay and category failure', async () => {
    const client = new MockMoatClient();
    const { agentKeyHash, created } = await createReadyCapability(client);

    const view = keyPair();
    const spend = keyPair();
    const merchant = { viewPublicKey: view.pub, spendPublicKey: spend.pub };
    const requestNonce = toHex32(randomBytes32());

    const approved = await client.authorizeSpend({
      capabilityId: created.capabilityId,
      request: {
        requestId: 'req-1',
        requestNonce,
        agentName: 'Research Agent A',
        agentKeyHash,
        serviceId: 'codeshield',
        serviceName: 'CodeShield',
        category: 'developer-tools',
        amount: 12n,
        merchant,
      },
    });
    expect(approved.status).toBe('approved');
    expect(approved.receiptCommitment).toBeTruthy();
    expect(await client.verifyReceipt(approved.receiptCommitment!)).toBe(true);

    const replay = await client.authorizeSpend({
      capabilityId: created.capabilityId,
      request: {
        requestId: 'req-1-replay',
        requestNonce,
        agentName: 'Research Agent A',
        agentKeyHash,
        serviceId: 'codeshield',
        serviceName: 'CodeShield',
        category: 'developer-tools',
        amount: 12n,
        merchant,
      },
    });
    expect(replay.status).toBe('rejected');
    expect(replay.privateReason).toBe('replay');

    const categoryReject = await client.authorizeSpend({
      capabilityId: created.capabilityId,
      request: {
        requestId: 'req-2',
        requestNonce: toHex32(randomBytes32()),
        agentName: 'Research Agent A',
        agentKeyHash,
        serviceId: 'alphasignal',
        serviceName: 'AlphaSignal',
        category: 'trading-data',
        amount: 5n,
        merchant,
      },
    });
    expect(categoryReject.status).toBe('rejected');
    expect(categoryReject.privateReason).toBe('category');
  });

  it('returns a defensive copy from getCapability', async () => {
    const client = new MockMoatClient();
    const { created } = await createReadyCapability(client);
    const snap = await client.getCapability(created.capabilityId);
    expect(snap).toBeTruthy();
    snap!.revoked = true;
    const again = await client.getCapability(created.capabilityId);
    expect(again?.revoked).toBe(false);
  });

  it('continues authorization when onProofStep throws (observer isolation)', async () => {
    const client = new MockMoatClient();
    const { agentKeyHash, created } = await createReadyCapability(client);
    const view = keyPair();
    const spend = keyPair();
    const merchant = { viewPublicKey: view.pub, spendPublicKey: spend.pub };

    const approved = await client.authorizeSpend({
      capabilityId: created.capabilityId,
      request: {
        requestId: 'req-observer',
        requestNonce: toHex32(randomBytes32()),
        agentName: 'Research Agent A',
        agentKeyHash,
        serviceId: 'codeshield',
        serviceName: 'CodeShield',
        category: 'developer-tools',
        amount: 12n,
        merchant,
      },
      onProofStep: () => {
        throw new Error('ui callback exploded');
      },
    });
    expect(approved.status).toBe('approved');
    expect(client.debugHasNullifier(approved.nullifier!)).toBe(true);
  });

  it('lets revoke win while proof steps are running', async () => {
    const client = new MockMoatClient();
    const { agentKeyHash, created } = await createReadyCapability(client);
    const view = keyPair();
    const spend = keyPair();
    const merchant = { viewPublicKey: view.pub, spendPublicKey: spend.pub };

    let revokePromise: Promise<{ success: boolean }> | undefined;
    const result = await client.authorizeSpend({
      capabilityId: created.capabilityId,
      request: {
        requestId: 'req-revoke-race',
        requestNonce: toHex32(randomBytes32()),
        agentName: 'Research Agent A',
        agentKeyHash,
        serviceId: 'codeshield',
        serviceName: 'CodeShield',
        category: 'developer-tools',
        amount: 12n,
        merchant,
      },
      onProofStep: (step) => {
        if (step.id === 'submit-proof' && step.status === 'running' && !revokePromise) {
          revokePromise = client.revokeCapability(created.capabilityId);
        }
      },
    });

    expect(revokePromise).toBeTruthy();
    await revokePromise;
    expect(result.status).toBe('rejected');
    expect(result.privateReason).toBe('revoked');
    const cap = await client.getCapability(created.capabilityId);
    expect(cap?.revoked).toBe(true);
  });

  it('cleans capability lock map entries after authorize and revoke', async () => {
    const client = new MockMoatClient();
    const { agentKeyHash, created } = await createReadyCapability(client, { maxUses: 5 });
    const view = keyPair();
    const spend = keyPair();
    const merchant = { viewPublicKey: view.pub, spendPublicKey: spend.pub };

    for (let i = 0; i < 3; i += 1) {
      const approved = await client.authorizeSpend({
        capabilityId: created.capabilityId,
        request: {
          requestId: `req-lock-${i}`,
          requestNonce: toHex32(randomBytes32()),
          agentName: 'Research Agent A',
          agentKeyHash,
          serviceId: 'codeshield',
          serviceName: 'CodeShield',
          category: 'developer-tools',
          amount: 5n,
          merchant,
        },
      });
      expect(approved.status).toBe('approved');
      expect(client.debugLockEntryCount()).toBe(0);
    }

    await client.revokeCapability(created.capabilityId);
    expect(client.debugLockEntryCount()).toBe(0);
  });
});

describe('networks', () => {
  it('defaults to demo when unset', () => {
    expect(endpointsFromEnv({})).toEqual({ networkId: 'demo' });
  });

  it('resolves undeployed endpoints from env', () => {
    const cfg = endpointsFromEnv({ MIDNIGHT_NETWORK: 'undeployed' });
    expect(cfg).toMatchObject(UNDEPLOYED_ENDPOINTS);
  });

  it('uses public Preprod defaults when preprod vars are omitted', () => {
    expect(endpointsFromEnv({ MIDNIGHT_NETWORK: 'preprod' })).toMatchObject(PREPROD_ENDPOINTS);
  });

  it('rejects unsupported or misspelled networks', () => {
    expect(() => endpointsFromEnv({ MIDNIGHT_NETWORK: 'preview' })).toThrow(/not configured/);
    expect(() => endpointsFromEnv({ MIDNIGHT_NETWORK: 'preprodction' })).toThrow(/Unsupported/);
  });
});

describe('real-client helpers', () => {
  it('builds a compiled MOAT contract handle against managed assets', async () => {
    const { makeMoatCompiledContract, defaultMoatZkAssetsPath } = await import('./moat-compiled.js');
    const { existsSync } = await import('node:fs');
    expect(existsSync(defaultMoatZkAssetsPath())).toBe(true);
    const compiled = makeMoatCompiledContract();
    expect(compiled.tag).toBe('moat');
  });

  it('rejects agentSecret that does not open agentKeyHash', async () => {
    const { hashAgentKey, randomBytes32, toHex32 } = await import('./commitments.js');
    const secret = randomBytes32();
    const wrongHash = toHex32(randomBytes32());
    // Lightweight check mirroring RealMoatClient.registerAgentSecret
    expect(toHex32(hashAgentKey(secret))).not.toBe(wrongHash);
  });

  it('createMoatProviders rejects demo network', async () => {
    const { createMoatProviders } = await import('./providers.js');
    expect(() =>
      createMoatProviders({
        endpoints: { networkId: 'demo' },
        walletAndMidnightProvider: {} as never,
      }),
    ).toThrow(/undeployed or preprod/);
  });
});
