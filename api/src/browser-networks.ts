/** Browser-safe Preprod endpoint definitions for the temporary wallet deploy tool. */
export type BrowserNetworkEndpoints = {
  networkId: 'preprod';
  indexerHttp: string;
  indexerWs: string;
  node: string;
  proofServer: string;
};

export const PREPROD_ENDPOINTS: BrowserNetworkEndpoints = {
  networkId: 'preprod',
  indexerHttp: 'https://indexer.preprod.midnight.network/api/v4/graphql',
  indexerWs: 'wss://indexer.preprod.midnight.network/api/v4/graphql/ws',
  node: 'https://rpc.preprod.midnight.network',
  proofServer: 'http://127.0.0.1:6300',
};
