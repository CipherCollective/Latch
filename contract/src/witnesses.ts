import type { WitnessContext } from '@midnight-ntwrk/compact-runtime';

/**
 * Local private openings for a MOAT capability + spend request.
 * Never log these values. Session/in-memory storage is acceptable for the hackathon when documented.
 *
 * Uint witness fields use `bigint` to match Compact runtime encodings (including Uint<32>).
 */
export type MoatPrivateState = {
  ownerSecret: Uint8Array;
  policySalt: Uint8Array;
  agentKeyHash: Uint8Array;
  perTransactionLimit: bigint;
  totalBudget: bigint;
  maxUses: bigint;
  allowedCategoryHash: Uint8Array;
  stateSalt: Uint8Array;
  spentSoFar: bigint;
  useCount: bigint;
  agentSecret: Uint8Array;
  amount: bigint;
  requestCategoryHash: Uint8Array;
  requestNonce: Uint8Array;
  oneTimeDestinationHash: Uint8Array;
  newStateSalt: Uint8Array;
};

export const createMoatPrivateState = (
  input: Omit<MoatPrivateState, 'spentSoFar' | 'useCount' | 'amount'> & {
    spentSoFar?: bigint;
    useCount?: bigint;
    amount?: bigint;
  },
): MoatPrivateState => ({
  ...input,
  spentSoFar: input.spentSoFar ?? 0n,
  useCount: input.useCount ?? 0n,
  amount: input.amount ?? 0n,
});

/**
 * After a successful `authorizeSpend`, advance local openings so they reopen the
 * new on-ledger spend-state commitment. Witness callbacks only supply openings
 * during the circuit; callers must apply this transition once the tx succeeds.
 */
export const advanceSpendStateAfterAuthorization = (state: MoatPrivateState): MoatPrivateState => {
  if (state.amount <= 0n) {
    throw new Error('Cannot advance spend state without a positive authorization amount.');
  }
  if (state.useCount + 1n > state.maxUses) {
    throw new Error('Cannot advance spend state: maxUses would be exceeded.');
  }
  if (state.spentSoFar + state.amount > state.totalBudget) {
    throw new Error('Cannot advance spend state: totalBudget would be exceeded.');
  }

  return {
    ...state,
    spentSoFar: state.spentSoFar + state.amount,
    useCount: state.useCount + 1n,
    stateSalt: state.newStateSalt,
    amount: 0n,
  };
};

type WitnessFn<T> = (ctx: WitnessContext<unknown, MoatPrivateState>) => [MoatPrivateState, T];

const fromState =
  <K extends keyof MoatPrivateState>(key: K): WitnessFn<MoatPrivateState[K]> =>
  ({ privateState }) =>
    [privateState, privateState[key]];

export const witnesses = {
  ownerSecret: fromState('ownerSecret'),
  policySalt: fromState('policySalt'),
  agentKeyHash: fromState('agentKeyHash'),
  perTransactionLimit: fromState('perTransactionLimit'),
  totalBudget: fromState('totalBudget'),
  maxUses: fromState('maxUses'),
  allowedCategoryHash: fromState('allowedCategoryHash'),
  stateSalt: fromState('stateSalt'),
  spentSoFar: fromState('spentSoFar'),
  useCount: fromState('useCount'),
  agentSecret: fromState('agentSecret'),
  amount: fromState('amount'),
  requestCategoryHash: fromState('requestCategoryHash'),
  requestNonce: fromState('requestNonce'),
  oneTimeDestinationHash: fromState('oneTimeDestinationHash'),
  newStateSalt: fromState('newStateSalt'),
};
