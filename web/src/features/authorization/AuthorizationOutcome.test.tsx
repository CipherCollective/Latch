import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { serializeOwnerReceipt } from '../../lib/receipt-serialization';
import type { AuthorizationReceipt, AuthorizationResult } from '../../types/domain';
import { AuthorizationOutcome } from './AuthorizationOutcome';

const demoReceipt: AuthorizationReceipt = {
  capabilityId: 'cap_fixture_123',
  requestCommitment: 'req_commitment_123',
  receiptCommitment: 'receipt_commitment_123',
  nullifier: 'nullifier_123',
  oneTimeDestination: {
    destination: 'demo_destination_123',
    ephemeralPublicKey: 'ephemeral_public_key_123',
    viewTag: 'view_tag_123',
    fixture: true,
  },
  tx: {
    kind: 'demo-fixture',
    networkId: 'demo',
  },
};

const rejected: Extract<AuthorizationResult, { status: 'rejected' }> = {
  status: 'rejected',
  proofSteps: [],
  publicMessage: 'Authorization rejected. No private policy values were disclosed.',
  privateReason: 'PER_TX_LIMIT',
};

describe('AuthorizationOutcome', () => {
  it('maps a private rejection code without echoing policy amounts and retains the generic public result', () => {
    render(<AuthorizationOutcome receipt={null} rejection={rejected} verification="idle" onVerify={vi.fn()} />);

    expect(screen.getByText('This request did not satisfy the private per-transaction limit.')).toBeVisible();
    expect(screen.getByText(rejected.publicMessage)).toBeVisible();
    expect(screen.queryByText(/\b20\b|\b50\b/)).not.toBeInTheDocument();
  });

  it('renders an approved demo receipt with an explicit fixture disclaimer and expandable destination details', () => {
    render(<AuthorizationOutcome receipt={demoReceipt} rejection={null} verification="verified" onVerify={vi.fn()} />);

    expect(screen.getByText('Fixture authorization verified')).toBeVisible();
    expect(screen.getByText('Demo authorization fixture - not an on-chain transaction')).toBeVisible();
    expect(screen.getByText('Demo one-time destination fixture')).toBeVisible();
    expect(screen.getByText('What this demo receipt exposes')).toBeVisible();
    expect(screen.getByText('What this demo receipt omits')).toBeVisible();
    expect(screen.queryByText('What the chain learned')).not.toBeInTheDocument();
    expect(screen.getByText(demoReceipt.oneTimeDestination.destination)).toBeVisible();
    expect(screen.getByText('Ephemeral destination details')).toBeVisible();
    expect(screen.getByText('Receipt verification passed.')).toBeVisible();
    expect(screen.queryByText(/transaction hash/i)).not.toBeInTheDocument();
  });

  it('copies only the serialized owner receipt and invokes independent verification', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    const onVerify = vi.fn().mockResolvedValue(undefined);

    render(<AuthorizationOutcome receipt={demoReceipt} rejection={null} verification="idle" onVerify={onVerify} />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy receipt JSON' }));
    fireEvent.click(screen.getByRole('button', { name: 'Verify receipt' }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(serializeOwnerReceipt(demoReceipt)));
    await waitFor(() => expect(onVerify).toHaveBeenCalledTimes(1));
    expect(screen.getAllByRole('status').some((status) => status.textContent === 'Receipt JSON copied.')).toBe(true);
  });

  it('links a real transaction only through a validated HTTPS explorer URL', () => {
    const realReceipt: AuthorizationReceipt = {
      ...demoReceipt,
      oneTimeDestination: { ...demoReceipt.oneTimeDestination, fixture: false },
      tx: {
        kind: 'midnight-transaction',
        networkId: 'preprod',
        txHash: 'tx_hash_123',
        explorerUrl: 'https://explorer.example/tx/tx_hash_123',
      },
    };
    const { rerender } = render(
      <AuthorizationOutcome receipt={realReceipt} rejection={null} verification="idle" onVerify={vi.fn()} />,
    );

    expect(screen.getByText('tx_hash_123')).toBeVisible();
    expect(screen.getByRole('link', { name: /view transaction in explorer/i })).toHaveAttribute(
      'href',
      'https://explorer.example/tx/tx_hash_123',
    );

    rerender(
      <AuthorizationOutcome
        receipt={{ ...realReceipt, tx: { ...realReceipt.tx, explorerUrl: 'javascript:alert(1)' } }}
        rejection={null}
        verification="idle"
        onVerify={vi.fn()}
      />,
    );
    expect(screen.queryByRole('link', { name: /view transaction in explorer/i })).not.toBeInTheDocument();
  });

  it('shows a new rejection before the previously approved receipt', () => {
    render(<AuthorizationOutcome receipt={demoReceipt} rejection={rejected} verification="idle" onVerify={vi.fn()} />);

    const headings = screen.getAllByRole('heading', { level: 2 });
    expect(headings.map((heading) => heading.textContent)).toEqual(['Authorization rejected', 'Private gate passed']);
  });
});
