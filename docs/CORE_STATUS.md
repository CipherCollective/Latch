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
| Midnight.js (not wired yet) | support matrix lists 4.1.1 — deferred to real-client branch |

## Midnight skills

Command run from repository root:

```text
npx skills add Kali-Decoder/Midnight-skills
```

Result: **30 skills installed** under `.agents/skills/` (gitignored). Relevant skills inspected for this branch: `compact`, `example-counter`, `midnight-environment-setup`.

## Branch

- Prior: `feat/ashiha/authorize-spend` — this work depends on it until merged to `main`.
- Active branch: `feat/ashiha/revoke-capability`
- Ownership: `contract/**`, `docs/CORE_STATUS.md`
- Did **not** edit `web/**`.

## Deliverable — revokeCapability

| Path | Role |
| --- | --- |
| `contract/src/moat.compact` | `createCapability` + `authorizeSpend` + `revokeCapability` |

### `revokeCapability` behaviour

Public circuit arg: `capabilityId` (private until disclosed; same model as authorizeSpend).

Checks (generic `"revocation rejected"` messages):

- capability exists and is not already revoked
- `hashOwner(ownerSecret)` opens stored `ownerCommitment`
- `hashCapabilityId(ownerSecret, policySalt)` matches the capability ID

On success: overwrite ledger entry with `revoked=true` (policy/spend/owner commitments unchanged).

`authorizeSpend` already rejects revoked capabilities via `assert(!record.revoked, ...)`.

### Compile evidence (revokeCapability)

```bash
cd "$(git rev-parse --show-toplevel)/contract"
compact compile src/moat.compact src/managed/moat
npm run typecheck --workspace @latch/contract
```

Result: **exit 0** — circuits `createCapability`, `authorizeSpend`, `revokeCapability` (toolchain **0.31.1**).

### Review follow-ups (PR #16)

- `ensure-managed` regenerates bindings when `moat.compact` is newer than managed output (not only when missing).
- Removed `maxUses * perTxLimit <= budget` from `createCapability` (valid policies may exhaust budget before maxUses).
- `authorizeSpend` preserves `record.revoked` on spend-state updates.
- Witness tests import `./witnesses.js` and cover revoke openings (`ownerSecret` / `policySalt`).

## Not done yet (next pieces, one-by-one)

1. `api/**` TypeScript client + mock client + stealth module
2. `docker-compose.yml` / proof-server wiring
3. Full Compact circuit transition tests (simulator / proof path)

## Blockers

- None for compile/typecheck of `revokeCapability`.
- Branch depends on unmerged `feat/ashiha/authorize-spend` (and its predecessors) until those land on `main`.
- Real deploy / Preprod still blocked on funded wallet + proof server.
- Atharv frontend lives on unmerged feature branches; this branch only adds `contract/**`.

## Handoff notes for Atharv

- Install Compact inside WSL, then `compact update 0.31.1`.
- From repo root: `cd "$(git rev-parse --show-toplevel)/contract"` then compile, or use `npm run compact` / `npm run build --workspace @latch/contract`.
- Generated bindings are under `contract/src/managed/moat/` (gitignored); run `npm run compact` (or full `build`) after clone so `dist/managed` is present.
- Circuits available: `createCapability`, `authorizeSpend`, `revokeCapability`.
- After a successful `authorizeSpend` transaction, call `advanceSpendStateAfterAuthorization(privateState)` before the next spend so local openings match the new ledger spend-state commitment.
