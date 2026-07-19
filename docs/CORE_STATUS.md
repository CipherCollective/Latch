# Latch Core Status (Ashiha / Cursor)

This log is for the Compact / Midnight / cryptography workstream. It must not contain secrets, wallet material, private witnesses, or private policy payloads.

## Environment

| Item | Value |
| --- | --- |
| Date | 2026-07-19 |
| Host OS | Windows 10 / 11 |
| Compact host | WSL Ubuntu (required; native Windows Compact is unsupported) |
| Node (Windows) | v24.5.0 |
| Docker Desktop | 28.3.2 |
| Compact toolchain | **0.31.1** / language **0.23.0** |
| Compact runtime | **0.16.0** |
| Compact.js | **2.5.1** |
| Midnight.js | **4.1.1** |
| Local stack | node `0.22.5`, indexer `4.0.2`, proof-server `8.0.3` |

## Branch

- Active branch: `feat/ashiha/real-client`
- Depends on: `feat/ashiha/docker-proof-server` → `feat/ashiha/api-client` → contract PRs
- Ownership: `api/**` real client + providers/deploy helpers, `docs/CORE_STATUS.md`
- Did **not** edit `web/**`

## Deliverable — real Midnight client wiring

| Path | Role |
| --- | --- |
| `api/src/moat-compiled.ts` | `CompiledContract.make('moat', …)` + ZK asset path |
| `api/src/providers.ts` | `createMoatProviders` (indexer + proof server + injected wallet) |
| `api/src/private-state-provider.ts` | In-memory private state (hackathon / browser-safe) |
| `api/src/deploy.ts` | `deployMoatContract` / `joinMoatContract` |
| `api/src/real-client.ts` | `RealMoatClient` implementing `MoatClient` |
| `api/src/moat-client.ts` | `createConfiguredMoatClient` + existing factory seam |
| `api/src/networks.ts` | Undeployed + Preprod endpoint presets |

### Atharv integration sketch

```ts
import {
  UNDEPLOYED_ENDPOINTS,
  createMoatProviders,
  deployMoatContract, // or joinMoatContract(providers, address)
  createConfiguredMoatClient,
  hashAgentKey,
  randomBytes32,
  toHex32,
} from '@latch/api';

// 1) walletAndMidnightProvider comes from Lace/1AM adapter (Atharv)
const providers = createMoatProviders({
  endpoints: UNDEPLOYED_ENDPOINTS,
  walletAndMidnightProvider, // injected
});

const deployed = await joinMoatContract(providers, process.env.MOAT_CONTRACT_ADDRESS!);
// or: const deployed = await deployMoatContract(providers);

const client = createConfiguredMoatClient({
  providers,
  deployed,
  networkId: 'undeployed',
});

const agentSecret = randomBytes32();
const agentKeyHash = toHex32(hashAgentKey(agentSecret));
client.registerAgentSecret(agentKeyHash, agentSecret);

const created = await client.createCapability({
  policy: { agentName: '…', agentKeyHash, perTransactionLimit: 20n, totalBudget: 50n, maxUses: 3, allowedCategory: 'developer-tools' },
});
```

### Verify

```bash
npm run typecheck:api   # exit 0
npm run test:api        # 13 tests passed (includes compiled-contract smoke)
```

## ZK assets for Atharv (browser)

After Compact compile:

```bash
npm run prepare:contract
npm run sync:zk-assets
```

Serves managed keys/zkir at **`/zk/moat/`** (`web/public/zk/moat`). Atharv pairs `FetchZkConfigProvider` with that base URL.

## Preprod deploy — Lace browser (canonical)

**One prep command (repo root, no Docker/WSL required if Compact artifacts already exist):**

```bash
npm run deploy:lace
```

That prepares contract + syncs `/zk/moat/` + builds `@latch/api` and prints the Lace snippet.

**Exact browser call once Lace providers exist** (avoids `deployContract` indexer hang):

```ts
const { contractAddress, txId } = await deployMoatContractLowLevel(providers);
```

Full wiring:

```ts
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

const providers = createMoatProviders({
  endpoints: {
    ...PREPROD_ENDPOINTS,
    // prefer Lace session.configuration URIs when present
  },
  walletAndMidnightProvider, // Atharv: Lace ConnectedAPI → WalletProvider & MidnightProvider
  zkConfigProvider: zk,
});

const { contractAddress, txId } = await deployMoatContractLowLevel(providers);
await waitForMoatContract(providers, contractAddress); // optional
// → set VITE_MOAT_CONTRACT_ADDRESS=<contractAddress>
```

Faucet: https://faucet.preprod.midnight.network/

**[CORE FACT REQUIRED]** Preprod `VITE_MOAT_CONTRACT_ADDRESS`: fill after Lace `deployMoatContractLowLevel` succeeds.

Do **not** run `npm run deploy:preprod` / WalletFacade full Preprod sync on Windows (OOM / multi-hour hang).

## Deploy (undeployed) — local Docker only 2026-07-19

**Not for Atharv / public internet.** Local address (this Docker volume only):

`0783e0c4931a6b9d7e4df86b7c97916a9d3d753521ded864c3ae828d411b9c48`

```bash
npm run local:up && npm run deploy:local
```

## Not done yet

1. Atharv: Lace providers → `deployMoatContractLowLevel` → record Preprod address
2. Wire `VITE_MOAT_CONTRACT_ADDRESS` + join / `createConfiguredMoatClient`
3. Full Compact circuit simulator / proof-path integration tests

## Blockers / limitations

- Browser `RealMoatClient` needs Atharv’s funded Lace/1AM `WalletProvider & MidnightProvider`.
- In-memory private state is **not encrypted** — session-only for the hackathon.
- `registerAgentSecret` is mandatory before `createCapability`.
- Genesis seed is **local-dev only** — never reuse on Preprod/mainnet.
- Local undeployed address is **not** the internet handoff.

## Handoff notes for Atharv

- Demo: `MockMoatClient` (`MIDNIGHT_NETWORK=demo`).
- Real Preprod: set `VITE_MOAT_CONTRACT_ADDRESS` from Preprod deploy → connect Lace/1AM on Preprod → `joinMoatContract` / `createConfiguredMoatClient` with injected wallet providers.
- Env: `.env.example` (`PROOF_SERVER_URL`, Preprod indexer/node, `MIDNIGHT_PREPROD_SEED` local-only).
- Packages: `@midnight-ntwrk/compact-js@2.5.1`, `@midnight-ntwrk/midnight-js-*@4.1.1`.
