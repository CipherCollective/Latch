import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  PUBLIC_REJECTION_MESSAGE,
  serializeObserverReceipt,
  type ObserverWorkspaceModel,
} from '../../privacy/observer-serializer';
import { ObserverWorkspace } from './ObserverWorkspace';

const CAPABILITY_ID = 'cap_public_123';
const POLICY_COMMITMENT = `0x${'1'.repeat(64)}`;
const SPEND_STATE_COMMITMENT = `0x${'2'.repeat(64)}`;
const REQUEST_COMMITMENT = `0x${'3'.repeat(64)}`;
const RECEIPT_COMMITMENT = `0x${'4'.repeat(64)}`;
const NULLIFIER = `0x${'5'.repeat(64)}`;

const receipt: NonNullable<ObserverWorkspaceModel['receipt']> = {
  capabilityId: CAPABILITY_ID,
  requestCommitment: REQUEST_COMMITMENT,
  receiptCommitment: RECEIPT_COMMITMENT,
  nullifier: NULLIFIER,
  capabilityStatus: 'active',
  proofStatus: 'approved',
  verificationStatus: 'idle',
};

const approvedModel: ObserverWorkspaceModel = {
  capability: {
    capabilityId: CAPABILITY_ID,
    status: 'active',
    policyCommitment: POLICY_COMMITMENT,
    spendStateCommitment: SPEND_STATE_COMMITMENT,
  },
  proof: {
    overall: 'approved',
    steps: [
      { label: 'Authorization inputs prepared', status: 'passed' },
      { label: 'Receipt commitment recorded', status: 'passed' },
    ],
  },
  receipt,
  rejection: null,
  transcript: ['Private purchase request submitted', 'Authorization result received'],
};

describe('ObserverWorkspace', () => {
  it('renders one public heading and the complete allowlisted projection', () => {
    render(<ObserverWorkspace model={approvedModel} onVerifyReceipt={vi.fn()} />);

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1, name: 'Public observer' })).toBeVisible();
    expect(screen.getByText('Public observer · allowlisted projection')).toBeVisible();
    expect(screen.getAllByText(CAPABILITY_ID)).toHaveLength(2);
    expect(screen.getByText(POLICY_COMMITMENT)).toBeVisible();
    expect(screen.getByText(SPEND_STATE_COMMITMENT)).toBeVisible();
    expect(screen.getByText(REQUEST_COMMITMENT)).toBeVisible();
    expect(screen.getByText(RECEIPT_COMMITMENT)).toBeVisible();
    expect(screen.getByText(NULLIFIER)).toBeVisible();
    expect(screen.getByText('Private purchase request submitted')).toBeVisible();
    expect(screen.getByText('Authorization result received')).toBeVisible();

    expect(screen.queryByRole('list', { name: 'Public proof steps' })).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent('Authorization inputs prepared');
    expect(document.body).not.toHaveTextContent('Receipt commitment recorded');
    expect(screen.getByText(/per-step labels, timing, and failure locations are not included/i)).toBeVisible();
    expect(document.body).toHaveTextContent('Overall demo evaluation status: Fixture approved.');
  });

  it('renders only the exact public rejection and no injected values', () => {
    const hostileModel = {
      ...approvedModel,
      proof: { overall: 'rejected', steps: [] },
      receipt: null,
      rejection: PUBLIC_REJECTION_MESSAGE,
      ownerState: {
        agentName: 'INJECTED_AGENT',
        merchant: 'INJECTED_MERCHANT',
      },
      transcript: ['Private purchase request submitted'],
    } as unknown as ObserverWorkspaceModel;

    render(<ObserverWorkspace model={hostileModel} onVerifyReceipt={vi.fn()} />);

    expect(screen.getByRole('alert')).toHaveTextContent(PUBLIC_REJECTION_MESSAGE);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Authorization rejected. No private policy values were disclosed.',
    );
    expect(document.body).not.toHaveTextContent(/INJECTED_/);
    expect(screen.queryByRole('button', { name: 'Copy public receipt JSON' })).not.toBeInTheDocument();
  });

  it('copies through the observer serializer and calls the verification callback', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    const onVerifyReceipt = vi.fn().mockResolvedValue(undefined);

    render(<ObserverWorkspace model={approvedModel} onVerifyReceipt={onVerifyReceipt} />);

    fireEvent.click(screen.getByRole('button', { name: 'Copy public receipt JSON' }));
    fireEvent.click(screen.getByRole('button', { name: 'Verify receipt' }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(serializeObserverReceipt(receipt)));
    await waitFor(() => expect(onVerifyReceipt).toHaveBeenCalledTimes(1));
    expect(screen.getAllByRole('status').some((node) => node.textContent === 'Public receipt JSON copied.')).toBe(true);
  });

  it('announces safe failures without exposing thrown error details', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('INJECTED_CLIPBOARD_DETAIL'));
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    const onVerifyReceipt = vi.fn().mockRejectedValue(new Error('INJECTED_VERIFICATION_DETAIL'));

    render(<ObserverWorkspace model={approvedModel} onVerifyReceipt={onVerifyReceipt} />);

    fireEvent.click(screen.getByRole('button', { name: 'Copy public receipt JSON' }));
    fireEvent.click(screen.getByRole('button', { name: 'Verify receipt' }));

    await waitFor(() => expect(screen.getByText('Receipt verification could not complete.')).toBeVisible());
    await waitFor(() =>
      expect(
        screen.getAllByRole('status').some((node) => node.textContent === 'Public receipt JSON could not be copied.'),
      ).toBe(true),
    );
    expect(document.body).not.toHaveTextContent('INJECTED_CLIPBOARD_DETAIL');
    expect(document.body).not.toHaveTextContent('INJECTED_VERIFICATION_DETAIL');
  });

  it('disables verification while the model reports an in-flight check', () => {
    const verifyingModel: ObserverWorkspaceModel = {
      ...approvedModel,
      receipt: { ...receipt, verificationStatus: 'verifying' },
    };

    render(<ObserverWorkspace model={verifyingModel} onVerifyReceipt={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Verifying receipt…' })).toBeDisabled();
    expect(screen.getAllByText('Verification in progress')).toHaveLength(2);
  });
});
