import { describe, expect, it } from 'vitest';
import type { AuthorizationReceipt } from '../types/domain';
import { projectOwnerReceipt, serializeOwnerReceipt } from './receipt-serialization';

const hostileReceipt = {
  capabilityId: 'cap_demo_owner',
  requestCommitment: 'req_allowed',
  receiptCommitment: 'receipt_allowed',
  nullifier: 'nullifier_allowed',
  oneTimeDestination: {
    destination: 'addr_allowed',
    ephemeralPublicKey: 'epk_allowed',
    viewTag: 'view_allowed',
    fixture: true,
    merchant: 'NESTED_MERCHANT_SECRET',
    witnesses: ['NESTED_WITNESS_SECRET'],
    arbitraryInjectedKey: 'NESTED_INJECTED_SECRET',
  },
  tx: {
    kind: 'demo-fixture',
    networkId: 'demo',
    txHash: 'tx_allowed',
    explorerUrl: 'https://explorer.example/tx_allowed',
    wallet: 'NESTED_WALLET_SECRET',
    privateRejection: 'NESTED_REJECTION_SECRET',
    arbitraryInjectedKey: 'TX_INJECTED_SECRET',
  },
  policy: { totalBudget: 'ROOT_POLICY_SECRET' },
  merchant: { merchantId: 'ROOT_MERCHANT_SECRET' },
  wallet: { seed: 'ROOT_WALLET_SECRET' },
  witnesses: ['ROOT_WITNESS_SECRET'],
  privateRejection: { code: 'ROOT_REJECTION_SECRET' },
  arbitraryInjectedKey: 'ROOT_INJECTED_SECRET',
} as unknown as AuthorizationReceipt;

describe('owner receipt clipboard serialization', () => {
  it('constructs an explicit recursive allowlist from a hostile runtime fixture', () => {
    const payload = projectOwnerReceipt(hostileReceipt);

    expect(payload).toEqual({
      capabilityId: 'cap_demo_owner',
      requestCommitment: 'req_allowed',
      receiptCommitment: 'receipt_allowed',
      nullifier: 'nullifier_allowed',
      oneTimeDestination: {
        destination: 'addr_allowed',
        ephemeralPublicKey: 'epk_allowed',
        viewTag: 'view_allowed',
        fixture: true,
      },
      tx: {
        kind: 'demo-fixture',
        networkId: 'demo',
        txHash: 'tx_allowed',
        explorerUrl: 'https://explorer.example/tx_allowed',
      },
    });

    expect(Object.getPrototypeOf(payload)).toBe(Object.prototype);
    expect(Object.getPrototypeOf(payload.oneTimeDestination)).toBe(Object.prototype);
    expect(Object.getPrototypeOf(payload.tx)).toBe(Object.prototype);
  });

  it('pretty prints allowed values without leaking banned keys or values', () => {
    const serialized = serializeOwnerReceipt(hostileReceipt);
    const parsed = JSON.parse(serialized) as Record<string, unknown>;

    expect(serialized).toContain('\n  "capabilityId": "cap_demo_owner"');
    expect(parsed).toEqual(projectOwnerReceipt(hostileReceipt));

    for (const bannedKey of [
      'policy',
      'merchant',
      'wallet',
      'witnesses',
      'privateRejection',
      'arbitraryInjectedKey',
    ]) {
      expect(serialized).not.toContain(`"${bannedKey}"`);
    }

    for (const bannedValue of [
      'ROOT_POLICY_SECRET',
      'ROOT_MERCHANT_SECRET',
      'ROOT_WALLET_SECRET',
      'ROOT_WITNESS_SECRET',
      'ROOT_REJECTION_SECRET',
      'ROOT_INJECTED_SECRET',
      'NESTED_MERCHANT_SECRET',
      'NESTED_WITNESS_SECRET',
      'NESTED_INJECTED_SECRET',
      'NESTED_WALLET_SECRET',
      'NESTED_REJECTION_SECRET',
      'TX_INJECTED_SECRET',
    ]) {
      expect(serialized).not.toContain(bannedValue);
    }
  });

  it('omits optional transaction metadata when absent', () => {
    const withoutOptionalTx = {
      ...hostileReceipt,
      tx: {
        kind: 'demo-fixture',
        networkId: 'demo',
        txHash: undefined,
        explorerUrl: undefined,
        wallet: 'DO_NOT_COPY',
      },
    } as unknown as AuthorizationReceipt;

    expect(projectOwnerReceipt(withoutOptionalTx).tx).toEqual({
      kind: 'demo-fixture',
      networkId: 'demo',
    });
  });

  it('rejects non-primitive allowed leaves rather than serializing nested injected data', () => {
    const poisonedLeaf = {
      ...hostileReceipt,
      capabilityId: { arbitraryInjectedKey: 'POISONED_LEAF_SECRET' },
    } as unknown as AuthorizationReceipt;

    expect(() => serializeOwnerReceipt(poisonedLeaf)).toThrow(/capabilityId must be a string/i);
  });
});
