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

## Not done yet

1. Live deploy against funded undeployed/Preprod wallet → fill `MOAT_CONTRACT_ADDRESS` (**[CORE FACT REQUIRED]**)
2. Full Compact circuit simulator / proof-path integration tests
3. Genesis funding automation (use midnight-local-dev or faucet)
4. Deploy last (as planned)

## Blockers / limitations

- `RealMoatClient` needs a **funded** `WalletProvider & MidnightProvider` from Atharv (or a Node deploy script). This branch does not embed Lace/HD wallet secrets.
- In-memory private state is **not encrypted** — session-only for the hackathon.
- `registerAgentSecret` is mandatory before `createCapability` so circuit `hashAgentKey(agentSecret)` opens the policy hash.
- Contract address after deploy: still **[CORE FACT REQUIRED]** until deploy piece runs.

## Handoff notes for Atharv

- Demo: keep using `MockMoatClient` (`MIDNIGHT_NETWORK=demo`).
- Real: `npm run local:up`, inject wallet providers, `joinMoatContract`/`deployMoatContract`, then `createConfiguredMoatClient`.
- Env: see `.env.example` (`PROOF_SERVER_URL`, indexer/node URLs, optional `MOAT_ZK_ASSETS_PATH`, future `MOAT_CONTRACT_ADDRESS`).
- Packages pinned for runtime **0.16.0**: `@midnight-ntwrk/compact-js@2.5.1`, `@midnight-ntwrk/midnight-js-*@4.1.1`.
