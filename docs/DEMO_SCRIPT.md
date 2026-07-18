# Latch Demo Script

## 1. Recording goal

Record a clear **1 minute 50 second** product demo. The **hard maximum is 2:00**, including title cards, pauses, and the final frame.

This script demonstrates the deterministic local frontend flow. It must not imply that the fixture proof, receipt, destination, verification, revocation, or replay check is a real Midnight proof or transaction.

Required opening facts:

- event: Midnight Hackathon;
- product: Latch;
- team: Atharv and Ashiha; and
- promise: every payment must pass a private gate.

## 2. Preflight

### 2.1 Verify the build

From the repository root, run:

```powershell
npm ci
npm run typecheck
npm run test:run
npm run build
```

Do not record a take if any check fails. Do not edit fixture values to force a desired result.

### 2.2 Prepare the browser

1. Start the verified local or deployed build.
2. Use a clean browser window at 100% zoom and at least 1440 x 900 resolution.
3. Hide bookmarks, personal tabs, extension popups, wallet addresses, notifications, and operating-system account details.
4. Confirm the landing page shows `Every payment must pass a private gate.`
5. Confirm `Use deterministic demo` is visible. Wallet connection is not part of this take.
6. Hard-refresh once. The take must begin on the landing page with no prior capability visible.
7. Complete one silent rehearsal and confirm the approved, rejected, replay, observer, and reset paths work.
8. Hard-refresh again before the recorded take.
9. Put the pointer near the first button and keep it away from readable values while speaking.
10. Start the screen capture two seconds before speaking, then trim those two seconds in editing.

### 2.3 Timing gates

Use an off-screen timer. These are deadlines, not targets to fill with extra explanation:

| Deadline | Must be visible or complete |
| --- | --- |
| 0:20 | Demo mode selected and private policy form visible |
| 0:38 | Capability committed and dashboard visible |
| 0:58 | CodeShield approved; receipt and destination shown |
| 1:10 | Public approved projection shown, then return to Owner |
| 1:23 | AlphaSignal generic observer rejection shown |
| 1:35 | Replay generic observer rejection shown |
| 1:45 | Limitation sentence complete |
| 1:50 | Tagline complete and audio ends |
| 2:00 | Absolute cut; no exceptions |

## 3. Timed shot list and exact narration

Speak at a calm, conversational pace. The narration is intentionally short; do not add a cryptography explanation during the take.

| Time | On-screen action | Exact narration | Evidence to hold briefly |
| --- | --- | --- | --- |
| 0:00-0:07 | Start on the hero. Keep the headline fully visible. | **"We're Atharv and Ashiha. This is Latch for the Midnight Hackathon."** | Latch wordmark and headline |
| 0:07-0:20 | Point once to the private-gate preview, then click `Use deterministic demo`. | **"Agents often get broad wallet access, while public rules leak budgets, categories, and strategy. Latch puts a private gate between intent and payment."** | `Demo mode` label and policy form |
| 0:20-0:38 | Sweep the default fields without editing. Click `Commit private capability`. | **"This is our deterministic local demo, not a real proof or transaction. The owner sets a twenty-credit limit, a fifty-credit budget, three uses, and developer-tools only."** | Defaults, then capability commitments |
| 0:38-0:58 | Click `Run approved request`. Let the timeline finish. On the receipt, click `Verify receipt`. | **"CodeShield requests twelve credits. The modeled gate approves it, commits a fixture receipt, and derives a one-time destination. Two uses and thirty-eight credits remain. Verification passes."** | Approved heading, destination fixture, remaining state, verification passed |
| 0:58-1:10 | Click `Public observer view`. Hold on the observer receipt, then return to `Owner view`. | **"The observer sees commitments, aggregate approval, a nullifier, and verification. The destination, agent, limits, merchant, amount, and proof steps are absent."** | Public receipt fields; no destination or policy controls |
| 1:10-1:23 | Click `Run rejected request`. After the owner explanation appears, switch to `Public observer view`. | **"AlphaSignal asks for thirty credits in another category. The owner gets a local explanation. The observer gets only a generic rejection, without the private rule."** | Exact generic observer rejection |
| 1:23-1:35 | Return to `Owner view`, click `Replay same authorization`, wait for rejection, then switch back to `Public observer view`. | **"Now I replay CodeShield. Its authorization is already consumed, state does not change, and the public result stays generic."** | Generic rejection; no receipt or destination |
| 1:35-1:45 | Hold on Public observer, then toggle Owner and Public observer once without opening a dialog. | **"These are separate render trees. The toggle is a frontend projection, not authentication. Real actions remain blocked until the verified core handoff."** | Owner details appear only in Owner; disappear in Public observer |
| 1:45-1:50 | Hold the Public observer view and place the pointer still. | **"Latch. Every payment must pass a private gate."** | Stable final frame |

The exact public rejection on screen should read:

> Authorization rejected. No private policy values were disclosed.

Do not read every hash or local fixture row aloud.

## 4. Operator action sequence

Use this as the click-only checklist during rehearsal:

1. `Use deterministic demo`
2. `Commit private capability`
3. `Run approved request`
4. Wait for `Private gate passed`
5. `Verify receipt`
6. `Public observer view`
7. `Owner view`
8. `Run rejected request`
9. Wait for the owner-private explanation
10. `Public observer view`
11. `Owner view`
12. `Replay same authorization`
13. Wait for the replay rejection
14. `Public observer view`
15. Toggle `Owner view`, then `Public observer view`
16. Deliver the tagline and stop

Never click `View structured request` during the recorded take. It adds time and makes the owner-private request JSON fill the frame. Never enter Wallet mode in this take.

## 5. Truthful narration rules

| Say | Do not say |
| --- | --- |
| deterministic local demo | live network, live contract, or on-chain demo |
| modeled gate or local fixture/client steps | generated Midnight proof |
| fixture receipt, fixture destination, fixture commitment | on-chain receipt or real one-time address |
| public frontend projection | authenticated public account or protected observer session |
| observer fields are absent from this DOM and clipboard payload | private data is erased or impossible to inspect |
| wallet connection and real actions await verified integration | wallet payment works now |
| verification passes for the committed demo receipt fixture | contract verification passed |
| replay is blocked by the deterministic demo state machine | the deployed contract prevents replay |

Do not claim mainnet, production readiness, an audit, formal verification, complete transaction-graph privacy, or exact contract-private fields.

## 6. Recovery and reset plan

### 6.1 Before recording

If rehearsal leaves the app in the wrong state, hard-refresh and begin again from the landing page. A refresh is more reliable for a clean recording state than trying to reverse each action.

### 6.2 During a take

- If the wrong button is clicked, a dialog is opened, narration is interrupted, or a result does not appear, stop the take. Do not improvise a claim.
- If an authorization is still running, wait for it to settle before refreshing.
- If capability state is wrong, use `Reset demo`, recommit the defaults, verify the flow silently, then hard-refresh and restart the take.
- If receipt verification does not visibly pass, do not say that it passed. Stop and diagnose before recording again.
- If browser focus or a notification covers the app, discard the take.
- If a wallet prompt appears, cancel it, close the wallet surface, hard-refresh, and restart in Demo mode.

### 6.3 Hard-max fallback

At **1:40**, if the replay is not complete, stop clicking and use this compressed close:

> This is a deterministic demo, and observer mode is a frontend projection, not authentication. Latch: every payment must pass a private gate.

This close takes about eight seconds. End the audio immediately afterward. Do not add credits, a logo animation, or silence that carries the exported video past 2:00.

## 7. Recording checklist

### Product state

- [ ] Hero starts clean; no capability from a prior take is visible.
- [ ] `Demo mode` remains visibly labeled.
- [ ] Default policy is unchanged: 20 per transaction, 50 total, 3 uses, `developer-tools`.
- [ ] CodeShield is 12 credits and approves.
- [ ] Remaining state is 2 uses and 38 credits.
- [ ] Receipt verification visibly passes.
- [ ] AlphaSignal is 30 credits in `trading-data` and rejects.
- [ ] Replay rejects and does not show a new receipt in Public observer.
- [ ] Public observer shows no agent, policy, amount, category, merchant, destination, detailed proof step, or private reason.

### Privacy and safety

- [ ] No wallet address, provider endpoint, API key, token, seed, personal tab, notification, or extension account is visible.
- [ ] No developer console is open in the capture.
- [ ] No private value is pasted into the address bar, chat, notes, or captions.
- [ ] The narration calls the artifacts fixtures and names the observer toggle as a frontend projection.
- [ ] No real proof, transaction, deployment, or contract behavior is claimed.

### Capture quality

- [ ] Resolution is at least 1080p in the final export.
- [ ] Browser zoom is 100%; headings and key values are readable without post-production zoom.
- [ ] Pointer movement is deliberate and does not circle continuously.
- [ ] Voice is clear, with no background notification sounds.
- [ ] Captions match the spoken script and do not cover buttons or receipt fields.
- [ ] The final edited duration is near 1:50 and never exceeds 2:00.
- [ ] The first frame names Latch visually; the spoken opening names the team and Midnight Hackathon.
- [ ] The last audible sentence is `Every payment must pass a private gate.`

## 8. Final review before upload

Watch the exported file once at normal speed and once muted.

At normal speed, confirm every spoken statement is supported by what is visible. Muted, confirm a reviewer can still follow create, approve, verify, reject, replay, and observer projection from the interface labels. Check the exact exported duration and inspect the first and last frames for accidental personal information.

If any take requires a disclaimer added after the fact to correct an overclaim, record a new take with the truthful script instead.
