import { Component, useEffect, useState, type ComponentType, type ErrorInfo, type ReactNode } from 'react';
import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';

import { WalletConnectionPanel } from '../wallet/WalletConnectionPanel';
import type { ConnectedWalletSession, MidnightWalletConnector } from '../../wallet/midnight-wallet-connector';
import type { MoatPreprodDeployPanelProps } from './MoatPreprodDeployPanel';
import {
  DeveloperRouteDiagnosticView,
  developerRouteDiagnostic,
  type DeveloperRouteDiagnostic,
  type DeveloperRouteStage,
} from './developer-route-diagnostics';

const DEFAULT_LOAD_TIMEOUT_MS = 12_000;

export type DeveloperDeployModule = {
  readonly MoatPreprodDeployPanel: ComponentType<MoatPreprodDeployPanelProps>;
};

export type DeveloperDeployModuleLoader = () => Promise<DeveloperDeployModule>;

const loadDeveloperDeployModule: DeveloperDeployModuleLoader = () =>
  import('./MoatPreprodDeployPanel');

type RouteConnector = Pick<MidnightWalletConnector, 'getConnectedApi'> & MidnightWalletConnector;

type DeveloperMoatDeployRouteProps = {
  connector: RouteConnector;
  session: ConnectedWalletSession | null;
  onConnected: (session: ConnectedWalletSession) => void;
  onDisconnected: () => void;
  loadModule?: DeveloperDeployModuleLoader;
  loadTimeoutMs?: number;
};

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; module: DeveloperDeployModule }
  | { status: 'failed'; diagnostic: DeveloperRouteDiagnostic };

function importFailureStage(error: unknown): DeveloperRouteStage {
  if (error instanceof SyntaxError || error instanceof ReferenceError) return 'module_initialization';
  return 'dynamic_import';
}

function useDeveloperDeployModule(loader: DeveloperDeployModuleLoader, timeoutMs: number): LoadState {
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    let active = true;
    const timeout = window.setTimeout(() => {
      if (active) {
        setState({
          status: 'failed',
          diagnostic: developerRouteDiagnostic('dynamic_import_timeout', new Error('timeout')),
        });
      }
    }, timeoutMs);

    void loader().then(
      (module) => {
        if (!active) return;
        window.clearTimeout(timeout);
        if (typeof module.MoatPreprodDeployPanel !== 'function') {
          setState({
            status: 'failed',
            diagnostic: developerRouteDiagnostic('module_initialization', new TypeError('invalid module export')),
          });
          return;
        }
        setState({ status: 'ready', module });
      },
      (error: unknown) => {
        if (!active) return;
        window.clearTimeout(timeout);
        const stage = importFailureStage(error);
        setState({ status: 'failed', diagnostic: developerRouteDiagnostic(stage, error) });
      },
    );

    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [loader, timeoutMs]);

  return state;
}

class DeveloperPanelErrorBoundary extends Component<
  { children: ReactNode; onReconnect: () => void },
  { diagnostic: DeveloperRouteDiagnostic | null }
> {
  state = { diagnostic: null } as { diagnostic: DeveloperRouteDiagnostic | null };

  static getDerivedStateFromError(error: unknown) {
    return { diagnostic: developerRouteDiagnostic('panel_render', error) };
  }

  componentDidCatch(_error: unknown, _info: ErrorInfo): void {
    // Raw extension/module errors are intentionally not logged.
  }

  render(): ReactNode {
    if (this.state.diagnostic) {
      return (
        <DeveloperRouteDiagnosticView
          diagnostic={this.state.diagnostic}
          action={<button type="button" className="button button-ghost-light" onClick={this.props.onReconnect}>Reconnect Lace</button>}
        />
      );
    }
    return this.props.children;
  }
}

export function DeveloperMoatDeployRoute({
  connector,
  session,
  onConnected,
  onDisconnected,
  loadModule = loadDeveloperDeployModule,
  loadTimeoutMs = DEFAULT_LOAD_TIMEOUT_MS,
}: DeveloperMoatDeployRouteProps) {
  if (!session) {
    return (
      <WalletConnectionPanel
        connector={connector}
        onConnected={onConnected}
        onDisconnected={onDisconnected}
        onUseDemo={() => window.location.assign(import.meta.env.BASE_URL)}
        onBack={() => window.location.assign(import.meta.env.BASE_URL)}
      />
    );
  }

  return (
    <ConnectedDeveloperRoute
      connector={connector}
      session={session}
      onDisconnected={onDisconnected}
      loadModule={loadModule}
      loadTimeoutMs={loadTimeoutMs}
    />
  );
}

function ConnectedDeveloperRoute({
  connector,
  session,
  onDisconnected,
  loadModule,
  loadTimeoutMs,
}: Pick<DeveloperMoatDeployRouteProps, 'connector' | 'session' | 'onDisconnected'> & {
  session: ConnectedWalletSession;
  loadModule: DeveloperDeployModuleLoader;
  loadTimeoutMs: number;
}) {
  let connectedApi: ConnectedAPI;
  try {
    connectedApi = connector.getConnectedApi(session);
  } catch (error) {
    return (
      <DeveloperRouteDiagnosticView
        diagnostic={developerRouteDiagnostic('connected_api_session_lookup', error)}
        action={<button type="button" className="button button-ghost-light" onClick={onDisconnected}>Reconnect Lace</button>}
      />
    );
  }

  return (
    <LoadedDeveloperRoute
      connectedApi={connectedApi}
      session={session}
      onDisconnected={onDisconnected}
      loadModule={loadModule}
      loadTimeoutMs={loadTimeoutMs}
    />
  );
}

function LoadedDeveloperRoute({
  connectedApi,
  session,
  onDisconnected,
  loadModule,
  loadTimeoutMs,
}: {
  connectedApi: ConnectedAPI;
  session: ConnectedWalletSession;
  onDisconnected: () => void;
  loadModule: DeveloperDeployModuleLoader;
  loadTimeoutMs: number;
}) {
  const loadState = useDeveloperDeployModule(loadModule, loadTimeoutMs);
  if (loadState.status === 'loading') return <p role="status">Loading temporary deployment tooling…</p>;
  if (loadState.status === 'failed') {
    return <DeveloperRouteDiagnosticView diagnostic={loadState.diagnostic} />;
  }

  const Panel = loadState.module.MoatPreprodDeployPanel;
  return (
    <DeveloperPanelErrorBoundary onReconnect={onDisconnected}>
      <Panel session={session} connectedApi={connectedApi} />
    </DeveloperPanelErrorBoundary>
  );
}
