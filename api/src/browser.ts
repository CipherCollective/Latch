/**
 * Browser-only MOAT deployment helpers. This entrypoint intentionally avoids
 * Node filesystem imports so Vite can bundle the temporary wallet deployment
 * tool with FetchZkConfigProvider.
 */
import { CompiledContract } from '@midnight-ntwrk/compact-js';
import { sampleSigningKey, type SigningKey } from '@midnight-ntwrk/ledger-v8';
import { createUnprovenDeployTx, submitTxAsync } from '@midnight-ntwrk/midnight-js-contracts';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import type {
  MidnightProvider,
  MidnightProviders,
  WalletProvider,
  ZKConfigProvider,
} from '@midnight-ntwrk/midnight-js-types';
import { Moat, createMoatPrivateState, type MoatPrivateState, witnesses } from '@latch/contract';

import { randomBytes32 } from './commitments.js';
import type { NetworkEndpoints } from './networks.js';
import { PREPROD_ENDPOINTS } from './networks.js';
import { createInMemoryPrivateStateProvider } from './private-state-provider.js';

export { PREPROD_ENDPOINTS };

export const MOAT_PRIVATE_STATE_ID = 'moatPrivateState' as const;
export type MoatPrivateStateId = typeof MOAT_PRIVATE_STATE_ID;
export type MoatCircuitId = 'createCapability' | 'authorizeSpend' | 'revokeCapability';
export type MoatProviders = MidnightProviders<MoatCircuitId, MoatPrivateStateId, MoatPrivateState>;
export type WalletAndMidnightProvider = WalletProvider & MidnightProvider;

export type CreateMoatProvidersInput = {
  endpoints: NetworkEndpoints;
  walletAndMidnightProvider: WalletAndMidnightProvider;
  zkConfigProvider: ZKConfigProvider<MoatCircuitId>;
  privateStateProvider?: MoatProviders['privateStateProvider'];
};

/** Build browser-safe providers for a real Preprod wallet session. */
export function createMoatProviders(input: CreateMoatProvidersInput): MoatProviders {
  if (input.endpoints.networkId !== 'preprod') {
    throw new Error('The temporary browser deploy tool only supports Preprod.');
  }

  setNetworkId(input.endpoints.networkId);
  return {
    privateStateProvider: input.privateStateProvider ?? createInMemoryPrivateStateProvider(),
    publicDataProvider: indexerPublicDataProvider(input.endpoints.indexerHttp, input.endpoints.indexerWs),
    zkConfigProvider: input.zkConfigProvider,
    proofProvider: httpClientProofProvider(input.endpoints.proofServer, input.zkConfigProvider),
    walletProvider: input.walletAndMidnightProvider,
    midnightProvider: input.walletAndMidnightProvider,
  };
}

function makeMoatCompiledContractBrowser() {
  return CompiledContract.make('moat', Moat.Contract).pipe(
    CompiledContract.withWitnesses(witnesses as never),
  );
}

function emptyMoatPrivateState(): MoatPrivateState {
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

export type LowLevelDeployResult = {
  contractAddress: string;
  txId: string;
  signingKey: SigningKey;
  initialPrivateState: MoatPrivateState;
};

/** Submit a browser-built MOAT deploy without waiting indefinitely for the indexer. */
export async function deployMoatContractLowLevel(providers: MoatProviders): Promise<LowLevelDeployResult> {
  const initialPrivateState = emptyMoatPrivateState();
  const signingKey = sampleSigningKey();
  const deployTxData = await createUnprovenDeployTx(
    { zkConfigProvider: providers.zkConfigProvider, walletProvider: providers.walletProvider },
    {
      compiledContract: makeMoatCompiledContractBrowser() as never,
      initialPrivateState,
      signingKey,
    } as never,
  );

  const contractAddress = String(deployTxData.public.contractAddress);
  const txId = await submitTxAsync(providers, { unprovenTx: deployTxData.private.unprovenTx });
  providers.privateStateProvider.setContractAddress(contractAddress);
  await providers.privateStateProvider.set(MOAT_PRIVATE_STATE_ID, initialPrivateState);
  await providers.privateStateProvider.setSigningKey(contractAddress, signingKey);
  return { contractAddress, txId, signingKey, initialPrivateState };
}

/** Wait a bounded time for an already-submitted contract to become indexer-visible. */
export async function waitForMoatContract(
  providers: Pick<MoatProviders, 'publicDataProvider'>,
  contractAddress: string,
  options?: { timeoutMs?: number; intervalMs?: number },
): Promise<void> {
  const timeoutMs = options?.timeoutMs ?? 180_000;
  const intervalMs = options?.intervalMs ?? 3_000;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if ((await providers.publicDataProvider.queryContractState(contractAddress)) !== null) return;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error('The deployment was submitted but is not yet visible on the Preprod indexer.');
}
