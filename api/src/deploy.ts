import {
  createUnprovenDeployTx,
  deployContract,
  findDeployedContract,
  submitTxAsync,
} from '@midnight-ntwrk/midnight-js-contracts';
import type { DeployedContract, FoundContract } from '@midnight-ntwrk/midnight-js-contracts';
import { sampleSigningKey, type SigningKey } from '@midnight-ntwrk/ledger-v8';
import { createMoatPrivateState, type MoatPrivateState } from '@latch/contract';

import {
  makeMoatCompiledContract,
  makeMoatCompiledContractBrowser,
  MOAT_PRIVATE_STATE_ID,
  type MoatContract,
} from './moat-compiled.js';
import { randomBytes32 } from './commitments.js';
import type { MoatProviders } from './providers.js';

export type DeployedMoat = DeployedContract<MoatContract> | FoundContract<MoatContract>;

export type LowLevelDeployResult = {
  /** Public contract address — safe to put in VITE_MOAT_CONTRACT_ADDRESS. */
  contractAddress: string;
  /** Submitted transaction id (not yet necessarily finalized). */
  txId: string;
  signingKey: SigningKey;
  initialPrivateState: MoatPrivateState;
};

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

/**
 * Node convenience deploy (`deployContract` + indexer watch).
 * Prefer {@link deployMoatContractLowLevel} on Preprod — `deployContract` can hang waiting for indexer.
 */
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

/**
 * Browser / Preprod-friendly deploy: `createUnprovenDeployTx` + `submitTxAsync`.
 * Returns the contract address immediately after submit (does not block on indexer finality).
 *
 * Atharv: build providers from Lace/1AM session (FetchZkConfigProvider → `/zk/moat`),
 * then call this. Persist `signingKey` + private state for later circuit calls.
 */
export async function deployMoatContractLowLevel(
  providers: MoatProviders,
  options?: {
    /**
     * When true, load ZK artifacts from disk (Node).
     * Default false — browser + FetchZkConfigProvider at `/zk/moat`.
     */
    useFileAssets?: boolean;
    zkAssetsPath?: string;
    initialPrivateState?: MoatPrivateState;
    signingKey?: SigningKey;
  },
): Promise<LowLevelDeployResult> {
  const initialPrivateState = options?.initialPrivateState ?? emptyMoatPrivateState();
  const signingKey = options?.signingKey ?? sampleSigningKey();
  const compiledContract = options?.useFileAssets
    ? makeMoatCompiledContract(options?.zkAssetsPath)
    : makeMoatCompiledContractBrowser();

  const deployTxData = await createUnprovenDeployTx(
    {
      zkConfigProvider: providers.zkConfigProvider,
      walletProvider: providers.walletProvider,
    },
    {
      compiledContract: compiledContract as never,
      initialPrivateState,
      signingKey,
    } as never,
  );

  const contractAddress = String(deployTxData.public.contractAddress);
  const txId = await submitTxAsync(providers, {
    unprovenTx: deployTxData.private.unprovenTx,
  });

  providers.privateStateProvider.setContractAddress(contractAddress);
  await providers.privateStateProvider.set(MOAT_PRIVATE_STATE_ID, initialPrivateState);
  await providers.privateStateProvider.setSigningKey(contractAddress, signingKey);

  return {
    contractAddress,
    txId,
    signingKey,
    initialPrivateState,
  };
}

/**
 * Poll indexer until the contract address has public state (or timeout).
 * Useful after {@link deployMoatContractLowLevel} when the UI should wait for visibility.
 */
export async function waitForMoatContract(
  providers: Pick<MoatProviders, 'publicDataProvider'>,
  contractAddress: string,
  options?: { timeoutMs?: number; intervalMs?: number },
): Promise<void> {
  const timeoutMs = options?.timeoutMs ?? 180_000;
  const intervalMs = options?.intervalMs ?? 3_000;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const state = await providers.publicDataProvider.queryContractState(contractAddress);
    if (state != null) return;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(
    `Timed out waiting for MOAT contract ${contractAddress} on the indexer. Tx may still confirm — retry join later.`,
  );
}

export async function joinMoatContract(
  providers: MoatProviders,
  contractAddress: string,
  options?: { zkAssetsPath?: string; initialPrivateState?: MoatPrivateState; browser?: boolean },
): Promise<DeployedMoat> {
  const compiledContract = options?.browser
    ? makeMoatCompiledContractBrowser()
    : makeMoatCompiledContract(options?.zkAssetsPath);
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
