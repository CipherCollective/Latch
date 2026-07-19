import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { MoatProvider } from './services/moat-provider';
import { MockMoatClient } from './services/mock-moat-client';

function renderApp() {
  return render(
    <MoatProvider client={new MockMoatClient()}>
      <App />
    </MoatProvider>,
  );
}

afterEach(() => {
  Reflect.deleteProperty(window, 'midnight');
});

describe('Latch application shell', () => {
  it('explains the private gate and DeFi protocol flow', () => {
    renderApp();

    expect(screen.getByRole('heading', { level: 1, name: /every payment must pass a private gate/i })).toBeVisible();
    expect(screen.getByText(/give agents money\. not your wallet/i)).toBeVisible();
    expect(screen.getByText(/defi protocol/i)).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Delegate' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Prove' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Spend' })).toBeVisible();
    expect(screen.getByText(/Local simulation .* Contract-equivalent logic/)).toBeVisible();
    expect(screen.getByText('Built on Midnight')).toBeVisible();
    for (const proofPoint of ['Compact contract', '3 private circuits', 'Live on Preprod', 'Lace wallet', 'Revocable capabilities', 'Automated test coverage']) {
      expect(screen.getByText(proofPoint)).toBeVisible();
    }
  });

  it('labels the interactive policy simulator without claiming a wallet connection', () => {
    renderApp();

    fireEvent.click(screen.getByRole('button', { name: /interactive policy simulator/i }));

    expect(screen.getByText('Policy simulator')).toBeVisible();
    expect(screen.getByRole('heading', { level: 1, name: /set the private gate/i })).toBeVisible();
    expect(screen.getByText(/demo mode generates stable sha-256 fixtures/i)).toBeVisible();
    expect(screen.queryByText(/^connected$/i)).not.toBeInTheDocument();
  });

  it('discovers wallets without claiming a connection and preserves the demo fallback', async () => {
    renderApp();

    fireEvent.click(screen.getByRole('button', { name: /connect midnight wallet/i }));

    expect(screen.getByText('Wallet setup')).toBeVisible();
    expect(await screen.findByRole('heading', { level: 1, name: 'No wallet detected' })).toBeVisible();
    expect(screen.getByText(/install or enable a midnight wallet extension/i)).toBeVisible();
    expect(screen.queryByText(/wallet connected/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /open policy simulator/i }));
    expect(screen.getByText('Policy simulator')).toBeVisible();
    expect(screen.getByRole('heading', { level: 1, name: /set the private gate/i })).toBeVisible();
  });

  it('restores focus to the landing heading after leaving wallet setup', async () => {
    renderApp();
    fireEvent.click(screen.getByRole('button', { name: /connect midnight wallet/i }));
    await screen.findByRole('heading', { level: 1, name: 'No wallet detected' });

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(screen.getByRole('heading', { level: 1, name: /every payment must pass a private gate/i })).toHaveFocus();
  });

  it('claims a wallet connection only after validation and clears a stale focused session', async () => {
    const privateEndpoint = 'https://private-indexer.fixture.invalid/';
    const privateAddress = 'addr_private_must_not_render';
    let connectionAvailable = true;
    const getUnshieldedAddress = vi.fn(async () => privateAddress);
    const getConnectionStatus = vi.fn(async () =>
      connectionAvailable
        ? { status: 'connected' as const, networkId: 'preprod' }
        : { status: 'disconnected' as const },
    );
    const connected = {
      hintUsage: vi.fn(async () => undefined),
      getConnectionStatus,
      getConfiguration: vi.fn(async () => ({
        networkId: 'preprod',
        indexerUri: privateEndpoint,
        indexerWsUri: 'wss://private-indexer.fixture.invalid/',
        substrateNodeUri: 'wss://private-node.fixture.invalid/',
      })),
      getUnshieldedAddress,
    };
    Object.defineProperty(window, 'midnight', {
      configurable: true,
      value: {
        fixture: {
          rdns: 'dev.latch.fixture',
          name: 'Fixture wallet',
          icon: '',
          apiVersion: '4.0.1',
          connect: vi.fn(async () => connected),
        },
      },
    });
    renderApp();

    fireEvent.click(screen.getByRole('button', { name: /connect midnight wallet/i }));
    const connectButton = await screen.findByRole('button', { name: 'Connect on Preprod' });
    expect(screen.getByText('Wallet setup')).toBeVisible();
    expect(screen.queryByText(/Preprod · Wallet connected/i)).not.toBeInTheDocument();
    fireEvent.click(connectButton);

    expect(await screen.findByText('Preprod · Wallet connected')).toBeVisible();
    expect(screen.getByRole('heading', { level: 1, name: 'Midnight wallet connected' })).toBeVisible();
    expect(getUnshieldedAddress).not.toHaveBeenCalled();
    expect(document.body).not.toHaveTextContent(privateEndpoint);
    expect(document.body).not.toHaveTextContent(privateAddress);

    connectionAvailable = false;
    fireEvent.focus(window);

    await waitFor(() => expect(getConnectionStatus).toHaveBeenCalledTimes(3));
    await waitFor(() => expect(screen.getByText('Wallet setup')).toBeVisible());
    expect(screen.getByRole('heading', { level: 1, name: 'Connection needs attention' })).toBeVisible();
    expect(screen.queryByText('Preprod · Wallet connected')).not.toBeInTheDocument();
  });

  it('creates, displays, and revokes the default private capability fixture', async () => {
    renderApp();

    fireEvent.click(screen.getByRole('button', { name: /interactive policy simulator/i }));

    expect(screen.getByRole('heading', { level: 1, name: /set the private gate/i })).toBeVisible();
    expect(screen.getByLabelText(/agent name/i)).toHaveValue('Research Agent A');
    expect(screen.getByLabelText(/per-transaction limit/i)).toHaveValue('20');
    expect(screen.getByText(/agent identity and owner-agent relationship/i)).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: /commit private capability/i }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Research procurement' })).toBeVisible();
    expect(screen.getByText('Research Agent A')).toBeVisible();
    expect(screen.getByText('50')).toBeVisible();
    expect(screen.getByText(/commitments only/i)).toBeVisible();
    expect(screen.queryByText(/on-chain transaction/i)).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: /revoke capability/i }));
    expect(screen.getByText(/revoke this capability/i)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: /confirm revoke/i }));

    await waitFor(() => expect(screen.getByText('Revoked')).toBeVisible());
    expect(screen.getByText(/demo revocation fixture committed/i)).toBeVisible();
  });

  it('prevents committing an invalid amount relationship and preserves the edits', () => {
    renderApp();
    fireEvent.click(screen.getByRole('button', { name: /interactive policy simulator/i }));

    const limit = screen.getByLabelText(/per-transaction limit/i);
    fireEvent.change(limit, { target: { value: '51' } });
    fireEvent.blur(limit);

    expect(screen.getByText(/cannot exceed the total budget/i)).toBeVisible();
    expect(screen.getByRole('button', { name: /commit private capability/i })).toBeDisabled();
    expect(limit).toHaveValue('51');
  });

  it('runs the judge-facing simulator path and renders the final technical receipt', async () => {
    renderApp();
    fireEvent.click(screen.getByRole('button', { name: /interactive policy simulator/i }));
    fireEvent.click(screen.getByRole('button', { name: /commit private capability/i }));
    await screen.findByRole('heading', { name: 'Agent activity console' });
    expect(screen.getByRole('heading', { name: /Local simulation .* Contract-equivalent logic/ })).toBeVisible();
    expect(screen.getByText('createCapability')).toBeVisible();
    expect(screen.getAllByText('authorizeSpend')).toHaveLength(2);
    expect(screen.getByText('revokeCapability')).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Run approved request' }));

    expect(await screen.findByRole('heading', { name: 'Private gate passed' })).toBeVisible();
    expect(screen.getByText('Demo authorization fixture - not an on-chain transaction')).toBeVisible();
    expect(screen.getByText('38')).toBeVisible();
    expect(screen.getByText('2')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Replay same authorization' })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: 'Verify receipt' }));
    expect(await screen.findByText('Receipt verification passed.')).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Replay same authorization' }));
    expect(await screen.findByText(/already consumed and cannot be replayed/i)).toBeVisible();
    expect(screen.getByText('38')).toBeVisible();
    expect(screen.getByText('2')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Private gate passed' })).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Run rejected request' }));
    expect(await screen.findByText(/did not satisfy the private per-transaction limit/i)).toBeVisible();
    expect(screen.getByText('Receipt verification passed.')).toBeVisible();
    expect(screen.getByText('38')).toBeVisible();
    expect(screen.getByText('2')).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: /revoke capability/i }));
    fireEvent.click(screen.getByRole('button', { name: /confirm revoke/i }));

    expect(await screen.findByRole('heading', { name: 'Interactive policy simulator complete' })).toBeVisible();
    for (const outcome of [
      'Private spending policy created',
      'Valid request authorized',
      'Invalid request rejected',
      'Capability revoked',
      'Post-revocation request rejected',
      'MOAT contract deployed on Midnight Preprod',
    ]) {
      expect(screen.getByText(outcome)).toBeVisible();
    }
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    fireEvent.click(screen.getByRole('button', { name: 'Copy contract address' }));
    fireEvent.click(screen.getByRole('button', { name: 'Copy transaction ID' }));
    expect(writeText).toHaveBeenNthCalledWith(1, '3f45a282f188b82e5e8b029825a9057e2f3a295cd48b015eff73949eff8d8a25');
    expect(writeText).toHaveBeenNthCalledWith(2, '002d6d4d1f5f3965db970e14071947b895ca5a4aed76f5a0e5c8ba29384e333d64');

    fireEvent.click(screen.getByRole('button', { name: 'Restart simulator' }));
    expect(screen.getByRole('heading', { level: 1, name: /set the private gate/i })).toBeVisible();
    expect(screen.queryByText('Receipt verification passed.')).not.toBeInTheDocument();
  });

  it('opens the owner-only structured request dialog and restores focus when closed', async () => {
    renderApp();
    fireEvent.click(screen.getByRole('button', { name: /interactive policy simulator/i }));
    fireEvent.click(screen.getByRole('button', { name: /commit private capability/i }));
    await screen.findByRole('heading', { name: 'Agent activity console' });

    const inspectButtons = screen.getAllByRole('button', { name: 'View structured request' });
    const inspectCodeShield = inspectButtons[0];
    if (!inspectCodeShield) throw new Error('Expected CodeShield inspect control.');
    inspectCodeShield.focus();
    fireEvent.click(inspectCodeShield);

    expect(screen.getByRole('dialog', { name: /codeshield request/i })).toBeVisible();
    expect(screen.getByText(/req-codeshield-001/i)).toBeVisible();
    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(inspectCodeShield).toHaveFocus();
  });
});
