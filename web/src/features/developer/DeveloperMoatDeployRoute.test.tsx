import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';

import type { ConnectedWalletSession, MidnightWalletConnector } from '../../wallet/midnight-wallet-connector';
import {
  DeveloperMoatDeployRoute,
  type DeveloperDeployModuleLoader,
} from './DeveloperMoatDeployRoute';

const session = {
  snapshot: { mode: 'real', connectionState: 'connected', networkId: 'preprod', walletName: 'lace' },
  configuration: { networkId: 'preprod' },
} as ConnectedWalletSession;

const api = {} as ConnectedAPI;

function route(
  loadModule: DeveloperDeployModuleLoader,
  connector: MidnightWalletConnector = {
    getConnectedApi: vi.fn(() => api),
  } as unknown as MidnightWalletConnector,
  loadTimeoutMs = 100,
) {
  return (
    <DeveloperMoatDeployRoute
      connector={connector}
      session={session}
      onConnected={vi.fn()}
      onDisconnected={vi.fn()}
      loadModule={loadModule}
      loadTimeoutMs={loadTimeoutMs}
    />
  );
}

afterEach(() => {
  vi.useRealTimers();
});

describe('DeveloperMoatDeployRoute', () => {
  it('renders the developer panel after the lazy module resolves', async () => {
    const loadModule = vi.fn<DeveloperDeployModuleLoader>().mockResolvedValue({
      MoatPreprodDeployPanel: () => <h1>Developer deployment ready</h1>,
    });

    render(route(loadModule));

    expect(screen.getByRole('status')).toHaveTextContent('Loading temporary deployment tooling');
    expect(await screen.findByRole('heading', { name: 'Developer deployment ready' })).toBeVisible();
    expect(loadModule).toHaveBeenCalledTimes(1);
  });

  it('shows a privacy-safe diagnostic when the lazy import rejects', async () => {
    const privateValue = 'addr_private_must_not_render';
    const loadModule = vi.fn<DeveloperDeployModuleLoader>().mockRejectedValue(new TypeError(privateValue));

    render(route(loadModule));

    expect(await screen.findByText('dynamic_import')).toBeVisible();
    expect(screen.getByText('TypeError')).toBeVisible();
    expect(document.body).not.toHaveTextContent(privateValue);
  });

  it('identifies a lazy module initialization failure without exposing its message', async () => {
    const privateValue = 'private_module_value_must_not_render';
    const loadModule = vi.fn<DeveloperDeployModuleLoader>().mockRejectedValue(new ReferenceError(privateValue));

    render(route(loadModule));

    expect(await screen.findByText('module_initialization')).toBeVisible();
    expect(screen.getByText('ReferenceError')).toBeVisible();
    expect(document.body).not.toHaveTextContent(privateValue);
  });

  it('times out when the lazy import never resolves', async () => {
    vi.useFakeTimers();
    const loadModule = vi.fn<DeveloperDeployModuleLoader>().mockReturnValue(new Promise(() => undefined));

    render(route(loadModule, undefined, 50));
    await act(async () => vi.advanceTimersByTimeAsync(51));

    expect(screen.getByText('dynamic_import_timeout')).toBeVisible();
    expect(screen.queryByText('Loading temporary deployment tooling…')).not.toBeInTheDocument();
  });

  it('reports a missing ConnectedAPI without starting the lazy import', () => {
    const privateValue = 'wallet_payload_must_not_render';
    const connector = {
      getConnectedApi: vi.fn(() => {
        throw new Error(privateValue);
      }),
    } as unknown as MidnightWalletConnector;
    const loadModule = vi.fn<DeveloperDeployModuleLoader>();

    render(route(loadModule, connector));

    expect(screen.getByText('connected_api_session_lookup')).toBeVisible();
    expect(document.body).not.toHaveTextContent(privateValue);
    expect(loadModule).not.toHaveBeenCalled();
  });

  it('contains panel render failures inside the developer route boundary', async () => {
    const privateValue = 'configuration_value_must_not_render';
    const loadModule = vi.fn<DeveloperDeployModuleLoader>().mockResolvedValue({
      MoatPreprodDeployPanel: () => {
        throw new RangeError(privateValue);
      },
    });

    render(route(loadModule));

    expect(await screen.findByText('panel_render')).toBeVisible();
    expect(screen.getByText('RangeError')).toBeVisible();
    expect(document.body).not.toHaveTextContent(privateValue);
  });
});
