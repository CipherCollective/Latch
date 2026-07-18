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
| Compact CLI | 0.5.1 (`/root/.local/bin/compact`) |
| Compact toolchain | **0.31.1** (support-matrix target) |
| Compact language pragma | `>= 0.22` |
| Compact runtime (pinned) | `@midnight-ntwrk/compact-runtime@0.16.0` |
| Midnight.js (not wired yet) | support matrix lists 4.1.1 — deferred to real-client / deploy |

## Midnight skills

Command run from repository root:

```text
npx skills add Kali-Decoder/Midnight-skills
```

Result: **30 skills installed** under `.agents/skills/` (gitignored).

## Branch

- Active branch: `feat/ashiha/api-client`
- Depends on: `feat/ashiha/revoke-capability` (and prior contract PRs) until merged to `main`
- Ownership: `api/**`, root workspace scripts, `docs/CORE_STATUS.md`, `.env.example`
- Did **not** edit `web/**`

## Deliverable — `@latch/api` client package

| Path | Role |
| --- | --- |
| `api/src/types.ts` | Shared `MoatClient` / policy / spend / proof-step types for Atharv |
| `api/src/commitments.ts` | Domain-separated SHA-256 concat model of Compact domains |
| `api/src/stealth.ts` | secp256k1 one-time destinations (`@noble/secp256k1` + HMAC setup) |
| `api/src/mock-client.ts` | Deterministic demo `MockMoatClient` (no chain txs) |
| `api/src/moat-client.ts` | Real-client seam (`CoreHandoffRequiredError` until deploy handoff) |
| `api/src/wallet-session.ts` | Minimal session shape for real-client injection |
| `api/src/index.ts` | Package exports |
| `.env.example` | Network / proof-server placeholders (no secrets) |

### Behaviour notes

- **MockMoatClient**: creates local capability openings, runs proof-step callbacks, evaluates hidden constraints privately, issues demo receipts / nullifiers, advances spend state via `advanceSpendStateAfterAuthorization`.
- Demo `createCapability` generates its own agent secret; use `demoAgentKeyHash(capabilityId)` in tests/demo wiring (not a public Atharv surface).
- **Commitment parity**: TS helpers mirror Compact domain tags; bit-exact Compact `persistentHash` parity is deferred until the real Midnight client lands.
- **Stealth**: clean-room one-time destination from merchant view/spend meta-address + request nonce; unit-tested sender/receiver agreement.

### Verify (Windows)

```bash
cd "$(git rev-parse --show-toplevel)"
npm install
npm run typecheck:api
npm run test:api
```

Result: **exit 0** — `typecheck:api` + **6** vitest tests passed.

Compact rebuild still requires WSL (`npm run build --workspace @latch/contract` from WSL). Existing `contract/dist` is enough for API typecheck/tests.

## Not done yet (next pieces, one-by-one)

1. `docker-compose.yml` / proof-server wiring
2. Real Midnight client wired to compiled contract (after deploy handoff)
3. Full Compact circuit transition tests (simulator / proof path)
4. Deploy (deferred — last)

## Blockers

- None for API typecheck/tests on this branch.
- Real deploy / Preprod still blocked on funded wallet + proof server + Docker.
- Atharv frontend lives on unmerged feature branches; consume `@latch/api` exports when ready.

## Handoff notes for Atharv

- Import from `@latch/api`: types, `MockMoatClient`, commitment helpers, stealth helpers.
- Demo mode: `new MockMoatClient()` — label clearly as demo fixtures, not on-chain.
- Real mode: `createRealMoatClient(factory, session)` throws `CoreHandoffRequiredError` until Ashiha supplies a verified factory (contract address, providers, amount units).
- After successful `authorizeSpend`, local private state must call `advanceSpendStateAfterAuthorization` (mock already does this).
- Circuits available on contract side: `createCapability`, `authorizeSpend`, `revokeCapability`.
