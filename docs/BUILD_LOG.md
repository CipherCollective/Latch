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
