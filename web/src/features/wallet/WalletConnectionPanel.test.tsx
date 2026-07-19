import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { PublicClientError } from '../../types/domain';
import {
  MidnightWalletConnector,
  type ConnectedWalletSession,
  type WalletOption,
} from '../../wallet/midnight-wallet-connector';
import { WalletConnectionPanel } from './WalletConnectionPanel';

const compatibleWallet = (overrides: Partial<WalletOption> = {}): WalletOption => ({
  id: 'wallet-1',
  name: 'Nightly',
  apiVersion: '4.0.1',
  compatible: true,
  ...overrides,
});

const publicError = (code: PublicClientError['code']): PublicClientError => ({
  code,
  message: 'Sanitized connector error.',
  retryable: true,
});

const connectedSession = (walletName = 'Nightly'): ConnectedWalletSession =>
  ({
    snapshot: {
      mode: 'real',
      connectionState: 'connected',
      networkId: 'preprod',
      walletName,
    },
    configuration: {},
  }) as ConnectedWalletSession;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function mockConnector(wallets: WalletOption[] = []) {
  return {
    discover: vi.fn(() => wallets),
    connect: vi.fn<MidnightWalletConnector['connect']>(),
    revalidate: vi.fn<MidnightWalletConnector['revalidate']>((session) => Promise.resolve(session)),
    reportReactState: vi.fn<MidnightWalletConnector['reportReactState']>(),
  } as unknown as MidnightWalletConnector;
}

function renderPanel(connector: MidnightWalletConnector) {
  const handlers = {
    onConnected: vi.fn(),
    onDisconnected: vi.fn(),
    onUseDemo: vi.fn(),
    onBack: vi.fn(),
  };
  render(<WalletConnectionPanel connector={connector} {...handlers} />);
  return handlers;
}

describe('WalletConnectionPanel', () => {
  it('announces discovery, then shows the no-wallet state with recovery and demo actions', async () => {
    const connector = mockConnector([]);
    const handlers = renderPanel(connector);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Discovering Midnight wallets');
    expect(await screen.findByRole('heading', { level: 1, name: 'No wallet detected' })).toHaveFocus();
    expect(screen.getByText('Requested network:')).toHaveTextContent('Preprod');

    fireEvent.click(screen.getByRole('button', { name: 'Refresh wallets' }));
    await waitFor(() => expect(connector.discover).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole('button', { name: 'Open policy simulator' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(handlers.onUseDemo).toHaveBeenCalledTimes(1);
    expect(handlers.onBack).toHaveBeenCalledTimes(1);
  });

  it('recovers from no wallet after refresh discovers a compatible wallet', async () => {
    const wallet = compatibleWallet();
    const connector = mockConnector();
    vi.mocked(connector.discover).mockReturnValueOnce([]).mockReturnValueOnce([wallet]);
    renderPanel(connector);

    await screen.findByRole('heading', { level: 1, name: 'No wallet detected' });
    fireEvent.click(screen.getByRole('button', { name: 'Refresh wallets' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Connect your Midnight wallet' })).toHaveFocus();
    expect(screen.getByRole('radio', { name: /Nightly/ })).toBeChecked();
  });

  it('replaces the wallet list on refresh instead of retaining stale entries', async () => {
    const staleWallet = compatibleWallet({ name: 'Stale Lace wrapper' });
    const currentWallet = compatibleWallet({ id: 'wallet-2', name: 'lace' });
    const connector = mockConnector();
    vi.mocked(connector.discover).mockReturnValueOnce([staleWallet]).mockReturnValueOnce([currentWallet]);
    renderPanel(connector);

    expect(await screen.findByRole('radio', { name: /Stale Lace wrapper/ })).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Refresh wallets' }));

    expect(await screen.findByRole('radio', { name: /^lace/ })).toBeChecked();
    expect(screen.queryByRole('radio', { name: /Stale Lace wrapper/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(1);
  });

  it('sanitizes a discovery exception and recovers by retrying discovery', async () => {
    const connector = mockConnector();
    vi.mocked(connector.discover)
      .mockImplementationOnce(() => {
        throw publicError('WALLET_DISCOVERY_FAILED');
      })
      .mockReturnValueOnce([compatibleWallet()]);
    renderPanel(connector);

    expect(await screen.findByRole('heading', { level: 1, name: 'Connection needs attention' })).toHaveFocus();
    expect(screen.getByRole('alert')).toHaveTextContent('could not inspect the wallet connectors');
    fireEvent.click(screen.getByRole('button', { name: 'Retry discovery' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Connect your Midnight wallet' })).toHaveFocus();
    expect(screen.getByRole('radio', { name: /Nightly/ })).toBeChecked();
  });

  it('lists incompatible wallets safely and offers refresh rather than connection', async () => {
    const connector = mockConnector([
      compatibleWallet({
        compatible: false,
        apiVersion: '3.2.0',
        incompatibilityReason: 'This wallet uses an unsupported connector API version.',
      }),
    ]);
    renderPanel(connector);

    expect(await screen.findByRole('heading', { level: 1, name: 'No usable wallet connector' })).toHaveFocus();
    const unsupported = screen.getByRole('heading', { level: 3, name: 'Detected but unsupported' }).parentElement;
    expect(unsupported).not.toBeNull();
    expect(within(unsupported as HTMLElement).getByText('Nightly')).toBeVisible();
    expect(within(unsupported as HTMLElement).getByText('Connector API 3.2.0')).toBeVisible();
    expect(within(unsupported as HTMLElement).getByText(/unsupported connector API version/i)).toBeVisible();
    expect(screen.queryByRole('button', { name: /Connect on/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refresh wallets' })).toBeEnabled();
  });

  it('preselects one compatible wallet but never auto-connects', async () => {
    const connector = mockConnector([compatibleWallet()]);
    renderPanel(connector);

    const option = await screen.findByRole('radio', { name: /Nightly/ });
    expect(option).toBeChecked();
    expect(connector.connect).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Connect on Preprod' })).toBeEnabled();
  });

  it('requires explicit selection when multiple compatible wallets are present', async () => {
    const connector = mockConnector([
      compatibleWallet(),
      compatibleWallet({ id: 'wallet-2', name: 'Lace Midnight', apiVersion: '4.1.0' }),
    ]);
    vi.mocked(connector.connect).mockResolvedValue(connectedSession('Lace Midnight'));
    renderPanel(connector);

    const connectButton = await screen.findByRole('button', { name: 'Connect on Preprod' });
    expect(connectButton).toBeDisabled();
    expect(screen.getAllByRole('radio')).toHaveLength(2);

    fireEvent.click(screen.getByRole('radio', { name: /Lace Midnight/ }));
    expect(connectButton).toBeEnabled();
    fireEvent.click(connectButton);

    await waitFor(() => expect(connector.connect).toHaveBeenCalledWith('wallet-2', 'preprod'));
  });

  it('keeps the wallet choice visible while a connection request is pending', async () => {
    const pending = deferred<ConnectedWalletSession>();
    const connector = mockConnector([compatibleWallet()]);
    vi.mocked(connector.connect).mockReturnValue(pending.promise);
    renderPanel(connector);
    const connectButton = await screen.findByRole('button', { name: 'Connect on Preprod' });

    fireEvent.click(connectButton);

    expect(await screen.findByRole('heading', { level: 1, name: 'Confirm in your wallet' })).toHaveFocus();
    expect(screen.getByRole('radio', { name: /Nightly/ })).toBeVisible();
    expect(screen.getByRole('radio', { name: /Nightly/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Waiting for wallet…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Open policy simulator' })).toBeEnabled();

    pending.resolve(connectedSession());
    await screen.findByRole('heading', { level: 1, name: 'Midnight wallet connected' });
  });

  it('deduplicates rapid connection activation before React rerenders', async () => {
    const pending = deferred<ConnectedWalletSession>();
    const connector = mockConnector([compatibleWallet()]);
    vi.mocked(connector.connect).mockReturnValue(pending.promise);
    renderPanel(connector);
    const connectButton = await screen.findByRole('button', { name: 'Connect on Preprod' });

    fireEvent.click(connectButton);
    fireEvent.click(connectButton);

    expect(connector.connect).toHaveBeenCalledTimes(1);
    pending.resolve(connectedSession());
    await screen.findByRole('heading', { level: 1, name: 'Midnight wallet connected' });
  });

  it.each([
    ['USER_REJECTED', 'connection request was declined'],
    ['WALLET_LOCKED', 'Unlock and sync your wallet'],
    ['WRONG_NETWORK', 'Latch requested Preprod'],
    ['AUTHORIZATION_TIMEOUT', 'approval did not finish in time'],
    ['PROVIDER_DISAPPEARED', 'changed or removed its provider'],
    ['CONNECTOR_ERROR', 'unexpected connector response'],
    ['INCOMPATIBLE_WALLET', 'connector version is not supported'],
  ] as const)('shows a safe %s error with recovery', async (code, expectedCopy) => {
    const connector = mockConnector([compatibleWallet()]);
    vi.mocked(connector.connect).mockRejectedValue(publicError(code));
    renderPanel(connector);

    fireEvent.click(await screen.findByRole('button', { name: 'Connect on Preprod' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Connection needs attention' })).toHaveFocus();
    expect(screen.getByRole('alert')).toHaveTextContent(expectedCopy);
    expect(screen.getByRole('button', { name: 'Retry connection' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Refresh wallets' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Open policy simulator' })).toBeEnabled();
  });

  it('retries a declined connection and launches the interactive policy simulator', async () => {
    const session = connectedSession();
    const connector = mockConnector([compatibleWallet()]);
    vi.mocked(connector.connect)
      .mockRejectedValueOnce(publicError('USER_REJECTED'))
      .mockResolvedValueOnce(session);
    const handlers = renderPanel(connector);

    fireEvent.click(await screen.findByRole('button', { name: 'Connect on Preprod' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Retry connection' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Midnight wallet connected' })).toHaveFocus();
    expect(screen.getByText('Connected to Preprod')).toBeVisible();
    expect(screen.getByText(/Your Lace wallet is connected on Preprod, and the MOAT contract is live/i)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Launch policy simulator' }));
    expect(handlers.onUseDemo).toHaveBeenCalledOnce();
    expect(handlers.onConnected).toHaveBeenCalledWith(session);
    expect(connector.reportReactState).toHaveBeenCalledWith('connecting');
    expect(connector.reportReactState).toHaveBeenLastCalledWith('connected');
  });

  it('shows copyable Preprod deployment proof without rendering wallet-private values', async () => {
    const contractAddress = '3f45a282f188b82e5e8b029825a9057e2f3a295cd48b015eff73949eff8d8a25';
    const transactionId = '002d6d4d1f5f3965db970e14071947b895ca5a4aed76f5a0e5c8ba29384e333d64';
    const privateSentinels = ['addr_private_sentinel', 'balance_private_sentinel', 'seed_private_sentinel'];
    const session = {
      ...connectedSession('Lace'),
      walletAddress: privateSentinels[0],
      balance: privateSentinels[1],
      seed: privateSentinels[2],
    } as ConnectedWalletSession;
    const connector = mockConnector([compatibleWallet({ name: 'Lace' })]);
    vi.mocked(connector.connect).mockResolvedValue(session);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    renderPanel(connector);

    fireEvent.click(await screen.findByRole('button', { name: 'Connect on Preprod' }));
    await screen.findByRole('heading', { level: 1, name: 'Midnight wallet connected' });
    fireEvent.click(screen.getByText('View Preprod deployment proof'));

    expect(screen.getByText('Midnight Preprod')).toBeVisible();
    expect(screen.getByText('Contract deployed')).toBeVisible();
    expect(screen.getByText(contractAddress)).toBeVisible();
    expect(screen.getByText(transactionId)).toBeVisible();
    expect(screen.getByText(/Deployment proof only/i)).toBeVisible();
    expect(screen.getByText(/not a live capability transaction/i)).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Copy contract address' }));
    fireEvent.click(screen.getByRole('button', { name: 'Copy transaction ID' }));
    expect(writeText).toHaveBeenNthCalledWith(1, contractAddress);
    expect(writeText).toHaveBeenNthCalledWith(2, transactionId);
    for (const privateValue of privateSentinels) {
      expect(screen.queryByText(privateValue)).not.toBeInTheDocument();
    }
  });

  it('downgrades a stale connected session when focus revalidation fails', async () => {
    const session = connectedSession();
    const connector = mockConnector([compatibleWallet()]);
    vi.mocked(connector.connect).mockResolvedValue(session);
    vi.mocked(connector.revalidate).mockRejectedValue(publicError('WRONG_NETWORK'));
    const handlers = renderPanel(connector);

    fireEvent.click(await screen.findByRole('button', { name: 'Connect on Preprod' }));
    await screen.findByRole('heading', { level: 1, name: 'Midnight wallet connected' });
    fireEvent.focus(window);

    await waitFor(() => expect(connector.revalidate).toHaveBeenCalledOnce());
    expect(await screen.findByRole('heading', { level: 1, name: 'Connection needs attention' })).toHaveFocus();
    expect(screen.getByRole('alert')).toHaveTextContent('Switch your wallet to Preprod');
    expect(handlers.onDisconnected).toHaveBeenCalledOnce();
    expect(connector.reportReactState).toHaveBeenLastCalledWith('disconnected', 'WRONG_NETWORK');
    expect(screen.queryByText('Connected to Preprod')).not.toBeInTheDocument();
  });

  it('renders hostile wallet metadata as inert text and refuses a remote tracking icon', async () => {
    const hostileName = '<img src=x onerror="globalThis.pwned=true">';
    const connector = mockConnector([
      compatibleWallet({
        name: hostileName,
        apiVersion: '<script>alert(1)</script>',
        iconUrl: 'https://tracker.example/wallet.png',
      }),
    ]);
    const { container } = render(
      <WalletConnectionPanel
        connector={connector}
        onConnected={vi.fn()}
        onDisconnected={vi.fn()}
        onUseDemo={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    expect(await screen.findByText(hostileName)).toBeVisible();
    expect(screen.getByText('Connector API <script>alert(1)</script>')).toBeVisible();
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('[onerror]')).toBeNull();
  });

  it('invalidates a pending connection when the user chooses Demo mode', async () => {
    const pending = deferred<ConnectedWalletSession>();
    const connector = mockConnector([compatibleWallet()]);
    vi.mocked(connector.connect).mockReturnValue(pending.promise);
    const handlers = renderPanel(connector);

    fireEvent.click(await screen.findByRole('button', { name: 'Connect on Preprod' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open policy simulator' }));
    pending.resolve(connectedSession());
    await Promise.resolve();

    expect(handlers.onUseDemo).toHaveBeenCalledTimes(1);
    expect(handlers.onConnected).not.toHaveBeenCalled();
  });

  it('invalidates a pending connection when the user returns to the landing page', async () => {
    const pending = deferred<ConnectedWalletSession>();
    const connector = mockConnector([compatibleWallet()]);
    vi.mocked(connector.connect).mockReturnValue(pending.promise);
    const handlers = renderPanel(connector);

    fireEvent.click(await screen.findByRole('button', { name: 'Connect on Preprod' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    pending.resolve(connectedSession());
    await Promise.resolve();

    expect(handlers.onBack).toHaveBeenCalledTimes(1);
    expect(handlers.onConnected).not.toHaveBeenCalled();
  });
});
