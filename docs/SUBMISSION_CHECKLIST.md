# Latch submission checklist

This is the operational release gate for the Atharv/Codex workstream. A checked
item means the named evidence was inspected, not merely planned. Keep unknown
external facts as placeholders and never substitute demo fixtures for Midnight
evidence.

## Current implementation status

- The deterministic browser demo implements create, approve, verify, reject,
  replay, observer projection, revoke, and reset.
- The wallet boundary can discover and confirm a compatible Preprod connector.
- Real capability and transaction actions remain fail-closed because the
  verified core handoff has not been supplied.
- Demo commitments, proofs, receipts, destinations, and revocations are local
  fixtures and are not ledger facts.

## Repository and review gates

- [x] No work was pushed directly to `main` or `master`.
- [x] `contract/**` was not edited by the Atharv/Codex workstream.
- [x] No competing `api/**` implementation was created.
- [x] Completed feature work through stack 12 is split into stacked review
  branches and pull requests.
- [ ] Every merge satisfied the no-self-merge rule. PRs #2 and #7 were merged
  by their author, Atharv; both process exceptions are recorded and must not be
  represented as compliant.
- [ ] Every stacked PR has both required human approvals.
- [ ] PRs are merged bottom-up without squashing away required evidence.
- [ ] The final default branch passes the same checks recorded below.
- [ ] The public repository opens in an unauthenticated/incognito browser.

| Stack | Branch | Pull request | Review state |
| --- | --- | --- | --- |
| 1 | `feat/atharv/spec` | [#1](https://github.com/CipherCollective/Latch/pull/1) | Merged |
| 2 | `feat/atharv/ui-shell` | [#2](https://github.com/CipherCollective/Latch/pull/2) | Merged by PR author; process exception |
| 3 | `feat/atharv/capability-flow` | [#3](https://github.com/CipherCollective/Latch/pull/3) | Merged |
| 4 | `feat/atharv/demo-flow` | [#4](https://github.com/CipherCollective/Latch/pull/4) | Merged |
| 5 | `feat/atharv/observer-mode` | [#5](https://github.com/CipherCollective/Latch/pull/5) | Merged |
| 6 | `feat/atharv/wallet-adapter` | [#6](https://github.com/CipherCollective/Latch/pull/6) | Merged |
| 7 | `fix/atharv/release-claims` | [#7](https://github.com/CipherCollective/Latch/pull/7) | Merged by PR author; process exception |
| 8 | `ci/atharv/release-gates` | [#8](https://github.com/CipherCollective/Latch/pull/8) | Open — human review required; CI passing |
| 9 | `feat/atharv/docs` | [#9](https://github.com/CipherCollective/Latch/pull/9) | Open — human review required |
| 10 | `deploy/atharv/public-demo` | [#10](https://github.com/CipherCollective/Latch/pull/10) | Open — human review required; public host blocked |
| 11 | `fix/atharv/node-runtime` | [#11](https://github.com/CipherCollective/Latch/pull/11) | Open — human review required; clean-clone runtime correction |
| 12 | `fix/atharv/wallet-focus-stability` | [#12](https://github.com/CipherCollective/Latch/pull/12) | Open — human review required; focus revalidation race correction |
| 13 | `release/atharv/integration` | [#13](https://github.com/CipherCollective/Latch/pull/13) | Open against `main`; non-author human review and merge required |

## Automated verification

Run from a clean checkout with Node.js `22.13.0` or newer in the supported
`22.x` release line:

```bash
npm ci
npm run typecheck
npm run test:run
npm run build
npm audit --audit-level=low
git diff --check
```

- [x] `npm ci` succeeds using the committed lockfile.
- [x] TypeScript reports no errors.
- [x] Every Vitest file and test passes.
- [x] Vite produces `web/dist/index.html` and hashed assets.
- [x] The dependency audit reports no known vulnerabilities.
- [x] The verified checkout remains clean after checks.
- [x] Axe reports no WCAG A/AA violations on all release-critical states.
- [x] Browser automation reports no application console errors.
- [x] Browser automation reports no horizontal overflow at 320px.

Record final command output and commit identifiers in
[`BUILD_LOG.md`](./BUILD_LOG.md); do not paste credentials, wallet payloads, or
private policy data.

## Deterministic demo smoke test

Start with a clean refresh and verify the `Demo mode` badge remains visible on
every workflow screen.

- [x] The default policy shows limit `20`, budget `50`, uses `3`, and category
  `developer-tools`.
- [x] Capability creation is labeled as a deterministic fixture.
- [x] CodeShield requests `12` and approves.
- [x] Uses change from `3` to `2` and remaining budget changes from `50` to
  `38` exactly.
- [x] The receipt and destination are explicitly labeled as fixtures.
- [x] Fixture receipt verification passes.
- [x] AlphaSignal requests `30` in `trading-data` and rejects.
- [x] Rejection leaves budget, uses, receipts, and nullifiers unchanged.
- [x] Replaying CodeShield produces no second receipt and no state mutation.
- [x] Public Observer shows the same generic message for policy rejection and
  replay rejection.
- [x] Public Observer DOM and copied JSON contain no owner policy, request,
  merchant, destination, private reason, wallet, or witness values.
- [x] Revocation requires confirmation and blocks later authorization.
- [x] Reset and clean refresh restore the deterministic initial state.

## Wallet boundary smoke test

- [x] No-wallet state makes no connection claim and preserves Demo access.
- [x] An incompatible connector cannot be selected.
- [x] Multiple compatible connectors require an explicit radio selection.
- [x] A pending wallet request keeps stable layout and remains cancellable via
  Back or Demo.
- [x] Declined, inaccessible, wrong-network, and stale-session states use fixed
  public copy with retry paths.
- [x] `Preprod · Wallet connected` appears only after status, configuration,
  and post-configuration status agree.
- [x] Returning focus after a disconnect/network switch clears the connected
  badge.
- [x] No address, balance, key, history, signing, transfer, or transaction
  permission is requested.
- [x] Wallet configuration, endpoints, raw reasons, and provider objects never
  appear in DOM, clipboard, storage, or logs.
- [x] No real capability or transaction action is exposed without the verified
  core factory.

## Public deployment gate

- [x] Deployment is built from the documented stack tip.
- [x] No environment variables or secrets are required for Demo mode.
- [x] The exact committed artifact is reproducible under Node.js `22.13.0`.
- [x] The generated static assets load with no `404` responses when hosted at
  the production `/Latch/` base path locally.
- [x] Create, approve, verify, reject, replay, observer, revoke, and reset pass
  on the exact locally hosted artifact.
- [x] Desktop `1440x900`, mobile `390x844`, and narrow `320x720` are inspected
  on that artifact.
- [x] Browser console, network failures, overflow, focus, Demo labeling, Axe,
  missing-wallet, and compatible-wallet-fixture states were rechecked locally.
- [x] No fake transaction hash, explorer link, address, block, proof, or
  deployment claim appears.
- [ ] The public URL is [DEPLOYMENT FACT REQUIRED].
- [ ] The URL opens without authentication in a fresh incognito session.
- [ ] Hosted-origin assets and `THIRD_PARTY_NOTICES.txt` load without an error
  response.
- [ ] The complete local matrix is repeated on the hosted origin.
- [ ] Response headers match the approved host's security policy.

The exact GitHub Pages HTTP `422` blocker and all local artifact evidence are
recorded in [`DEPLOYMENT.md`](./DEPLOYMENT.md). No client-side deep route exists
in this release; if one is introduced, add and verify a refresh fallback before
checking the hosted-origin gate.

## Evidence bundle

- [x] Capability policy and dashboard screenshots exist under
  `docs/screenshots/`.
- [x] Approved and rejected demo screenshots exist.
- [x] Owner/Public Observer comparison screenshots exist.
- [x] Missing and connected wallet-boundary screenshots exist; the connected
  fixture screenshot does not claim core availability.
- [x] Replay provenance is paired: `demo-replay-rejected-desktop.png` shows the
  owner replay action and local consumed-authorization explanation, while
  `observer-replay-rejected-desktop.png` shows the generic public rejection
  with no receipt or destination. The observer policy/replay rejection images
  are intentionally byte-identical because the public projection is
  indistinguishable; the owner capture establishes which action produced the
  paired observer frame.
- [ ] Verified core policy-creation evidence supplied by Ashiha.
- [ ] Verified allow/reject/replay core test output supplied by Ashiha.
- [ ] Any real transaction, explorer, proof, circuit, or deployment screenshot
  independently matched to its source output.

Core evidence remains **[CORE FACT REQUIRED]**. Do not check those items from
the deterministic browser demo.

## Video gate

- [ ] Recording follows [`DEMO_SCRIPT.md`](./DEMO_SCRIPT.md).
- [ ] Final video names the Midnight Hackathon, Latch, and both team members.
- [ ] Runtime is 2:00 or less; target is 1:50.
- [ ] Spoken narration calls the current flow a deterministic demo/fixture.
- [ ] The recording does not narrate a proof-step fixture as a real Midnight
  proof.
- [ ] Owner/Public Observer disclosure boundary is shown.
- [ ] Audio is intelligible and UI text is readable at the published quality.
- [ ] Video URL is public and opens incognito: [SUBMISSION FACT REQUIRED].

## Devpost gate

- [ ] Both team members are added.
- [ ] DeFi track is selected if only one category is permitted.
- [ ] Copy is finalized from [`DEVPOST_COPY.md`](./DEVPOST_COPY.md).
- [ ] Repository, deployment, and video URLs are public and rechecked.
- [ ] “How Midnight is used” contains only connector facts and independently
  verified core evidence.
- [ ] No unsupported statistics, gas numbers, performance numbers, or privacy
  guarantees are included.
- [ ] Submission URL is recorded: [SUBMISSION FACT REQUIRED].

## Final claim audit

The submission must not claim any of the following without independent core
evidence:

- a deployed or compiling Compact contract;
- a real zero-knowledge proof, capability, receipt, destination, nullifier,
  revocation, payment, or settlement;
- a transaction hash, address, block, gas cost, explorer URL, or proof time;
- exact ledger-private fields, anonymity, untraceability, or transaction-graph
  privacy;
- production readiness, formal verification, security audit, custody, or
  mainnet support;
- an external LLM or AI system performing cryptography.

- [ ] README claims match the final merged implementation.
- [ ] Devpost claims match README and the video.
- [ ] Screenshot labels match the environment that produced them.
- [ ] All `[CORE FACT REQUIRED]`, `[DEPLOYMENT FACT REQUIRED]`, and
  `[SUBMISSION FACT REQUIRED]` markers are either retained honestly or replaced
  with independently verified values.

## Human sign-off

| Gate | Owner | Evidence/link | Signed |
| --- | --- | --- | --- |
| Atharv/Codex frontend and docs | Atharv | PR stack and build log | [ ] |
| Core implementation facts | Ashiha | [CORE FACT REQUIRED] | [ ] |
| Privacy/claim review | Atharv + Ashiha | Final README/Devpost/video | [ ] |
| Public deployment smoke | Atharv | [DEPLOYMENT FACT REQUIRED] | [ ] |
| Final submission | Atharv + Ashiha | [SUBMISSION FACT REQUIRED] | [ ] |
