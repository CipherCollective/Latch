/** Local / testnet endpoint presets for Atharv + real-client wiring. */

export type NetworkId = 'demo' | 'undeployed' | 'preprod' | 'preview' | 'mainnet';

export interface NetworkEndpoints {
  networkId: NetworkId;
  indexerHttp: string;
  indexerWs: string;
  node: string;
  proofServer: string;
}

/**
 * Endpoints for `docker compose up` (see repo-root `docker-compose.yml`).
 * Indexer path follows Midnight local-dev / docs for indexer-standalone 4.x (`/api/v4/`).
 * If GraphQL 404s locally, try `/api/v3/graphql` and update CORE_STATUS.
 */
export const UNDEPLOYED_ENDPOINTS: NetworkEndpoints = {
  networkId: 'undeployed',
  indexerHttp: 'http://127.0.0.1:8088/api/v4/graphql',
  indexerWs: 'ws://127.0.0.1:8088/api/v4/graphql/ws',
  node: 'http://127.0.0.1:9944',
  proofServer: 'http://127.0.0.1:6300',
};

/** Proof server only — node/indexer point at public Preprod (fill when using remote). */
export const PREPROD_LOCAL_PROOF: Pick<NetworkEndpoints, 'networkId' | 'proofServer'> = {
  networkId: 'preprod',
  proofServer: 'http://127.0.0.1:6300',
};

export function endpointsFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): NetworkEndpoints | { networkId: 'demo' } {
  const network = (env.MIDNIGHT_NETWORK ?? 'demo').toLowerCase();
  if (network === 'undeployed') {
    return {
      networkId: 'undeployed',
      indexerHttp: env.MIDNIGHT_INDEXER_HTTP ?? UNDEPLOYED_ENDPOINTS.indexerHttp,
      indexerWs: env.MIDNIGHT_INDEXER_WS ?? UNDEPLOYED_ENDPOINTS.indexerWs,
      node: env.MIDNIGHT_NODE_URL ?? UNDEPLOYED_ENDPOINTS.node,
      proofServer: env.PROOF_SERVER_URL ?? UNDEPLOYED_ENDPOINTS.proofServer,
    };
  }
  if (network === 'preprod') {
    return {
      networkId: 'preprod',
      indexerHttp: env.MIDNIGHT_INDEXER_HTTP ?? '',
      indexerWs: env.MIDNIGHT_INDEXER_WS ?? '',
      node: env.MIDNIGHT_NODE_URL ?? '',
      proofServer: env.PROOF_SERVER_URL ?? PREPROD_LOCAL_PROOF.proofServer,
    };
  }
  return { networkId: 'demo' };
}
