import type { WitnessContext } from '@midnight-ntwrk/compact-runtime';

/**
 * Local private openings for a MOAT capability. Never log these values.
 * Session/in-memory storage is acceptable for the hackathon when documented.
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
};

export const createMoatPrivateState = (
  input: Omit<MoatPrivateState, 'spentSoFar' | 'useCount'> & {
    spentSoFar?: bigint;
    useCount?: number;
  },
): MoatPrivateState => ({
  ...input,
  spentSoFar: input.spentSoFar ?? 0n,
  useCount: input.useCount ?? 0,
});

export const witnesses = {
  ownerSecret: ({ privateState }: WitnessContext<unknown, MoatPrivateState>): [MoatPrivateState, Uint8Array] => [
    privateState,
    privateState.ownerSecret,
  ],
  policySalt: ({ privateState }: WitnessContext<unknown, MoatPrivateState>): [MoatPrivateState, Uint8Array] => [
    privateState,
    privateState.policySalt,
  ],
  agentKeyHash: ({ privateState }: WitnessContext<unknown, MoatPrivateState>): [MoatPrivateState, Uint8Array] => [
    privateState,
    privateState.agentKeyHash,
  ],
  perTransactionLimit: ({ privateState }: WitnessContext<unknown, MoatPrivateState>): [MoatPrivateState, bigint] => [
    privateState,
    privateState.perTransactionLimit,
  ],
  totalBudget: ({ privateState }: WitnessContext<unknown, MoatPrivateState>): [MoatPrivateState, bigint] => [
    privateState,
    privateState.totalBudget,
  ],
  maxUses: ({ privateState }: WitnessContext<unknown, MoatPrivateState>): [MoatPrivateState, number] => [
    privateState,
    privateState.maxUses,
  ],
  allowedCategoryHash: ({
    privateState,
  }: WitnessContext<unknown, MoatPrivateState>): [MoatPrivateState, Uint8Array] => [
    privateState,
    privateState.allowedCategoryHash,
  ],
  stateSalt: ({ privateState }: WitnessContext<unknown, MoatPrivateState>): [MoatPrivateState, Uint8Array] => [
    privateState,
    privateState.stateSalt,
  ],
  spentSoFar: ({ privateState }: WitnessContext<unknown, MoatPrivateState>): [MoatPrivateState, bigint] => [
    privateState,
    privateState.spentSoFar,
  ],
  useCount: ({ privateState }: WitnessContext<unknown, MoatPrivateState>): [MoatPrivateState, number] => [
    privateState,
    privateState.useCount,
  ],
};
