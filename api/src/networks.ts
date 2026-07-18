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
 */
export const UNDEPLOYED_ENDPOINTS: NetworkEndpoints = {
  networkId: 'undeployed',
  indexerHttp: 'http://127.0.0.1:8088/api/v4/graphql',
  indexerWs: 'ws://127.0.0.1:8088/api/v4/graphql/ws',
  node: 'http://127.0.0.1:9944',
  proofServer: 'http://127.0.0.1:6300',
};

/** Public Preprod endpoints (proof server may still be local via `npm run local:proof`). */
export const PREPROD_ENDPOINTS: NetworkEndpoints = {
  networkId: 'preprod',
  indexerHttp: 'https://indexer.preprod.midnight.network/api/v4/graphql',
  indexerWs: 'wss://indexer.preprod.midnight.network/api/v4/graphql/ws',
  node: 'https://rpc.preprod.midnight.network',
  proofServer: 'http://127.0.0.1:6300',
};

export function endpointsFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): NetworkEndpoints | { networkId: 'demo' } {
  const raw = env.MIDNIGHT_NETWORK;
  if (raw === undefined || raw === '') {
    return { networkId: 'demo' };
  }

  const network = raw.toLowerCase();
  if (network === 'demo') {
    return { networkId: 'demo' };
  }
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
    const indexerHttp = env.MIDNIGHT_INDEXER_HTTP ?? PREPROD_ENDPOINTS.indexerHttp;
    const indexerWs = env.MIDNIGHT_INDEXER_WS ?? PREPROD_ENDPOINTS.indexerWs;
    const node = env.MIDNIGHT_NODE_URL ?? PREPROD_ENDPOINTS.node;
    const proofServer = env.PROOF_SERVER_URL ?? PREPROD_ENDPOINTS.proofServer;
    if (!indexerHttp || !indexerWs || !node || !proofServer) {
      throw new Error(
        'preprod requires MIDNIGHT_INDEXER_HTTP, MIDNIGHT_INDEXER_WS, MIDNIGHT_NODE_URL, and PROOF_SERVER_URL (or use PREPROD_ENDPOINTS defaults)',
      );
    }
    return { networkId: 'preprod', indexerHttp, indexerWs, node, proofServer };
  }
  if (network === 'preview' || network === 'mainnet') {
    throw new Error(
      `MIDNIGHT_NETWORK=${network} is not configured in @latch/api yet. Use demo, undeployed, or preprod.`,
    );
  }
  throw new Error(`Unsupported MIDNIGHT_NETWORK=${raw}. Use demo, undeployed, or preprod.`);
}
