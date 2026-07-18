import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ProofStep } from '../../types/domain';
import { ProofProgress } from './ProofProgress';

const steps: ProofStep[] = [
  { id: 'prepare-witness', label: 'Prepare private witness', status: 'passed', safeDetail: 'Witness prepared locally.' },
  { id: 'derive-destination', label: 'Derive destination', status: 'running' },
  { id: 'open-policy', label: 'Open policy commitment', status: 'waiting' },
  { id: 'evaluate-constraints', label: 'Evaluate constraints', status: 'failed' },
];

describe('ProofProgress', () => {
  it('renders exactly the client-supplied steps with visible status text', () => {
    render(<ProofProgress steps={steps} busy requestLabel="CodeShield request" />);

    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(steps.length);
    expect(within(rows[0]!).getByText('Passed')).toBeVisible();
    expect(within(rows[1]!).getByText('Running')).toBeVisible();
    expect(within(rows[2]!).getByText('Waiting')).toBeVisible();
    expect(within(rows[3]!).getByText('Failed')).toBeVisible();
    expect(screen.getByText('Witness prepared locally.')).toBeVisible();
    expect(screen.getByText('CodeShield request')).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent('Authorization rejected.');
  });

  it('does not manufacture proof rows when the client supplies none', () => {
    render(<ProofProgress steps={[]} busy={false} />);

    expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
    expect(screen.getByText(/proof steps will appear when the authorization client reports them/i)).toBeVisible();
  });

  it('announces completion only after all supplied steps pass and work is no longer busy', () => {
    const completeSteps: ProofStep[] = steps.slice(0, 2).map((step) => ({ ...step, status: 'passed' }));
    render(<ProofProgress steps={completeSteps} busy={false} />);

    expect(screen.getByRole('status')).toHaveTextContent('Authorization proof completed.');
  });
});
