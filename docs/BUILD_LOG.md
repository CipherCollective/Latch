# Latch Build Log

This log records work performed in the Atharv/Codex workstream. It must not contain secrets, wallet material, private witnesses, or private policy payloads.

## 2026-07-18 - Specification baseline

- **Branch:** `feat/atharv/spec`
- **Scope:** Convert the Atharv/Codex PDF into the Latch implementation specification.
- **Required setup:** Ran `npx skills add Kali-Decoder/Midnight-skills` from the repository root. Installation succeeded and reported 30 installed local skills. Only the relevant read-only guidance was inspected for this specification: React wallet connector, Midnight TypeScript/provider integration, and the disabled Dynamic wallet skill.
- **Official documentation check:** Verified the current React wallet connector and DApp Connector guidance on `docs.midnight.network`.
- **Package metadata check:** `@midnight-ntwrk/dapp-connector-api` = `4.0.1`; `@midnight-ntwrk/midnight-js-types` = `4.1.1`; `@midnight-ntwrk/midnight-js-contracts` = `4.1.1` at the time of the check. Implementation must still use the merged scaffold/lockfile as its version authority.
- **Deliverable:** `docs/LATCH_ATHARV_BUILD_SPEC.md`.
- **Validation:** Requirement traceability checks passed; Markdown code fences are balanced; `git diff --check` passed.
- **Blockers:** None for specification. Real integration facts remain an Ashiha handoff dependency and are explicitly marked `[CORE FACT REQUIRED]` in downstream documentation.
- **Git handoff:** Committed the specification on `feat/atharv/spec` and pushed the branch to `origin` without touching `main`.
- **PR handoff:** Automatic PR creation was unavailable: GitHub CLI was not installed and the configured GitHub connector returned repository `404`. Use `https://github.com/CipherCollective/Latch/pull/new/feat/atharv/spec` to open the prepared review PR.

## 2026-07-18 - UI shell

- **Branch:** `feat/atharv/ui-shell`
- **Scope:** React/Vite workspace scaffold, accessible landing page, Latch visual system, deterministic-demo and wallet entry choices, architecture section, error boundary, and initial component tests.
- **Dependencies:** Exact frontend versions locked in `package-lock.json`; `npm install` reported zero known vulnerabilities.
- **Validation:** `npm run typecheck`, `npm run test:run` (3 tests), `npm run build`, desktop screenshot at 1440x900, and mobile screenshot at 390x844 passed.
- **Accessibility:** Added skip navigation, semantic landmarks, native controls, visible focus treatment, live-region status updates, reduced-motion behavior, and responsive reflow. The bundled static scanner's app-level findings were reviewed; per-file landmark findings and the dark decorative grid warning are scanner false positives, while its explicit live-region findings were fixed.
- **Truthfulness:** Demo mode is labeled as a deterministic fixture and wallet mode never claims a connection before confirmation.

## 2026-07-18 - Private capability flow

- **Branch:** `feat/atharv/capability-flow`
- **Scope:** Normalized `MoatClient` boundary, exact decimal-string helpers, canonical JSON, domain-separated Web Crypto fixture hashing, deterministic capability lifecycle, accessible policy builder, owner dashboard, commitment copy controls, and confirmed demo revocation.
- **Privacy:** The builder explicitly separates owner-only readable policy values from the opaque capability identifier and commitments exposed by the demo fixture. No wallet address or fabricated chain data is rendered.
- **Truthfulness:** Every create/revoke result uses `kind: demo-fixture` and `networkId: demo`; no transaction hash, explorer URL, connected-wallet state, or real-proof claim is generated.
- **Validation:** `npm run typecheck`, `npm run test:run` (25 tests), `npm run build`, and `git diff --check` passed. Browser verification at 1440px, 390px, and 320px found zero application console errors and zero horizontal overflow at 320px.
- **Evidence:** `docs/screenshots/capability-policy-desktop.png`, `docs/screenshots/capability-dashboard-desktop.png`, and `docs/screenshots/capability-dashboard-mobile.png`.
- **Accessibility:** Native labeled fields, associated recoverable errors, invalid-state gating, focus transfer to new screen headings, live regions, non-color status labels, 44px+ controls, light-surface focus contrast, reduced-motion behavior, and full-value copy with shortened visual hashes were verified.
- **Blockers:** None for deterministic capability creation. Real capability submission remains dependent on verified core facts from the independently owned integration package.

## 2026-07-18 - Deterministic payment gate

- **Branch:** `feat/atharv/demo-flow`
- **Scope:** Fixed CodeShield approval and AlphaSignal rejection requests, serialized deterministic authorization engine, seven-step proof-client timeline, activity console, structured owner request dialog, exact state mutation, nullifier replay defense, one-time destination fixture, approved receipt, verification, private rejection explanations, and reset behavior.
- **State invariants:** The default approval changes uses `3 -> 2` and remaining budget `50 -> 38`. Rejection, replay, and post-revocation attempts do not mutate capability state or store receipts. Concurrent use of the same nonce serializes so only one request can commit.
- **Privacy:** Receipt clipboard JSON is built from a recursive explicit allowlist. Hostile runtime fixtures prove that injected policy, merchant, wallet, witness, rejection, and arbitrary nested values cannot cross the clipboard boundary.
- **Truthfulness:** Demo destinations use a non-Midnight `demo_dest_` prefix; demo receipts contain no transaction hash or explorer URL; visible copy calls every proof, receipt, destination, and revocation artifact a deterministic demo fixture rather than a chain fact.
- **Validation:** `npm run typecheck`, `npm run test:run` (47 tests), `npm run build`, and `git diff --check` passed. Browser verification exercised approval, receipt verification, rejection, mobile layout, and the full 320px path with zero application console errors and zero horizontal overflow.
- **Evidence:** `docs/screenshots/demo-approved-desktop.png`, `docs/screenshots/demo-rejected-desktop.png`, and `docs/screenshots/demo-approved-mobile.png`.
- **Accessibility:** Client-owned proof rows reserve vertical space and expose text/icon states, major results use polite live regions, the structured request dialog traps focus/Escape/restores focus, and actions remain native keyboard controls.
- **Blockers:** None for the deterministic path. Proof and transaction behavior in real mode still require the verified core-client handoff.

## 2026-07-18 - Public observer projection

- **Branch:** `feat/atharv/observer-mode`
- **Scope:** Owner/public view switch, strict observer DTO construction, validated opaque IDs and 32-byte commitments, aggregate-only proof state, generic public transcript, public capability dashboard, allowlisted receipt, verification, and clipboard serialization.
- **Structural privacy:** Owner and observer render different React subtrees. `ObserverWorkspace` accepts only `ObserverWorkspaceModel`; it never receives owner capability state, service/request objects, raw proof details, destination data, transaction metadata, private rejection codes, or owner event strings.
- **Side-channel controls:** Observer mode never renders client proof-step labels, positions, failure locations, safe-detail text, or per-step timing. An in-flight request takes precedence over receipt history, and every rejection reason produces the same aggregate model and exact public message.
- **Hostile input controls:** Public capability IDs and commitments are format-validated. Recursive tests inject private values into banned fields and nominally public leaves, proving malformed values fail closed rather than crossing the observer/clipboard boundary.
- **Validation:** `npm run typecheck`, `npm run test:run` (68 tests), `npm run build`, and `git diff --check` passed. App-level tests unmount an open owner dialog, switch during delayed proof callbacks, inspect MutationObserver snapshots, verify public clipboard keys, and cover approval, policy rejection, replay, verification, and revocation.
- **Browser evidence:** `docs/screenshots/observer-approved-desktop.png`, `docs/screenshots/observer-rejected-desktop.png`, and `docs/screenshots/observer-approved-mobile.png`. The full browser path produced zero application console errors and zero horizontal overflow at 320px.
- **Truthfulness boundary:** This toggle is a DOM/accessibility/clipboard projection, not user authentication or same-origin access control. The owner state remains in the same application session and Demo fixtures ship in the frontend bundle. A separately accessible public observer requires an independently authenticated/unauthenticated route and public-only data source after core handoff.
- **Core caveat:** Demo SHA-256 fixtures are deterministic and recomputable from known inputs. Real confidentiality depends on verified blinded commitments and core/ledger disclosure facts marked `[CORE FACT REQUIRED]`.

## 2026-07-18 - Secure Midnight wallet boundary

- **Branch:** `feat/atharv/wallet-adapter`.
- **Scope:** DApp Connector discovery, strict connector-version compatibility, explicit multi-wallet selection, Preprod connection confirmation, provider-configuration validation, focus/visibility revalidation, recoverable connection UI, and the fail-closed real `MoatClient` factory seam.
- **Least authority:** The connector hints and calls only `getConnectionStatus` and `getConfiguration`. It does not request an address, balance, key, history, signing, transfer, or transaction method.
- **Injected-data hardening:** The wallet registry is treated as hostile. Enumeration and property access fail closed; wallet names are normalized, bounded, and rendered as text; icons are capped raster data URLs only; duplicate names receive generated opaque IDs; endpoint configuration is validated and copied into a plain in-memory object; wallet error reasons, stacks, provider payloads, and endpoint values never enter public copy, DOM, clipboard, storage, or logs.
- **Connection invariants:** Only `preprod` is callable. Status and configuration network IDs must agree, status is checked again after configuration to close a switch/disconnect race, and connected sessions are revalidated after focus/visibility recovery. Late responses after Back or Demo navigation are ignored, and rapid duplicate activation produces one connection request.
- **Truthfulness:** A confirmed wallet connection is not represented as a working Compact/core integration. The connected screen states that no capability or transaction was submitted, exposes no real action, and the real client seam throws a fixed safe error until an explicitly supplied verified factory is available. Landing and demo proof copy were tightened to describe deterministic fixtures rather than unverified on-chain behavior.
- **Tests:** `npm run typecheck`, the full Vitest suite, `npm run build`, `npm audit --audit-level=low`, and `git diff --check` pass. Focused tests cover hostile registries/getters/configuration, strict semver, selection, receiver binding, permission minimization, network races, error redaction, duplicate/stale operations, App badge state, focus restoration, and DOM non-disclosure.
- **Accessibility:** Desktop and mobile browser flows use native controls, explicit fieldset/radio semantics, visible focus, status/live regions, heading focus transfer, 44px+ targets, reduced-motion behavior, and AA text contrast. The packaged static scanner first rejected its documented flags with `invalid choice: 'table'` and `unrecognized arguments: --fg --bg`; it was rerun with its actual CLI. Component/test-file landmark findings and a literal hostile `<img>` test string were false positives. Axe Core 4.12.1 then reported zero WCAG A/AA violations across landing, missing-wallet, connected-wallet, approved-owner, and approved-observer DOM states.
- **Browser evidence:** `docs/screenshots/wallet-missing-desktop.png`, `docs/screenshots/wallet-connected-desktop.png`, and `docs/screenshots/wallet-connected-mobile.png`. Browser automation reported zero console errors and zero horizontal overflow at 320px for both demo and wallet paths.
- **Dependency audit:** Exact `semver` and type packages are locked; `npm audit` reports zero known vulnerabilities.
- **Core blocker:** The independently owned core package/import, client constructor, inputs/outputs, amount units, disclosure classification, proof/receipt semantics, deployed address, and evidence have not been supplied. No `api/**` or `contract/**` path was edited and no chain fact was inferred.
- **PR handoff:** [#6 - `[STACK 6] Secure Midnight wallet boundary`](https://github.com/CipherCollective/Latch/pull/6), targeting `feat/atharv/observer-mode`; no self-merge.

## 2026-07-18 - Pull-request reconciliation

This append-only correction supersedes the earlier specification note that automatic PR creation was unavailable. GitHub CLI access became available later in the same build session; the earlier event record is retained above rather than rewritten.

- **Stack 1:** [#1 - `[STACK 1] Specify the Atharv Latch build`](https://github.com/CipherCollective/Latch/pull/1), `feat/atharv/spec`.
- **Stack 2:** [#2 - `[STACK 2] Build the accessible Latch UI shell`](https://github.com/CipherCollective/Latch/pull/2), `feat/atharv/ui-shell` targeting stack 1.
- **Stack 3:** [#3 - `[STACK 3] Build the private capability flow`](https://github.com/CipherCollective/Latch/pull/3), `feat/atharv/capability-flow` targeting stack 2.
- **Stack 4:** [#4 - `[STACK 4] Build the deterministic payment gate`](https://github.com/CipherCollective/Latch/pull/4), `feat/atharv/demo-flow` targeting stack 3.
- **Stack 5:** [#5 - `[STACK 5] Isolate the public observer projection`](https://github.com/CipherCollective/Latch/pull/5), `feat/atharv/observer-mode` targeting stack 4.
- **Stack 6:** [#6 - `[STACK 6] Secure Midnight wallet boundary`](https://github.com/CipherCollective/Latch/pull/6), `feat/atharv/wallet-adapter` targeting stack 5.

The corrected observer deployment requirement is: a genuine observer needs a separately served public-only route or origin backed by a public-only data source; owner actions need their own authentication. The current same-session toggle remains only a DOM/accessibility/clipboard projection.

## 2026-07-18 - Truthful release boundary

- **Branch:** `fix/atharv/release-claims`.
- **Scope:** Replace unsupported chain/proof demo labels with explicit local-fixture copy; suppress React's caught, uncaught, and recoverable raw-error callbacks; add fixed recovery copy; add Vercel anti-framing, MIME, and referrer headers; pin the supported runtime to Node `22.x`; and ship the complete runtime third-party notice in the static distribution.
- **Evidence hardening:** Stale landing screenshots were recaptured from the corrected application. Owner and observer progress, receipt, and disclosure labels now distinguish a local deterministic model from a Compact proof or ledger event.
- **Security:** A concurrently added, uncommitted ngrok `allowedHosts` override was isolated in a local stash and excluded from every branch and PR. Official Vite guidance was checked before exclusion. No secret, endpoint, wallet payload, `api/**`, or `contract/**` change is present.
- **Validation:** `npm run typecheck`, `npm run test:run` (129 tests in 17 files), `npm run build`, `npm audit --audit-level=low`, `git diff --check`, Axe Core 4.12.1, browser console inspection, 320px overflow checks, and an independent staged-diff audit passed.
- **PR handoff:** [#7 - `[STACK 7] Harden truthful release boundary`](https://github.com/CipherCollective/Latch/pull/7), targeting `feat/atharv/wallet-adapter`; no self-merge.

## 2026-07-18 - Automated release gates

- **Branch:** `ci/atharv/release-gates`.
- **Scope:** Least-privilege GitHub Actions checks for exact lockfile install on Node 22.12.0, typecheck, full tests, production build, low-severity dependency audit, installed-tree integrity, high-confidence credential patterns, and clean tracked output.
- **Supply-chain controls:** All actions are pinned to full commit SHAs, checkout credentials are not persisted, workflow permissions are `contents: read`, and jobs have explicit timeouts and concurrency cancellation.
- **Repository-setting limitation:** GitHub's dependency-review action was exercised on the pull request and reported that dependency graph/Advanced Security is not enabled for this repository. The unsupported job was removed rather than represented as passing; `npm audit --audit-level=low`, `npm ls --all`, and lockfile-only installation remain enforced. Repository maintainers can add dependency review after enabling the required setting.
- **Local validation:** Workflow YAML parses, action tag SHAs were resolved from the official repositories, and the same application commands pass locally.
- **PR handoff:** [#8 - `[STACK 8] Enforce automated release gates`](https://github.com/CipherCollective/Latch/pull/8), targeting `fix/atharv/release-claims`; no self-merge.

## 2026-07-18 - Live review and integration reconciliation

- **Live PR state:** PRs #1-#6 are merged; PRs #7-#8 are open. PR #2 was merged by its author, Atharv, so the build does not claim universal compliance with the no-self-merge process rule. The other completed stack PRs were merged by Ashiha.
- **Reviewer fixes incorporated:** Ashiha's `6e83b9c` activity-control fix and `8d738fc` owner-clipboard transaction enum allowlist were reconciled onto `fix/atharv/release-claims` as `50db46b` and `83917a2`. A dedicated runtime-enum regression test was added as `aaa177b`.
- **Resulting invariants:** Authorization buttons remain disabled during capability lifecycle operations, and owner receipt serialization rejects unknown runtime `tx.kind` and `tx.networkId` values instead of casting them through the type boundary.
- **Validation delta:** The reconciled suite reports 130 passing tests in 17 files. CI stack #8 was merged forward with the fixes and reruns the full release gate.
- **Default-branch warning:** The earlier stacked merges landed child PRs into feature branches that had already been merged; `main` currently contains the specification but not the runnable web application. A final `release/atharv/integration` PR from the verified stack tip to `main` is required. Until a human merges it, README clean-clone instructions explicitly switch to the published docs stack branch.

## 2026-07-18 - Release documentation and evidence

- **Branch:** `feat/atharv/docs`.
- **Scope:** Status-safe README, architecture and state/data-flow reference, privacy model, timed demo script, Devpost draft, operational submission checklist, comments-only environment template, search/social metadata, and refreshed responsive evidence captures.
- **Truthfulness:** Documentation distinguishes implemented deterministic behavior, the hardened Preprod wallet connector boundary, pending core facts, pending deployment facts, and human-only submission facts. It makes no Compact, proof, transaction, address, explorer, deployment, authentication, production, or audit claim without evidence.
- **Audit corrections:** The diagrams now show that a wallet session does not invoke `createRealMoatClient`; reset controls match the UI; mock reset/recommit semantics match memory behavior; owner-versus-observer rejection copy is explicit; clipboard validation claims match the serializer; and the observer route requirement no longer conflates authentication with a public-only data source.
- **Evidence:** Landing, capability, approval, rejection, replay, observer, and wallet-boundary captures were regenerated from the release-hardened UI. PNG metadata inspection found only image chunks and no embedded text/path metadata.
- **Validation:** Markdownlint passes with line length disabled; local links and images resolve; fences, tables, JSON, Mermaid structure, UTF-8, placeholders, versions, and section order pass scripted checks. `npm run typecheck`, `npm run test:run` (130 tests in 17 files), `npm run build`, `npm audit --audit-level=low`, and `git diff --check` pass. Axe Core 4.12.1 reports zero WCAG A/AA violations on release-critical states; automated browser runs report zero application console errors and zero horizontal overflow at 320px.
- **Open facts:** Real core evidence remains `[CORE FACT REQUIRED]`; public deployment smoke remains `[DEPLOYMENT FACT REQUIRED]`; final video, Devpost/team fields, human approvals, merges, and submission remain `[SUBMISSION FACT REQUIRED]`.
- **PR handoff:** Pending final documentation verification; the resulting URL will be appended without rewriting this event.
