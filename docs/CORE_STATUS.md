# Latch Core Status (Ashiha / Cursor)

This log is for the Compact / Midnight / cryptography workstream. It must not contain secrets, wallet material, private witnesses, or private policy payloads.

## Environment

| Item | Value |
| --- | --- |
| Date | 2026-07-18 |
| Host OS | Windows 10 / 11 |
| Compact host | WSL Ubuntu (required; native Windows Compact is unsupported) |
| Node (Windows) | v24.5.0 |
| npm (Windows) | 11.5.1 |
| Docker Desktop | 28.3.2 (running) |
| Compact CLI | 0.5.1 (`/root/.local/bin/compact`) |
| Compact toolchain | **0.31.1** (support-matrix target) |
| Compact language pragma | `>= 0.22` |
| Compact runtime (pinned) | `@midnight-ntwrk/compact-runtime@0.16.0` |
| Local stack images | node `0.22.5`, indexer `4.0.2`, proof-server `8.0.3` |
| Midnight.js (not wired yet) | deferred to real-client / deploy |

## Midnight skills

Command run from repository root:

```text
npx skills add Kali-Decoder/Midnight-skills
```

Result: **30 skills installed** under `.agents/skills/` (gitignored).

## Branch

- Active branch: `feat/ashiha/docker-proof-server`
- Depends on: `feat/ashiha/api-client` (and prior contract PRs) until merged to `main`
- Ownership: `docker-compose.yml`, root `local:*` scripts, `api/src/networks.ts`, `.env.example`, `docs/CORE_STATUS.md`
- Did **not** edit `web/**`

## Deliverable — local undeployed Docker stack

| Path | Role |
| --- | --- |
| `docker-compose.yml` | Node + indexer + proof-server (from official midnight-local-dev tags) |
| `api/src/networks.ts` | `UNDEPLOYED_ENDPOINTS` + `endpointsFromEnv` |
| `.env.example` | Undeployed / Preprod env placeholders |
| Root `package.json` | `local:up` / `local:down` / `local:ps` / `local:logs` / `local:proof` |

### Commands

```bash
cd "$(git rev-parse --show-toplevel)"
npm run local:up      # full stack
npm run local:ps      # health
npm run local:proof   # proof-server only (e.g. Preprod proving)
npm run local:down
```

### Endpoints (localhost-bound)

| Service | URL |
| --- | --- |
| Proof server | `http://127.0.0.1:6300` |
| Node | `http://127.0.0.1:9944` |
| Indexer GraphQL | `http://127.0.0.1:8088/api/v4/graphql` |
| Indexer WS | `ws://127.0.0.1:8088/api/v4/graphql/ws` |

### Verify evidence (this machine)

```text
npm run typecheck:api  → exit 0
npm run test:api       → 16 tests passed
docker compose up -d   → midnight-node, midnight-indexer, midnight-proof-server all healthy
```

Notes:

- Compose adapted from `midnightntwrk/midnight-local-dev` `standalone.yml` (official images/tags).
- Indexer passwords / `APP__INFRA__SECRET` are **local-dev defaults only**.
- Full undeployed txs still need genesis wallet funding / DUST registration (use midnight-local-dev CLI or document when real-client lands). Proof server alone is enough to start generating proofs once a client exists.
- Containers are Compose project-namespaced (no fixed `container_name`) to avoid collisions with other Midnight stacks.

## Not done yet (next pieces)

1. Real Midnight client wired to compiled contract (providers + deploy address)
2. Full Compact circuit transition tests (simulator / proof path)
3. Deploy (deferred — last)
4. Genesis funding helper for undeployed (optional; midnight-local-dev covers this)

## Blockers

- None for bringing the local stack up healthy.
- Real deploy / Preprod still blocked on funded wallet + real client.
- Contract address for undeployed: **[CORE FACT REQUIRED]** after deploy step.

## Handoff notes for Atharv

- Demo mode: no Docker required (`MockMoatClient`, `MIDNIGHT_NETWORK=demo`).
- Local real mode: `npm run local:up`, then use `UNDEPLOYED_ENDPOINTS` / `.env.example`.
- Import network helpers from `@latch/api` (`endpointsFromEnv`, `UNDEPLOYED_ENDPOINTS`).
- Real `MoatClient` still throws `CoreHandoffRequiredError` until the real-client branch lands.
- Circuits available: `createCapability`, `authorizeSpend`, `revokeCapability`.
