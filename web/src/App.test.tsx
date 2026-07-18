import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App';

describe('Latch application shell', () => {
  it('explains the private gate and DeFi protocol flow', () => {
    render(<App />);

    expect(screen.getByRole('heading', { level: 1, name: /every payment must pass a private gate/i })).toBeVisible();
    expect(screen.getByText(/give agents money\. not your wallet/i)).toBeVisible();
    expect(screen.getByText(/defi protocol/i)).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Delegate' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Prove' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Spend' })).toBeVisible();
  });

  it('labels deterministic demo mode without claiming a wallet connection', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /use deterministic demo/i }));

    expect(screen.getByText('Demo mode selected')).toBeVisible();
    expect(screen.getByText(/deterministic fixture\. never presented as an on-chain transaction/i)).toBeVisible();
    expect(screen.queryByText(/^connected$/i)).not.toBeInTheDocument();
  });

  it('does not claim wallet connection before a compatible wallet confirms it', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /connect midnight wallet/i }));

    expect(screen.getByText('Wallet mode selected')).toBeVisible();
    expect(screen.getByText(/connection is not claimed until a compatible wallet confirms it/i)).toBeVisible();
  });
});
