# Latch — Devpost copy

> Draft status: the product narrative below describes the implementation
> currently present in this repository. Replace the marked facts only with
> evidence that has been independently verified before submission.

## Inspiration

DeFi wallets are becoming operating accounts for software, not just people. An
AI agent may need to buy data, renew infrastructure, or pay for a security
report while its owner is away. Giving that agent broad wallet access is
convenient, but it turns one compromised workflow or bad recommendation into an
open-ended financial risk. Publishing every spending rule is not a satisfying
answer either: limits, approved providers, and timing can reveal an owner's
strategy.

We built Latch around a simple idea: **every payment must pass a private gate**.
The owner should be able to delegate a narrow capability, the agent should be
able to prove that a purchase fits it, and an observer should learn only the
minimum needed to understand the outcome.

## What it does

Latch models a private spending capability with a budget, per-payment limit,
category rule, and use count. The current deterministic browser demo
lets an owner create that capability and then walk through the full decision
lifecycle:

1. CodeShield requests payment for a security report and is approved.
2. AlphaSignal requests payment for a trading dataset and is rejected; the
   owner sees a local explanation while Public Observer receives only the fixed
   generic rejection.
3. CodeShield reuses its consumed authorization and the replay is blocked.
4. The owner revokes the capability and further requests stay disabled.

The owner view shows the details needed to operate the capability. The Public
Observer view is a separate, allowlisted React projection that shows opaque
commitments, aggregate progress, and a restricted receipt without rendering the
owner's private policy or rejection reason. That view is a frontend disclosure
boundary, not authentication or same-origin isolation.

This repository currently runs those decisions as deterministic in-browser
fixtures. They are repeatable for judging and testing, but they are not Compact
execution, a zero-knowledge proof, a ledger transaction, or evidence of an
on-chain deployment.

Latch also includes a real Midnight wallet connection boundary. It discovers
injected DApp Connector wallets, requires an explicit choice when more than one
is available, validates connector compatibility, and confirms Preprod
configuration while requesting only connection-status and configuration
access. A confirmed wallet session does not enable capability or payment
actions: the client handoff fails closed until the independently owned core
integration is supplied and verified.

## How we built it

The interface is a TypeScript, React, and Vite application organized around a
typed `MoatClient` boundary. A deterministic mock implements the complete demo
path, including exact decimal handling, canonical request data, serialized
authorization, replay protection, budget and use-count mutation, revocation,
receipts, and receipt verification.

We treated disclosure as an API-design problem rather than a styling problem.
The observer workspace receives a dedicated public data-transfer object
produced by an allowlist serializer; it never receives the owner model. Tests
inject hostile private values, switch views while work is in flight, inspect
DOM mutations, and verify the public clipboard payload.

At the wallet edge, we use the Midnight DApp Connector API through a small
adapter. The adapter treats the injected registry as untrusted input, checks
semantic-version compatibility, rejects unsafe icons and configuration, maps
wallet failures to safe public messages, and never asks for an address,
balance, seed, witness, or private policy.

The real contract/client package, callable inputs and outputs, proof semantics,
disclosure classification, and deployed address remain
**[CORE FACT REQUIRED]**. We will update this section only from the verified
core handoff; the current implementation makes no Compact or on-chain claim.

## Challenges

The hardest challenge was making the demo useful without letting it overstate
what exists. A polished approval animation can look indistinguishable from a
real proof flow, so we labeled every fixture, removed fake transaction and
explorer data, and kept the real path unavailable when its dependency is
absent.

Privacy also required more than hiding a panel with CSS. We had to define
exactly which fields an observer may receive, render owner and observer modes as
different component trees, sanitize copied JSON, and test the transition itself
for transient leaks. Even with that work, browser memory and same-origin
JavaScript remain outside the protection offered by the projection, and the
product says so.

Wallet discovery presented another trust boundary. Browser-injected connectors
can expose malformed metadata, incompatible APIs, stale connection state, or
unsafe service URLs. The connection flow therefore validates before it trusts
and gives the user a clear path back to the deterministic demo.

## Accomplishments that we're proud of

We are proud that the main DeFi story is demonstrable from beginning to end
without a wallet or private infrastructure: create a constrained capability,
approve one purchase, reject another privately, stop a replay, revoke access,
and compare owner and public views.

We are also proud of the failure behavior. Latch does not invent a transaction
hash, imply that a wallet connection is a core integration, or silently fall
back from a failed real action to a mock result. Missing infrastructure produces
a bounded explanation and preserves the safe demo path.

Finally, the implementation is backed by deterministic service tests, UI
integration tests, hostile-input privacy tests, responsive browser captures,
and accessibility checks. Those checks focus on the moments where financial
and privacy interfaces most often become misleading: loading, rejection,
replay, view switching, copying, and reconnection.

## What we learned

We learned that a private payment product needs two contracts: the transaction
contract and the disclosure contract. It is not enough for a rule to be private
in a circuit if the interface, receipt, clipboard, or error message gives the
rule away.

We also learned that determinism is valuable when it is named honestly. A fixed
scenario gives judges and contributors a reliable way to inspect state
transitions and privacy behavior while the verified core is developed
independently. The boundary between the two has to stay explicit in code, copy,
and evidence.

Most importantly, an AI agent does not need unlimited financial autonomy to be
useful. A narrow, revocable, auditable capability is a more credible building
block for agentic DeFi than a broadly funded hot wallet.

## What's next

The next engineering step is to replace the fail-closed real-client seam with
the verified core package, then validate its amount units, witness boundaries,
circuit behavior, proof and receipt semantics, network configuration, and
deployment evidence. Every resulting technical claim is
**[CORE FACT REQUIRED]** until that handoff is complete.

After integration, we plan to add multiple capabilities, clearer expiry
management, a separately served public-observer surface backed only by public
data, and richer audit exports. Longer term, Latch could gate recurring
infrastructure purchases, data marketplaces, protocol operations, and other
machine-initiated DeFi payments without exposing the owner's complete strategy.

## Facts to complete before publishing

| Submission field | Verified value |
| --- | --- |
| Core integration and evidence | [CORE FACT REQUIRED] |
| Public URL and incognito test | [DEPLOYMENT FACT REQUIRED] |
| Devpost, team, track, and video | [SUBMISSION FACT REQUIRED] |
