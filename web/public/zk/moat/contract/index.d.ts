import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export type Witnesses<PS> = {
  ownerSecret(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  policySalt(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  agentKeyHash(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  perTransactionLimit(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, bigint];
  totalBudget(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, bigint];
  maxUses(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, bigint];
  allowedCategoryHash(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  stateSalt(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  spentSoFar(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, bigint];
  useCount(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, bigint];
  agentSecret(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  amount(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, bigint];
  requestCategoryHash(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  requestNonce(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  oneTimeDestinationHash(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  newStateSalt(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
}

export type ImpureCircuits<PS> = {
  createCapability(context: __compactRuntime.CircuitContext<PS>,
                   policyCommitment_0: Uint8Array,
                   spendStateCommitment_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  authorizeSpend(context: __compactRuntime.CircuitContext<PS>,
                 capabilityId_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  revokeCapability(context: __compactRuntime.CircuitContext<PS>,
                   capabilityId_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
}

export type ProvableCircuits<PS> = {
  createCapability(context: __compactRuntime.CircuitContext<PS>,
                   policyCommitment_0: Uint8Array,
                   spendStateCommitment_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  authorizeSpend(context: __compactRuntime.CircuitContext<PS>,
                 capabilityId_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  revokeCapability(context: __compactRuntime.CircuitContext<PS>,
                   capabilityId_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
}

export type PureCircuits = {
}

export type Circuits<PS> = {
  createCapability(context: __compactRuntime.CircuitContext<PS>,
                   policyCommitment_0: Uint8Array,
                   spendStateCommitment_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  authorizeSpend(context: __compactRuntime.CircuitContext<PS>,
                 capabilityId_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  revokeCapability(context: __compactRuntime.CircuitContext<PS>,
                   capabilityId_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
}

export type Ledger = {
  capabilities: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): { policyCommitment: Uint8Array,
                                 spendStateCommitment: Uint8Array,
                                 ownerCommitment: Uint8Array,
                                 revoked: boolean
                               };
    [Symbol.iterator](): Iterator<[Uint8Array, { policyCommitment: Uint8Array,
  spendStateCommitment: Uint8Array,
  ownerCommitment: Uint8Array,
  revoked: boolean
}]>
  };
  usedNullifiers: {
    isEmpty(): boolean;
    size(): bigint;
    member(elem_0: Uint8Array): boolean;
    [Symbol.iterator](): Iterator<Uint8Array>
  };
  verifiedReceipts: {
    isEmpty(): boolean;
    size(): bigint;
    member(elem_0: Uint8Array): boolean;
    [Symbol.iterator](): Iterator<Uint8Array>
  };
  readonly capabilityCount: bigint;
}

export type ContractReferenceLocations = any;

export declare const contractReferenceLocations : ContractReferenceLocations;

export declare class Contract<PS = any, W extends Witnesses<PS> = Witnesses<PS>> {
  witnesses: W;
  circuits: Circuits<PS>;
  impureCircuits: ImpureCircuits<PS>;
  provableCircuits: ProvableCircuits<PS>;
  constructor(witnesses: W);
  initialState(context: __compactRuntime.ConstructorContext<PS>): __compactRuntime.ConstructorResult<PS>;
}

export declare function ledger(state: __compactRuntime.StateValue | __compactRuntime.ChargedState): Ledger;
export declare const pureCircuits: PureCircuits;
