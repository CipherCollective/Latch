import { deployContract, findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import type { DeployedContract, FoundContract } from '@midnight-ntwrk/midnight-js-contracts';
import { createMoatPrivateState, type MoatPrivateState } from '@latch/contract';

import { makeMoatCompiledContract, MOAT_PRIVATE_STATE_ID, type MoatContract } from './moat-compiled.js';
import { randomBytes32 } from './commitments.js';
import type { MoatProviders } from './providers.js';

export type DeployedMoat = DeployedContract<MoatContract> | FoundContract<MoatContract>;

/** Placeholder openings used only to satisfy deploy/join initial private state. */
export function emptyMoatPrivateState(): MoatPrivateState {
  const zeros = randomBytes32();
  return createMoatPrivateState({
    ownerSecret: zeros,
    policySalt: zeros,
    agentKeyHash: zeros,
    perTransactionLimit: 1n,
    totalBudget: 1n,
    maxUses: 1n,
    allowedCategoryHash: zeros,
    stateSalt: zeros,
    agentSecret: zeros,
    requestCategoryHash: zeros,
    requestNonce: zeros,
    oneTimeDestinationHash: zeros,
    newStateSalt: zeros,
    amount: 0n,
  });
}

export async function deployMoatContract(
  providers: MoatProviders,
  options?: { zkAssetsPath?: string; initialPrivateState?: MoatPrivateState },
): Promise<DeployedMoat> {
  const compiledContract = makeMoatCompiledContract(options?.zkAssetsPath);
  return deployContract(providers, {
    compiledContract: compiledContract as never,
    privateStateId: MOAT_PRIVATE_STATE_ID,
    initialPrivateState: options?.initialPrivateState ?? emptyMoatPrivateState(),
  });
}

export async function joinMoatContract(
  providers: MoatProviders,
  contractAddress: string,
  options?: { zkAssetsPath?: string; initialPrivateState?: MoatPrivateState },
): Promise<DeployedMoat> {
  const compiledContract = makeMoatCompiledContract(options?.zkAssetsPath);
  return findDeployedContract(providers, {
    compiledContract: compiledContract as never,
    contractAddress,
    privateStateId: MOAT_PRIVATE_STATE_ID,
    initialPrivateState: options?.initialPrivateState ?? emptyMoatPrivateState(),
  });
}

export function moatContractAddress(deployed: DeployedMoat): string {
  if ('deployTxData' in deployed && deployed.deployTxData?.public?.contractAddress) {
    return String(deployed.deployTxData.public.contractAddress);
  }
  // FoundContract exposes contractAddress at top level in midnight-js 4.x
  const found = deployed as FoundContract<MoatContract> & { contractAddress?: string };
  if (found.contractAddress) return String(found.contractAddress);
  throw new Error('Unable to read MOAT contract address from deployed handle');
}
