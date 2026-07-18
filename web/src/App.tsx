import { useState } from 'react';
import { ArrowDown, CircleCheck, EyeOff, LockKeyhole, Network } from 'lucide-react';
import { BrandMark } from './components/layout/BrandMark';
import { ModeChooser } from './components/layout/ModeChooser';
import { ProtocolSteps } from './components/layout/ProtocolSteps';
import { CapabilityDashboard } from './features/capability/CapabilityDashboard';
import { PolicyBuilder } from './features/capability/PolicyBuilder';
import { useMoatClient } from './services/moat-provider';
import type { CapabilityOwnerState, CreateCapabilityInput } from './types/domain';

type SelectedMode = 'landing' | 'demo' | 'wallet';
type Screen = 'landing' | 'policy' | 'dashboard';

function App() {
  const client = useMoatClient();
  const [selectedMode, setSelectedMode] = useState<SelectedMode>('landing');
  const [screen, setScreen] = useState<Screen>('landing');
  const [capability, setCapability] = useState<CapabilityOwnerState | null>(null);
  const [busy, setBusy] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);

  const enterDemo = () => {
    setSelectedMode('demo');
    setClientError(null);
    setScreen('policy');
  };

  const chooseWallet = () => {
    setSelectedMode('wallet');
    setClientError(null);
  };

  const commitCapability = async (input: CreateCapabilityInput) => {
    if (busy) return;
    setBusy(true);
    setClientError(null);
    try {
      const result = await client.createCapability(input);
      const state = await client.getCapability(result.capabilityId);
      if (!('policy' in state)) throw new Error('Owner state was unavailable.');
      setCapability(state);
      setScreen('dashboard');
    } catch {
      setClientError('The demo capability could not be created. Your values were preserved; try again.');
    } finally {
      setBusy(false);
    }
  };

  const revokeCapability = async () => {
    if (!capability || busy) return;
    setBusy(true);
    try {
      await client.revokeCapability(capability.capabilityId);
      const state = await client.getCapability(capability.capabilityId);
      if ('policy' in state) setCapability(state);
    } finally {
      setBusy(false);
    }
  };

  const returnHome = () => {
    setScreen('landing');
    setSelectedMode('landing');
    setClientError(null);
  };

  const startOver = () => {
    setCapability(null);
    setClientError(null);
    setScreen('policy');
  };

  return (
    <div className="site-shell" id="top">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <header className="site-header">
        <BrandMark />
        <div className="header-meta">
          <span className="protocol-chip">
            <Network aria-hidden="true" size={14} />
            DeFi protocol
          </span>
          <span className={`mode-chip mode-chip-${selectedMode}`}>
            {selectedMode === 'demo' ? 'Demo mode' : selectedMode === 'wallet' ? 'Wallet setup' : 'Private by design'}
          </span>
        </div>
      </header>

      <main id="main-content" tabIndex={-1}>
        {screen === 'landing' ? (
          <Landing selectedMode={selectedMode} onDemo={enterDemo} onWallet={chooseWallet} />
        ) : screen === 'policy' ? (
          <PolicyBuilder busy={busy} clientError={clientError} onCommit={commitCapability} onBack={returnHome} />
        ) : capability ? (
          <CapabilityDashboard
            capability={capability}
            revoking={busy}
            onRevoke={revokeCapability}
            onStartOver={startOver}
          />
        ) : null}
      </main>

      <footer className="site-footer">
        <BrandMark />
        <p>Private spending capabilities for autonomous agents.</p>
        <span>Built for the Midnight Hackathon · DeFi</span>
      </footer>
    </div>
  );
}

function Landing({
  selectedMode,
  onDemo,
  onWallet,
}: {
  selectedMode: SelectedMode;
  onDemo: () => void;
  onWallet: () => void;
}) {
  return (
    <>
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <span className="eyebrow">Private authorization for autonomous commerce</span>
          <h1 id="hero-title">Every payment must pass a private gate.</h1>
          <p className="hero-kicker">Give agents money. Not your wallet.</p>
          <p className="hero-subhead">
            Delegate spending power under private, zero-knowledge rules on Midnight. The chain verifies the gate;
            your limits stay private.
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
                Publicly verifiable
              </dt>
              <dd>Commitment, proof status, nullifier</dd>
            </div>
            <div>
              <dt>
                <EyeOff aria-hidden="true" size={15} />
                Kept private
              </dt>
              <dd>Owner, limits, budget, category, merchant</dd>
            </div>
          </dl>
          {selectedMode === 'wallet' ? (
            <div className="mode-notice" role="status" aria-live="polite">
              <strong>Wallet mode selected</strong>
              <span>Connection is not claimed until a compatible wallet confirms it. Demo mode remains available.</span>
            </div>
          ) : null}
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
          <div role="listitem"><span>02</span><strong>Latch gate</strong><small>Proves hidden constraints</small></div>
          <i aria-hidden="true" />
          <div role="listitem"><span>03</span><strong>Agent</strong><small>Receives one-time receipt</small></div>
        </div>
      </section>
    </>
  );
}

export default App;
