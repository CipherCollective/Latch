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

- Created from updated `main` (`git fetch`, `git switch main`, `git pull --ff-only`).
- Active branch: `feat/ashiha/compact-bootstrap`
- Ownership this branch: `contract/**`, root `package.json` / `.gitignore`, `docs/CORE_STATUS.md`
- Did **not** edit `web/**`.

## Deliverable — Compact bootstrap

Smallest compiling MOAT-shaped contract:

| Path | Role |
| --- | --- |
| `contract/src/moat.compact` | Ledger + `createCapability` with openings |
| `contract/src/witnesses.ts` | Full private policy + spend-state openings |
| `contract/src/index.ts` | Re-exports managed contract + witnesses |
| `contract/package.json` | `@latch/contract` workspace package |
| `package.json` | Root workspace (`contract` only on this branch) |

### Public ledger

- `capabilities: Map<Bytes<32>, CapabilityPublic>`
- `usedNullifiers: Set<Bytes<32>>` (consumers deferred to `authorizeSpend`)
- `verifiedReceipts: Set<Bytes<32>>` (consumers deferred to `authorizeSpend`)
- `capabilityCount: Counter`

### `createCapability` behaviour (piece 2 — openings)

Private witnesses: `ownerSecret`, `policySalt`, `agentKeyHash`, `perTransactionLimit`, `totalBudget`, `maxUses`, `allowedCategoryHash`, `stateSalt`, `spentSoFar`, `useCount`.

Domain hashes:

- `MOAT_CAPABILITY_ID_V1` → `capabilityId`
- `MOAT_OWNER_V1` → `ownerCommitment`
- `MOAT_POLICY_V1` → `policyCommitment` (capabilityId, agentKeyHash, limits, budget, maxUses, category, policySalt)
- `MOAT_SPEND_STATE_V1` → `spendStateCommitment` (capabilityId, spentSoFar, useCount, stateSalt)

Circuit asserts:

- `perTxLimit > 0`, `budget > 0`, `maxUses > 0`, `perTxLimit <= budget`
- initial spend-state is `spentSoFar == 0` and `useCount == 0`
- recomputed policy / spend-state commitments equal the submitted public args
- capability ID is unused, then inserts disclosed commitments + `revoked=false`

Numeric fields are cast to `Bytes<32>` inside the hash vectors so Compact keeps a homogeneous `persistentHash`.

### Compile evidence

```bash
# From repository root (WSL Ubuntu recommended for Compact on Windows hosts)
export PATH="$HOME/.local/bin:/usr/local/bin:$PATH"
cd "$(git rev-parse --show-toplevel)/contract"
compact compile src/moat.compact src/managed/moat
```

Or from the repo root after Compact is on `PATH`:

```bash
npm run compact
```

Package build (compile + TypeScript + copy managed bindings into `dist/`):

```bash
npm run build --workspace @latch/contract
```

Result: **exit 0** — circuit `createCapability` (Compact language **0.23.0** / toolchain **0.31.1** / runtime **0.16.0**).

Also passed: `npm run typecheck:contract`.

Generated under `contract/src/managed/moat/` (gitignored): `compiler/contract-info.json`, `contract/index.{js,d.ts}`, prover/verifier keys, zkir artifacts.

`npm run build` copies `src/managed` → `dist/managed` via `contract/scripts/copy-managed.mjs` so `@latch/contract` consumers can resolve `./managed/moat/contract/index.js` from the published `dist/` tree.

Compiler note: ledger `member`/`insert` on a witness-derived ID requires explicit `disclose(capabilityId)`.

## Not done yet (next pieces, one-by-one)

1. `authorizeSpend` circuit + nullifier / receipt registries
2. `revokeCapability`
3. `api/**` TypeScript client + mock client + stealth module
4. `docker-compose.yml` / proof-server wiring
5. Contract tests from the brief checklist

## Blockers

- None for compile/typecheck of `createCapability` openings.
- Real deploy / Preprod still blocked on funded wallet + proof server; not started this branch.
- Atharv frontend lives on unmerged feature branches; this branch intentionally starts from `main` and only adds `contract/**`.

## Handoff notes for Atharv

- Install Compact inside WSL, then `compact update 0.31.1`.
- From repo root: `cd "$(git rev-parse --show-toplevel)/contract"` then compile, or use `npm run compact` / `npm run build --workspace @latch/contract`.
- Generated bindings are under `contract/src/managed/moat/` (gitignored); run `npm run compact` (or full `build`) after clone so `dist/managed` is present.
