import type { WitnessContext } from '@midnight-ntwrk/compact-runtime';

/**
 * Local private openings for a MOAT capability + spend request.
 * Never log these values. Session/in-memory storage is acceptable for the hackathon when documented.
 */
export type MoatPrivateState = {
  ownerSecret: Uint8Array;
  policySalt: Uint8Array;
  agentKeyHash: Uint8Array;
  perTransactionLimit: bigint;
  totalBudget: bigint;
  maxUses: number;
  allowedCategoryHash: Uint8Array;
  stateSalt: Uint8Array;
  spentSoFar: bigint;
  useCount: number;
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
    useCount?: number;
    amount?: bigint;
  },
): MoatPrivateState => ({
  ...input,
  spentSoFar: input.spentSoFar ?? 0n,
  useCount: input.useCount ?? 0,
  amount: input.amount ?? 0n,
});

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
