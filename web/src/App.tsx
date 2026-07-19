import { useEffect, useRef, useState, type RefObject } from 'react';
import { ArrowDown, CircleCheck, EyeOff, LockKeyhole, Network } from 'lucide-react';
import { BrandMark } from './components/layout/BrandMark';
import { ModeChooser } from './components/layout/ModeChooser';
import { ProtocolSteps } from './components/layout/ProtocolSteps';
import { CapabilityDashboard } from './features/capability/CapabilityDashboard';
import { PolicyBuilder } from './features/capability/PolicyBuilder';
import { ALPHA_SIGNAL_REQUEST, CODE_SHIELD_REQUEST } from './demo/requests';
import type { ActivityEvent, DemoRequestKind } from './features/authorization/AgentActivityConsole';
import { ObserverWorkspace } from './features/observer/ObserverWorkspace';
import { ViewModeToggle } from './features/observer/ViewModeToggle';
import { WalletConnectionPanel } from './features/wallet/WalletConnectionPanel';
import { DeveloperMoatDeployRoute } from './features/developer/DeveloperMoatDeployRoute';
import { buildObserverWorkspaceModel } from './privacy/observer-serializer';
import { useMoatClient } from './services/moat-provider';
import { MidnightWalletConnector, type ConnectedWalletSession } from './wallet/midnight-wallet-connector';
import type {
  AuthorizationReceipt,
  AuthorizationResult,
  CapabilityOwnerState,
  CreateCapabilityInput,
  ProofStep,
} from './types/domain';

type SelectedMode = 'landing' | 'demo' | 'wallet';
type Screen = 'landing' | 'wallet' | 'policy' | 'dashboard';
type ViewMode = 'owner' | 'observer';
type RejectedAuthorization = Extract<AuthorizationResult, { status: 'rejected' }>;
type VerificationState = 'idle' | 'verifying' | 'verified' | 'invalid' | 'unavailable';

const PROOF_STATUS_RANK: Record<ProofStep['status'], number> = {
  waiting: 0,
  running: 1,
  passed: 2,
  failed: 2,
};

function App() {
  const client = useMoatClient();
  const walletConnector = useRef(new MidnightWalletConnector());
  const [selectedMode, setSelectedMode] = useState<SelectedMode>('landing');
  const [screen, setScreen] = useState<Screen>('landing');
  const [viewMode, setViewMode] = useState<ViewMode>('owner');
  const [walletSession, setWalletSession] = useState<ConnectedWalletSession | null>(null);
  const [developerWalletSession, setDeveloperWalletSession] = useState<ConnectedWalletSession | null>(null);
  const [capability, setCapability] = useState<CapabilityOwnerState | null>(null);
  const [busy, setBusy] = useState(false);
  const [authorizationBusy, setAuthorizationBusy] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);
  const [proofSteps, setProofSteps] = useState<ProofStep[]>([]);
  const [approvedReceipt, setApprovedReceipt] = useState<AuthorizationReceipt | null>(null);
  const [rejection, setRejection] = useState<RejectedAuthorization | null>(null);
  const [verification, setVerification] = useState<VerificationState>('idle');
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [activeRequestLabel, setActiveRequestLabel] = useState<string>();
  const operationEpoch = useRef(0);
  const lifecycleInFlight = useRef(false);
  const authorizationInFlight = useRef(false);
  const eventCounter = useRef(0);
  const eventKeys = useRef(new Set<string>());
  const verificationTarget = useRef<string | null>(null);
  const landingHeadingRef = useRef<HTMLHeadingElement>(null);
  const shouldRestoreLandingFocus = useRef(false);
  const isDeveloperDeployRoute =
    typeof window !== 'undefined' && window.location.pathname === '/developer/moat-deploy';

  useEffect(() => {
    if (screen === 'landing' && shouldRestoreLandingFocus.current) {
      shouldRestoreLandingFocus.current = false;
      landingHeadingRef.current?.focus();
    }
  }, [screen]);

  const advanceEpoch = () => {
    operationEpoch.current += 1;
    lifecycleInFlight.current = false;
    authorizationInFlight.current = false;
    return operationEpoch.current;
  };

  const clearAuthorizationState = () => {
    setAuthorizationBusy(false);
    setProofSteps([]);
    setApprovedReceipt(null);
    setRejection(null);
    setVerification('idle');
    verificationTarget.current = null;
    setEvents([]);
    setActiveRequestLabel(undefined);
    eventKeys.current.clear();
  };

  const addEvent = (key: string, label: string, epoch: number) => {
    if (operationEpoch.current !== epoch || eventKeys.current.has(key)) return;
    eventKeys.current.add(key);
    eventCounter.current += 1;
    const eventId = `event-${eventCounter.current}`;
    setEvents((current) => [...current, { id: eventId, label }]);
  };

  const enterDemo = () => {
    advanceEpoch();
    setSelectedMode('demo');
    setWalletSession(null);
    setViewMode('owner');
    setClientError(null);
    setCapability(null);
    clearAuthorizationState();
    setScreen('policy');
  };

  const chooseWallet = () => {
    advanceEpoch();
    setSelectedMode('wallet');
    setWalletSession(null);
    setViewMode('owner');
    setClientError(null);
    setCapability(null);
    clearAuthorizationState();
    setScreen('wallet');
  };

  const commitCapability = async (input: CreateCapabilityInput) => {
    if (lifecycleInFlight.current) return;
    lifecycleInFlight.current = true;
    const epoch = operationEpoch.current;
    setBusy(true);
    setClientError(null);
    try {
      const result = await client.createCapability(input);
      if (operationEpoch.current !== epoch) return;
      let state: CapabilityOwnerState;
      try {
        const refreshed = await client.getCapability(result.capabilityId);
        if (!('policy' in refreshed)) throw new Error('Owner state was unavailable.');
        state = refreshed;
      } catch {
        state = {
          capabilityId: result.capabilityId,
          policyCommitment: result.policyCommitment,
          spendStateCommitment: result.spendStateCommitment,
          status: 'active',
          alias: input.alias,
          policy: input.policy,
          usesRemaining: input.policy.maxUses,
          remainingBudget: input.policy.totalBudget,
        };
        setClientError('Capability was created, but its state could not refresh. Do not submit it again; retry the page when ready.');
      }
      if (operationEpoch.current !== epoch) return;
      setCapability(state);
      setViewMode('owner');
      clearAuthorizationState();
      setScreen('dashboard');
    } catch {
      if (operationEpoch.current === epoch) {
        setClientError('The demo capability could not be created. Your values were preserved; try again.');
      }
    } finally {
      if (operationEpoch.current === epoch) {
        lifecycleInFlight.current = false;
        setBusy(false);
      }
    }
  };

  const revokeCapability = async () => {
    if (!capability || lifecycleInFlight.current || authorizationInFlight.current) return;
    lifecycleInFlight.current = true;
    const epoch = operationEpoch.current;
    setBusy(true);
    setClientError(null);
    try {
      await client.revokeCapability(capability.capabilityId);
      if (operationEpoch.current !== epoch) return;
      try {
        const state = await client.getCapability(capability.capabilityId);
        if ('policy' in state) setCapability(state);
      } catch {
        setCapability({ ...capability, status: 'revoked' });
        setClientError('Capability was revoked, but its refreshed state could not be read. Do not retry revocation.');
      }
    } catch {
      if (operationEpoch.current === epoch) setClientError('Revocation could not be completed. Try again.');
    } finally {
      if (operationEpoch.current === epoch) {
        lifecycleInFlight.current = false;
        setBusy(false);
      }
    }
  };

  const runAuthorization = async (kind: DemoRequestKind) => {
    if (!capability || capability.status === 'revoked' || authorizationInFlight.current || lifecycleInFlight.current) {
      return;
    }
    authorizationInFlight.current = true;
    const epoch = operationEpoch.current;
    const request = kind === 'rejected' ? ALPHA_SIGNAL_REQUEST : CODE_SHIELD_REQUEST;
    const runKey = `${kind}-${eventCounter.current + 1}`;
    setAuthorizationBusy(true);
    setClientError(null);
    setRejection(null);
    setProofSteps([]);
    setActiveRequestLabel(kind === 'replay' ? 'CodeShield replay' : request.merchant.displayName);
    addEvent(`${runKey}-created`, kind === 'replay' ? 'Agent replayed the prior authorization.' : 'Agent created request.', epoch);
    addEvent(`${runKey}-requested`, 'Authorization requested from the private gate.', epoch);

    try {
      const result = await client.authorizeSpend({
        capabilityId: capability.capabilityId,
        request,
        onProofStep: (step) => {
          if (operationEpoch.current !== epoch) return;
          setProofSteps((current) => upsertProofStep(current, step));
          if (step.id === 'derive-destination' && step.status === 'passed') {
            addEvent(`${runKey}-destination`, 'One-time destination derived.', epoch);
          }
          if (step.status === 'running') addEvent(`${runKey}-proof`, 'Demo fixture/client steps updated.', epoch);
        },
      });
      if (operationEpoch.current !== epoch) return;
      setProofSteps(result.proofSteps);
      addEvent(`${runKey}-result`, result.status === 'approved' ? 'Approved result received.' : 'Rejected result received.', epoch);
      if (result.status === 'approved') {
        verificationTarget.current = null;
        setApprovedReceipt(result.receipt);
        setRejection(null);
        setVerification('idle');
      } else {
        setRejection(result);
      }
      const state = await client.getCapability(capability.capabilityId);
      if (operationEpoch.current === epoch && 'policy' in state) setCapability(state);
    } catch {
      if (operationEpoch.current === epoch) {
        setClientError('Authorization could not finish. No approval or transaction is being claimed.');
      }
    } finally {
      if (operationEpoch.current === epoch) {
        authorizationInFlight.current = false;
        setAuthorizationBusy(false);
      }
    }
  };

  const verifyReceipt = async () => {
    if (!approvedReceipt || verification === 'verifying') return;
    const epoch = operationEpoch.current;
    const receiptCommitment = approvedReceipt.receiptCommitment;
    verificationTarget.current = receiptCommitment;
    setVerification('verifying');
    try {
      const verified = await client.verifyReceipt(receiptCommitment);
      if (operationEpoch.current === epoch && verificationTarget.current === receiptCommitment) {
        setVerification(verified ? 'verified' : 'invalid');
      }
    } catch {
      if (operationEpoch.current === epoch && verificationTarget.current === receiptCommitment) {
        setVerification('unavailable');
      }
    }
  };

  const returnHome = () => {
    advanceEpoch();
    shouldRestoreLandingFocus.current = true;
    setScreen('landing');
    setSelectedMode('landing');
    setWalletSession(null);
    setViewMode('owner');
    setClientError(null);
    setCapability(null);
    clearAuthorizationState();
  };

  const startOver = () => {
    advanceEpoch();
    setCapability(null);
    setViewMode('owner');
    setClientError(null);
    setBusy(false);
    clearAuthorizationState();
    setScreen('policy');
  };

  return (
    <div className="site-shell" id="top">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <header className="site-header">
        <BrandMark onNavigateHome={returnHome} />
        <div className="header-meta">
          <span className="protocol-chip">
            <Network aria-hidden="true" size={14} />
            DeFi protocol
          </span>
          <span className={`mode-chip mode-chip-${selectedMode}`}>
            {selectedMode === 'demo'
              ? 'Demo mode'
              : selectedMode === 'wallet' && walletSession
                ? 'Preprod · Wallet connected'
                : selectedMode === 'wallet'
                  ? 'Wallet setup'
                  : 'Private by design'}
          </span>
        </div>
      </header>

      <main id="main-content" tabIndex={-1}>
        {isDeveloperDeployRoute ? (
          <DeveloperMoatDeployRoute
            connector={walletConnector.current}
            session={developerWalletSession}
            onConnected={setDeveloperWalletSession}
            onDisconnected={() => setDeveloperWalletSession(null)}
          />
        ) : screen === 'landing' ? (
          <Landing headingRef={landingHeadingRef} onDemo={enterDemo} onWallet={chooseWallet} />
        ) : screen === 'wallet' ? (
          <WalletConnectionPanel
            connector={walletConnector.current}
            onConnected={setWalletSession}
            onDisconnected={() => setWalletSession(null)}
            onUseDemo={enterDemo}
            onBack={returnHome}
          />
        ) : screen === 'policy' ? (
          <PolicyBuilder busy={busy} clientError={clientError} onCommit={commitCapability} onBack={returnHome} />
        ) : capability ? (
          <div className="workspace-view-shell">
            <div className="workspace-view-bar">
              <div>
                <span className="eyebrow">Disclosure boundary</span>
                <p>Switching views replaces the rendered data source.</p>
              </div>
              <ViewModeToggle value={viewMode} onChange={setViewMode} disabled={false} />
            </div>
            {viewMode === 'owner' ? (
              <CapabilityDashboard
                capability={capability}
                operationBusy={busy || authorizationBusy}
                authorizationBusy={authorizationBusy}
                clientError={clientError}
                proofSteps={proofSteps}
                activeRequestLabel={activeRequestLabel}
                approvedReceipt={approvedReceipt}
                rejection={rejection}
                verification={verification}
                canReplay={approvedReceipt !== null}
                events={events}
                onRevoke={revokeCapability}
                onRunAuthorization={runAuthorization}
                onVerifyReceipt={verifyReceipt}
                onStartOver={startOver}
              />
            ) : (
              <ObserverWorkspace
                model={buildObserverWorkspaceModel({
                  capability,
                  proofSteps,
                  receipt: approvedReceipt,
                  rejection,
                  verification,
                  authorizationBusy,
                })}
                onVerifyReceipt={verifyReceipt}
              />
            )}
          </div>
        ) : null}
      </main>

      <footer className="site-footer">
        <BrandMark onNavigateHome={returnHome} />
        <p>Private spending capabilities for autonomous agents.</p>
        <span>Built for the Midnight Hackathon · DeFi</span>
        <a href={`${import.meta.env.BASE_URL}THIRD_PARTY_NOTICES.txt`}>Third-party notices</a>
      </footer>
    </div>
  );
}

function Landing({
  headingRef,
  onDemo,
  onWallet,
}: {
  headingRef: RefObject<HTMLHeadingElement | null>;
  onDemo: () => void;
  onWallet: () => void;
}) {
  return (
    <>
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <span className="eyebrow">Private authorization for autonomous commerce</span>
          <h1 id="hero-title" ref={headingRef} tabIndex={-1}>Every payment must pass a private gate.</h1>
          <p className="hero-kicker">Give agents money. Not your wallet.</p>
          <p className="hero-subhead">
            Delegate spending power under private rules. The deterministic demo models the full gate locally;
            verified Midnight proofs and transactions remain disabled until the core handoff.
          </p>
          <ModeChooser onDemo={onDemo} onWallet={onWallet} />
          <a className="architecture-link" href="#architecture">
            View protocol architecture
            <ArrowDown aria-hidden="true" size={16} />
          </a>
        </div>

        <aside className="gate-preview" aria-label="Private gate preview">
          <div className="preview-topline">
            <span>Authorization gate</span>
            <span className="status-dot">Ready</span>
          </div>
          <div className="gate-orbit" aria-hidden="true">
            <span className="gate-ring gate-ring-outer" />
            <span className="gate-ring gate-ring-inner" />
            <span className="gate-core">
              <LockKeyhole size={30} strokeWidth={1.7} />
            </span>
          </div>
          <dl className="preview-list">
            <div>
              <dt>
                <CircleCheck aria-hidden="true" size={15} />
                Public protocol projection
              </dt>
              <dd>Commitments, aggregate status, nullifier fixture</dd>
            </div>
            <div>
              <dt>
                <EyeOff aria-hidden="true" size={15} />
                Kept private
              </dt>
              <dd>Owner, limits, budget, category, merchant</dd>
            </div>
          </dl>
        </aside>
      </section>
      <ProtocolSteps />
      <section className="architecture" id="architecture" aria-labelledby="architecture-title">
        <div className="section-heading">
          <span className="eyebrow">Separation of powers</span>
          <h2 id="architecture-title">The agent requests. Latch decides. Your wallet stays yours.</h2>
        </div>
        <div className="architecture-flow" role="list" aria-label="Latch architecture flow">
          <div role="listitem"><span>01</span><strong>Owner</strong><small>Commits private policy</small></div>
          <i aria-hidden="true" />
          <div role="listitem"><span>02</span><strong>Latch gate</strong><small>Evaluates private constraints</small></div>
          <i aria-hidden="true" />
          <div role="listitem"><span>03</span><strong>Agent</strong><small>Receives one-time receipt</small></div>
        </div>
      </section>
    </>
  );
}

export default App;

function upsertProofStep(current: ProofStep[], next: ProofStep): ProofStep[] {
  const index = current.findIndex((step) => step.id === next.id);
  if (index === -1) return [...current, next];
  const existing = current[index];
  if (!existing || PROOF_STATUS_RANK[next.status] < PROOF_STATUS_RANK[existing.status]) return current;
  if ((existing.status === 'passed' || existing.status === 'failed') && existing.status !== next.status) return current;
  const updated = [...current];
  updated[index] = next;
  return updated;
}
