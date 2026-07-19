#!/usr/bin/env node
/**
 * Prints the exact Lace/browser deploy call for Atharv.
 * Prep only — actual deploy must run in the browser with Lace connected.
 */
console.log(`
Latch Lace / Preprod deploy (browser only — no Docker/WSL/Node wallet sync)

Already done by: npm run deploy:lace
  • Compact artifacts prepared
  • ZK keys synced → web/public/zk/moat  (URL /zk/moat/)
  • @latch/api built

In the browser (Lace on Preprod, funded via faucet.preprod.midnight.network):

  import { FetchZkConfigProvider } from '@midnight-ntwrk/midnight-js-fetch-zk-config-provider';
  import {
    PREPROD_ENDPOINTS,
    createMoatProviders,
    deployMoatContractLowLevel,
    waitForMoatContract,
  } from '@latch/api';

  const zk = new FetchZkConfigProvider(
    import.meta.env.VITE_ZK_ASSET_BASE_URL ?? '/zk/moat/',
  );

  // walletAndMidnightProvider = Lace ConnectedAPI mapped to WalletProvider & MidnightProvider
  const providers = createMoatProviders({
    endpoints: {
      ...PREPROD_ENDPOINTS,
      proofServer:
        session.configuration.proverServerUri ?? PREPROD_ENDPOINTS.proofServer,
      indexerHttp: session.configuration.indexerUri,
      indexerWs: session.configuration.indexerWsUri,
      node: session.configuration.substrateNodeUri,
    },
    walletAndMidnightProvider,
    zkConfigProvider: zk,
  });

  const { contractAddress, txId } = await deployMoatContractLowLevel(providers);
  await waitForMoatContract(providers, contractAddress); // optional
  console.log('VITE_MOAT_CONTRACT_ADDRESS=' + contractAddress);
  console.log('txId=' + txId);

Exact one-liner once providers exist:

  await deployMoatContractLowLevel(providers)

Then set in web/.env.local (or Pages env):

  VITE_MIDNIGHT_NETWORK=preprod
  VITE_MOAT_CONTRACT_ADDRESS=<address from above>
  VITE_ZK_ASSET_BASE_URL=/zk/moat/

Do NOT use npm run deploy:preprod / WalletFacade on Windows — it OOMs syncing Preprod.
Local Docker address 0783e0c4… is NOT Preprod.
`);
