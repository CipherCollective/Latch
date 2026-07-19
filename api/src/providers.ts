import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import type {
  MidnightProvider,
  MidnightProviders,
  WalletProvider,
  ZKConfigProvider,
} from '@midnight-ntwrk/midnight-js-types';

import type { MoatPrivateState } from '@latch/contract';

import { defaultMoatZkAssetsPath, MOAT_PRIVATE_STATE_ID, type MoatPrivateStateId } from './moat-compiled.js';
import type { NetworkEndpoints } from './networks.js';
import { createInMemoryPrivateStateProvider } from './private-state-provider.js';

export type MoatCircuitId = 'createCapability' | 'authorizeSpend' | 'revokeCapability';

export type MoatProviders = MidnightProviders<MoatCircuitId, MoatPrivateStateId, MoatPrivateState>;

export type WalletAndMidnightProvider = WalletProvider & MidnightProvider;

export type CreateMoatProvidersInput = {
  endpoints: NetworkEndpoints;
  /** Injected by Atharv (Lace/1AM) or a Node deploy script. */
  walletAndMidnightProvider: WalletAndMidnightProvider;
  /** Node filesystem ZK assets (default: contract managed/moat). Browser: pass FetchZkConfigProvider. */
  zkConfigProvider?: ZKConfigProvider<MoatCircuitId>;
  zkAssetsPath?: string;
  privateStateProvider?: MoatProviders['privateStateProvider'];
};

/**
 * Build Midnight.js providers for MOAT against undeployed/preprod endpoints.
 * Always call this after Docker `local:up` (or Preprod endpoints) and wallet connect.
 */
export function createMoatProviders(input: CreateMoatProvidersInput): MoatProviders {
  if (input.endpoints.networkId === 'demo') {
    throw new Error('createMoatProviders requires undeployed or preprod endpoints, not demo');
  }

  setNetworkId(input.endpoints.networkId);

  const zkAssetsPath = input.zkAssetsPath ?? defaultMoatZkAssetsPath();
  const zkConfigProvider =
    input.zkConfigProvider ?? new NodeZkConfigProvider<MoatCircuitId>(zkAssetsPath);

  return {
    privateStateProvider: input.privateStateProvider ?? createInMemoryPrivateStateProvider(),
    publicDataProvider: indexerPublicDataProvider(
      input.endpoints.indexerHttp,
      input.endpoints.indexerWs,
    ),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(input.endpoints.proofServer, zkConfigProvider),
    walletProvider: input.walletAndMidnightProvider,
    midnightProvider: input.walletAndMidnightProvider,
  };
}

export { MOAT_PRIVATE_STATE_ID };
