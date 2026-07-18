import { describe, expect, it } from 'vitest';

import {
  advanceSpendStateAfterAuthorization,
  createMoatPrivateState,
  witnesses,
} from '../src/witnesses.js';

const bytes = (label: string): Uint8Array => new TextEncoder().encode(label.padEnd(32, '\0')).slice(0, 32);

const baseState = () =>
  createMoatPrivateState({
    ownerSecret: bytes('owner'),
    policySalt: bytes('policy-salt'),
    agentKeyHash: bytes('agent-key'),
    perTransactionLimit: 20n,
    totalBudget: 50n,
    maxUses: 3n,
    allowedCategoryHash: bytes('category'),
    stateSalt: bytes('state-salt-0'),
    agentSecret: bytes('agent-secret'),
    requestCategoryHash: bytes('category'),
    requestNonce: bytes('nonce-1'),
    oneTimeDestinationHash: bytes('dest-1'),
    newStateSalt: bytes('state-salt-1'),
    amount: 12n,
  });

describe('MoatPrivateState', () => {
  it('defaults spend openings to zero bigints', () => {
    const state = baseState();
    expect(state.spentSoFar).toBe(0n);
    expect(state.useCount).toBe(0n);
    expect(state.maxUses).toBe(3n);
    expect(typeof state.maxUses).toBe('bigint');
    expect(typeof state.useCount).toBe('bigint');
  });

  it('advances spentSoFar, useCount, and stateSalt after authorization', () => {
    const next = advanceSpendStateAfterAuthorization(baseState());
    expect(next.spentSoFar).toBe(12n);
    expect(next.useCount).toBe(1n);
    expect(next.stateSalt).toEqual(bytes('state-salt-1'));
    expect(next.amount).toBe(0n);
  });

  it('supports a second spend from the updated private state', () => {
    const afterFirst = advanceSpendStateAfterAuthorization(baseState());
    const secondRequest = {
      ...afterFirst,
      amount: 8n,
      requestNonce: bytes('nonce-2'),
      oneTimeDestinationHash: bytes('dest-2'),
      newStateSalt: bytes('state-salt-2'),
    };
    const afterSecond = advanceSpendStateAfterAuthorization(secondRequest);
    expect(afterSecond.spentSoFar).toBe(20n);
    expect(afterSecond.useCount).toBe(2n);
    expect(afterSecond.stateSalt).toEqual(bytes('state-salt-2'));
  });

  it('rejects advancing with a non-positive amount', () => {
    expect(() => advanceSpendStateAfterAuthorization({ ...baseState(), amount: 0n })).toThrow(
      /positive authorization amount/,
    );
  });

  it('rejects advancing past maxUses or totalBudget', () => {
    expect(() =>
      advanceSpendStateAfterAuthorization({ ...baseState(), useCount: 3n, amount: 1n }),
    ).toThrow(/maxUses/);
    expect(() =>
      advanceSpendStateAfterAuthorization({ ...baseState(), spentSoFar: 45n, amount: 10n }),
    ).toThrow(/totalBudget/);
  });

  it('witness helpers return bigint for Uint openings without mutating state', () => {
    const state = baseState();
    const context = { privateState: state } as never;
    const [nextState, maxUses] = witnesses.maxUses(context);
    const [, useCount] = witnesses.useCount(context);
    expect(maxUses).toBe(3n);
    expect(useCount).toBe(0n);
    expect(nextState).toBe(state);
  });
});
