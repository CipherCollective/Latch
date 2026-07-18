import { describe, expect, it } from 'vitest';
import * as secp from '@noble/secp256k1';

import { hashCapabilityId, hashOwner, hashPolicy, randomBytes32, toHex32 } from './commitments.js';
import { MockMoatClient } from './mock-client.js';
import { deriveReceiverOneTimePublicKey, generateOneTimeDestination } from './stealth.js';

function keyPair() {
  const priv = secp.utils.randomSecretKey();
  const pub = `0x${Buffer.from(secp.getPublicKey(priv)).toString('hex')}`;
  return { priv, pub };
}

function demoAgentKeyHash(): string {
  return toHex32(randomBytes32());
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
    const agentKeyHash = demoAgentKeyHash();
    await expect(
      client.createCapability({
        policy: {
          agentName: 'Research Agent A',
          agentKeyHash,
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
          agentKeyHash,
          perTransactionLimit: 60n,
          totalBudget: 50n,
          maxUses: 3,
          allowedCategory: 'developer-tools',
        },
      }),
    ).rejects.toThrow(/exceeds totalBudget/);
  });

  it('approves a valid spend using the create-time agentKeyHash, verifies receipt, rejects replay and category failure', async () => {
    const client = new MockMoatClient();
    const agentKeyHash = demoAgentKeyHash();
    const created = await client.createCapability({
      policy: {
        agentName: 'Research Agent A',
        agentKeyHash,
        perTransactionLimit: 20n,
        totalBudget: 50n,
        maxUses: 3,
        allowedCategory: 'developer-tools',
      },
    });

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
    const agentKeyHash = demoAgentKeyHash();
    const created = await client.createCapability({
      policy: {
        agentName: 'Research Agent A',
        agentKeyHash,
        perTransactionLimit: 20n,
        totalBudget: 50n,
        maxUses: 3,
        allowedCategory: 'developer-tools',
      },
    });
    const snap = await client.getCapability(created.capabilityId);
    expect(snap).toBeTruthy();
    snap!.revoked = true;
    const again = await client.getCapability(created.capabilityId);
    expect(again?.revoked).toBe(false);
  });
});
