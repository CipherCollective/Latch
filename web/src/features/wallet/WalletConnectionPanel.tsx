import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_REAL_NETWORK,
  MidnightWalletConnector,
  toPublicWalletError,
  type ConnectedWalletSession,
  type WalletOption,
} from '../../wallet/midnight-wallet-connector';

interface WalletConnectionPanelProps {
  connector?: MidnightWalletConnector;
  onConnected: (session: ConnectedWalletSession) => void;
  onDisconnected: () => void;
  onUseDemo: () => void;
  onBack: () => void;
}

type PanelPhase = 'discovering' | 'ready' | 'connecting' | 'error' | 'connected';
type PublicWalletError = ReturnType<typeof toPublicWalletError>;

const NETWORK_LABEL = 'Preprod';

const errorCopy: Record<PublicWalletError['code'], string> = {
  WALLET_MISSING: 'No compatible Midnight wallet was found. Install or enable a wallet, then refresh this list.',
  WALLET_DISCOVERY_FAILED:
    'Latch could not inspect the wallet connectors in this browser. Check the extension, then retry discovery.',
  WALLET_LOCKED: 'Unlock and sync your wallet, then retry the connection.',
  WALLET_REJECTED: 'The connection request was declined. Nothing was submitted. You can retry whenever you are ready.',
  WRONG_NETWORK: 'Latch requested Preprod. Switch your wallet to Preprod, then retry the connection.',
  INCOMPATIBLE_WALLET:
    'This wallet connector version is not supported by Latch. Choose a compatible wallet or use the deterministic demo.',
  PROOF_FAILED: 'Latch could not confirm a wallet connection. No proof or transaction was submitted.',
  SUBMISSION_FAILED: 'Latch could not confirm a wallet connection. No transaction is being claimed.',
  NOT_FOUND: 'The selected wallet is no longer available. Refresh the wallet list and choose again.',
  UNKNOWN: 'Latch could not confirm a wallet connection. Check the wallet, then retry or refresh the list.',
};

function safeIconUrl(value: string | undefined): string | null {
  if (!value) return null;

  if (value.length <= 24_000 && /^data:image\/(?:png|jpe?g|webp);base64,[a-z0-9+/=]+$/i.test(value)) {
    return value;
  }
  return null;
}

function panelHeading(
  phase: PanelPhase,
  walletCount: number,
  compatibleCount: number,
): { eyebrow: string; title: string; description: string } {
  if (phase === 'discovering') {
    return {
      eyebrow: 'Midnight wallet',
      title: 'Discovering Midnight wallets',
      description: 'Latch is checking the wallets injected into this browser.',
    };
  }

  if (phase === 'connecting') {
    return {
      eyebrow: 'Wallet authorization',
      title: 'Confirm in your wallet',
      description: 'The connection request is waiting for your wallet. Latch has not submitted a capability or transaction.',
    };
  }

  if (phase === 'error') {
    return {
      eyebrow: 'Recoverable connection state',
      title: 'Connection needs attention',
      description: 'Your private capability flow has not started.',
    };
  }

  if (phase === 'connected') {
    return {
      eyebrow: 'Midnight wallet',
      title: 'Midnight wallet connected',
      description: 'The wallet connection is confirmed for Preprod.',
    };
  }

  if (walletCount === 0) {
    return {
      eyebrow: 'Midnight wallet',
      title: 'No wallet detected',
      description: 'Install or enable a Midnight wallet extension, then refresh this list.',
    };
  }

  if (compatibleCount === 0) {
    return {
      eyebrow: 'Midnight wallet',
      title: 'No usable wallet connector',
      description: 'Latch found wallet connectors, but none are currently usable with the supported connector API.',
    };
  }

  return {
    eyebrow: 'Midnight wallet',
    title: compatibleCount === 1 ? 'Connect your Midnight wallet' : 'Choose your Midnight wallet',
    description: 'Wallet selection and connection happen only after your explicit confirmation.',
  };
}

export function WalletConnectionPanel({
  connector: connectorProp,
  onConnected,
  onDisconnected,
  onUseDemo,
  onBack,
}: WalletConnectionPanelProps) {
  const connector = useMemo(() => connectorProp ?? new MidnightWalletConnector(), [connectorProp]);
  const [phase, setPhase] = useState<PanelPhase>('discovering');
  const [wallets, setWallets] = useState<WalletOption[]>([]);
  const [selectedWalletId, setSelectedWalletId] = useState('');
  const [connectionError, setConnectionError] = useState<PublicWalletError | null>(null);
  const [connectedSession, setConnectedSession] = useState<ConnectedWalletSession | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const operationEpoch = useRef(0);
  const connectionInFlight = useRef(false);
  const validationInFlight = useRef(false);

  const compatibleWallets = wallets.filter((wallet) => wallet.compatible);
  const incompatibleWallets = wallets.filter((wallet) => !wallet.compatible);
  const selectedWallet = compatibleWallets.find((wallet) => wallet.id === selectedWalletId);
  const heading = panelHeading(phase, wallets.length, compatibleWallets.length);

  const discoverWallets = useCallback(async () => {
    const epoch = ++operationEpoch.current;
    setPhase('discovering');
    setConnectionError(null);
    setConnectedSession(null);

    // Preserve a visible discovery state even though browser injection discovery is synchronous.
    await Promise.resolve();

    try {
      const discovered = connector.discover();
      if (epoch !== operationEpoch.current) return;
      const compatible = discovered.filter((wallet) => wallet.compatible);
      setWallets(discovered);
      setSelectedWalletId(compatible.length === 1 ? compatible[0]?.id ?? '' : '');
      setPhase('ready');
    } catch (error) {
      if (epoch !== operationEpoch.current) return;
      setWallets([]);
      setSelectedWalletId('');
      setConnectionError(toPublicWalletError(error));
      setPhase('error');
    }
  }, [connector]);

  useEffect(() => {
    void discoverWallets();
    return () => {
      operationEpoch.current += 1;
    };
  }, [discoverWallets]);

  useEffect(() => {
    headingRef.current?.focus();
  }, [phase, connectionError?.code, wallets.length]);

  useEffect(() => {
    if (phase !== 'connected' || !connectedSession) return;
    let active = true;

    const revalidateConnection = async () => {
      if (validationInFlight.current) return;
      validationInFlight.current = true;
      const epoch = operationEpoch.current;
      try {
        const refreshedSession = await connector.revalidate(connectedSession);
        if (!active || epoch !== operationEpoch.current) return;
        setConnectedSession(refreshedSession);
        onConnected(refreshedSession);
      } catch (error) {
        if (!active || epoch !== operationEpoch.current) return;
        setConnectedSession(null);
        setConnectionError(toPublicWalletError(error));
        setPhase('error');
        onDisconnected();
      } finally {
        validationInFlight.current = false;
      }
    };

    const onFocus = () => void revalidateConnection();
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void revalidateConnection();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      active = false;
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [connectedSession, connector, onConnected, onDisconnected, phase]);

  const connectWallet = async () => {
    if (!selectedWallet || phase === 'connecting' || connectionInFlight.current) return;
    connectionInFlight.current = true;
    const epoch = ++operationEpoch.current;
    setConnectionError(null);
    setPhase('connecting');

    try {
      const session = await connector.connect(selectedWallet.id, DEFAULT_REAL_NETWORK);
      if (epoch !== operationEpoch.current) return;
      setConnectedSession(session);
      setPhase('connected');
      onConnected(session);
    } catch (error) {
      if (epoch !== operationEpoch.current) return;
      setConnectionError(toPublicWalletError(error));
      setPhase('error');
    } finally {
      if (epoch === operationEpoch.current) connectionInFlight.current = false;
    }
  };

  const leavePanel = (next: () => void) => {
    operationEpoch.current += 1;
    connectionInFlight.current = false;
    validationInFlight.current = false;
    next();
  };

  const retryConnection = () => {
    if (selectedWallet) {
      void connectWallet();
      return;
    }
    void discoverWallets();
  };

  const connectedWalletName = connectedSession?.snapshot.walletName ?? selectedWallet?.name ?? 'Midnight wallet';
  const hasSelectableWallet = compatibleWallets.length > 0;
  const isConnecting = phase === 'connecting';

  return (
    <section className="workflow-section wallet-connection-panel" aria-labelledby="wallet-connection-title">
      <div className="workflow-heading">
        <span className="eyebrow">{heading.eyebrow}</span>
        <h1 id="wallet-connection-title" ref={headingRef} tabIndex={-1}>
          {heading.title}
        </h1>
        <p>{heading.description}</p>
      </div>

      <div className="builder-grid">
        <div className="panel-light policy-form wallet-selection-panel" aria-busy={isConnecting}>
          <div className="form-section-heading">
            <div>
              <h2>Connection target</h2>
              <p>
                Requested network: <strong>{NETWORK_LABEL}</strong>
              </p>
            </div>
          </div>

          <div className="form-alert wallet-status" role="status" aria-live="polite" aria-atomic="true">
            {phase === 'discovering' ? 'Discovering injected wallet connectors.' : null}
            {phase === 'ready' && wallets.length === 0 ? 'No wallet is currently available.' : null}
            {phase === 'ready' && wallets.length > 0 && compatibleWallets.length === 0
              ? 'No compatible wallet is currently available.'
              : null}
            {phase === 'ready' && compatibleWallets.length > 0
              ? `${compatibleWallets.length} compatible wallet${compatibleWallets.length === 1 ? '' : 's'} available.`
              : null}
            {phase === 'connecting' ? `Waiting for ${selectedWallet?.name ?? 'the selected wallet'} on Preprod.` : null}
            {phase === 'connected' ? `${connectedWalletName} connected on Preprod.` : null}
            {phase === 'error' ? 'Wallet connection was not confirmed.' : null}
          </div>

          {hasSelectableWallet && phase !== 'connected' ? (
            <fieldset className="wallet-picker" disabled={isConnecting}>
              <legend>{compatibleWallets.length === 1 ? 'Compatible wallet' : 'Select a compatible wallet'}</legend>
              {compatibleWallets.map((wallet) => {
                const iconUrl = safeIconUrl(wallet.iconUrl);
                const inputId = `wallet-option-${wallet.id}`;
                return (
                  <div className="wallet-option" key={wallet.id}>
                    <input
                      id={inputId}
                      type="radio"
                      name="latch-wallet"
                      value={wallet.id}
                      checked={selectedWalletId === wallet.id}
                      onChange={() => setSelectedWalletId(wallet.id)}
                    />
                    <label htmlFor={inputId}>
                      {iconUrl ? (
                        <img
                          src={iconUrl}
                          alt=""
                          aria-hidden="true"
                          width="32"
                          height="32"
                          referrerPolicy="no-referrer"
                          onError={(event) => {
                            event.currentTarget.hidden = true;
                          }}
                        />
                      ) : null}
                      <span>
                        <strong>{wallet.name}</strong>
                        <small>Connector API {wallet.apiVersion}</small>
                      </span>
                    </label>
                  </div>
                );
              })}
            </fieldset>
          ) : null}

          {incompatibleWallets.length > 0 && phase !== 'connected' ? (
            <div className="wallet-incompatible-list" aria-labelledby="unsupported-wallets-title">
              <h3 id="unsupported-wallets-title">Detected but unsupported</h3>
              <ul>
                {incompatibleWallets.map((wallet) => (
                  <li key={wallet.id}>
                    <strong>{wallet.name}</strong>
                    <span>Connector API {wallet.apiVersion}</span>
                    <small>{wallet.incompatibilityReason ?? 'This wallet connector is not usable.'}</small>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {phase === 'error' && connectionError ? (
            <div className="form-alert" role="alert" aria-live="assertive" aria-atomic="true">
              <strong>{connectionError.code.replaceAll('_', ' ')}</strong>
              <p>{errorCopy[connectionError.code]}</p>
            </div>
          ) : null}

          {phase === 'connected' && connectedSession ? (
            <div className="wallet-connected-summary" role="status" aria-live="polite" aria-atomic="true">
              <strong>{connectedWalletName}</strong>
              <span>Connected to {NETWORK_LABEL}</span>
              <p>
                The core contract adapter is waiting for a verified teammate handoff. No capability or transaction was
                submitted, and Latch will not proceed from this connection screen.
              </p>
            </div>
          ) : null}

          <div className="form-actions wallet-actions">
            <button
              className="button button-ghost-light"
              type="button"
              onClick={() => leavePanel(onBack)}
            >
              Back
            </button>
            {phase !== 'connected' ? (
              <button
                className="button button-ghost-light"
                type="button"
                onClick={() => void discoverWallets()}
                disabled={isConnecting}
              >
                {phase === 'discovering' ? 'Refreshing…' : 'Refresh wallets'}
              </button>
            ) : null}
            {phase === 'error' ? (
              <button className="button button-primary" type="button" onClick={retryConnection}>
                {selectedWallet ? 'Retry connection' : 'Retry discovery'}
              </button>
            ) : null}
            {(phase === 'ready' || phase === 'connecting') && hasSelectableWallet ? (
              <button
                className="button button-primary"
                type="button"
                onClick={() => void connectWallet()}
                disabled={!selectedWallet || isConnecting}
              >
                {isConnecting ? 'Waiting for wallet…' : `Connect on ${NETWORK_LABEL}`}
              </button>
            ) : null}
          </div>
        </div>

        <aside className="privacy-preview wallet-demo-fallback" aria-labelledby="wallet-demo-title">
          <div className="privacy-preview-header">
            <div>
              <span className="eyebrow">Available in every state</span>
              <h2 id="wallet-demo-title">Use the deterministic demo</h2>
            </div>
          </div>
          <p className="fixture-note">
            Explore the complete private-gate flow without connecting a wallet. Demo fixtures are local and are not
            on-chain transactions.
          </p>
          <button className="button button-secondary" type="button" onClick={() => leavePanel(onUseDemo)}>
            Use deterministic demo
          </button>
        </aside>
      </div>
    </section>
  );
}
