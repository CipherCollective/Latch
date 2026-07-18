import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
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

describe('Latch application shell', () => {
  it('explains the private gate and DeFi protocol flow', () => {
    renderApp();

    expect(screen.getByRole('heading', { level: 1, name: /every payment must pass a private gate/i })).toBeVisible();
    expect(screen.getByText(/give agents money\. not your wallet/i)).toBeVisible();
    expect(screen.getByText(/defi protocol/i)).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Delegate' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Prove' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Spend' })).toBeVisible();
  });

  it('labels deterministic demo mode without claiming a wallet connection', () => {
    renderApp();

    fireEvent.click(screen.getByRole('button', { name: /use deterministic demo/i }));

    expect(screen.getByText('Demo mode')).toBeVisible();
    expect(screen.getByRole('heading', { level: 1, name: /set the private gate/i })).toBeVisible();
    expect(screen.getByText(/demo mode generates stable sha-256 fixtures/i)).toBeVisible();
    expect(screen.queryByText(/^connected$/i)).not.toBeInTheDocument();
  });

  it('does not claim wallet connection before a compatible wallet confirms it', () => {
    renderApp();

    fireEvent.click(screen.getByRole('button', { name: /connect midnight wallet/i }));

    expect(screen.getByText('Wallet mode selected')).toBeVisible();
    expect(screen.getByText(/connection is not claimed until a compatible wallet confirms it/i)).toBeVisible();
  });

  it('creates, displays, and revokes the default private capability fixture', async () => {
    renderApp();

    fireEvent.click(screen.getByRole('button', { name: /use deterministic demo/i }));

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
    fireEvent.click(screen.getByRole('button', { name: /use deterministic demo/i }));

    const limit = screen.getByLabelText(/per-transaction limit/i);
    fireEvent.change(limit, { target: { value: '51' } });
    fireEvent.blur(limit);

    expect(screen.getByText(/cannot exceed the total budget/i)).toBeVisible();
    expect(screen.getByRole('button', { name: /commit private capability/i })).toBeDisabled();
    expect(limit).toHaveValue('51');
  });

  it('runs the approved, rejected, replay, receipt-verification, and reset demo path', async () => {
    renderApp();
    fireEvent.click(screen.getByRole('button', { name: /use deterministic demo/i }));
    fireEvent.click(screen.getByRole('button', { name: /commit private capability/i }));
    await screen.findByRole('heading', { name: 'Agent activity console' });

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

    fireEvent.click(screen.getByRole('button', { name: 'Reset demo' }));
    expect(screen.getByRole('heading', { level: 1, name: /set the private gate/i })).toBeVisible();
    expect(screen.queryByText('Receipt verification passed.')).not.toBeInTheDocument();
  });

  it('opens the owner-only structured request dialog and restores focus when closed', async () => {
    renderApp();
    fireEvent.click(screen.getByRole('button', { name: /use deterministic demo/i }));
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
