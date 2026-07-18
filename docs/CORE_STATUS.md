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

- Prior: `feat/ashiha/compact-bootstrap` (createCapability openings) — this work depends on it until merged to `main`.
- Active branch: `feat/ashiha/authorize-spend`
- Ownership: `contract/**`, `docs/CORE_STATUS.md`
- Did **not** edit `web/**`.

## Deliverable — authorizeSpend

| Path | Role |
| --- | --- |
| `contract/src/moat.compact` | `createCapability` + `authorizeSpend` |
| `contract/src/witnesses.ts` | Policy, spend-state, and request openings |

### `authorizeSpend` behaviour

Public circuit arg: `capabilityId`.

Private witnesses (additional): `agentSecret`, `amount`, `requestCategoryHash`, `requestNonce`, `oneTimeDestinationHash`, `newStateSalt`.

Checks (all observer assert messages are generic `"authorization rejected"`):

- capability exists and is not revoked
- derived ID from owner openings matches the public arg
- `hashAgentKey(agentSecret) == agentKeyHash` (agent bound into policy)
- policy / current spend-state openings match ledger commitments
- `amount > 0`, `amount <= perTxLimit`, `spentSoFar + amount <= totalBudget`
- request category equals allowed category
- `useCount < maxUses`
- nullifier unused

Domain hashes: `MOAT_REQUEST_V1`, `MOAT_NULLIFIER_V1`, `MOAT_RECEIPT_V1`, plus `MOAT_AGENT_KEY_V1` for agent binding.

On success:

- insert disclosed nullifier into `usedNullifiers`
- insert disclosed receipt into `verifiedReceipts`
- update capability `spendStateCommitment` to the new state (`spent+amount`, `useCount+1`, `newStateSalt`)

### Compile evidence (authorizeSpend)

```bash
cd "$(git rev-parse --show-toplevel)/contract"
# Midnight Compact on PATH (WSL on Windows hosts)
compact compile src/moat.compact src/managed/moat
npm run typecheck --workspace @latch/contract
```

Result: **exit 0** — circuits `createCapability` + `authorizeSpend` (toolchain **0.31.1**). Typecheck pass.

## Not done yet (next pieces, one-by-one)

1. `revokeCapability`
2. `api/**` TypeScript client + mock client + stealth module
3. `docker-compose.yml` / proof-server wiring
4. Contract tests from the brief checklist

## Blockers

- None for compile/typecheck of `authorizeSpend`.
- Branch depends on unmerged `feat/ashiha/compact-bootstrap` base until that PR lands on `main`.
- Real deploy / Preprod still blocked on funded wallet + proof server.
- Atharv frontend lives on unmerged feature branches; this branch only adds `contract/**`.

## Handoff notes for Atharv

- Install Compact inside WSL, then `compact update 0.31.1`.
- From repo root: `cd "$(git rev-parse --show-toplevel)/contract"` then compile, or use `npm run compact` / `npm run build --workspace @latch/contract`.
- Generated bindings are under `contract/src/managed/moat/` (gitignored); run `npm run compact` (or full `build`) after clone so `dist/managed` is present.
- Public authorize surface today: capability id arg + nullifier/receipt ledger sets + updated spend-state commitment. Request commitment is bound inside the receipt hash (not a separate ledger field yet).
