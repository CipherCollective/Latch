import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ViewModeToggle } from './ViewModeToggle';

describe('ViewModeToggle', () => {
  it('exposes the current view through two native pressed buttons', () => {
    const onChange = vi.fn();
    render(<ViewModeToggle value="owner" onChange={onChange} />);

    const group = screen.getByRole('group', { name: 'Workspace view' });
    const owner = screen.getByRole('button', { name: 'Owner view' });
    const observer = screen.getByRole('button', { name: 'Public observer view' });

    expect(group).toContainElement(owner);
    expect(group).toContainElement(observer);
    expect(owner).toHaveAttribute('aria-pressed', 'true');
    expect(observer).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(observer);
    expect(onChange).toHaveBeenCalledWith('observer');
  });

  it('updates the pressed state when the controlled value changes', () => {
    const { rerender } = render(<ViewModeToggle value="owner" onChange={vi.fn()} />);

    rerender(<ViewModeToggle value="observer" onChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Owner view' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Public observer view' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('disables both view actions during a guarded operation', () => {
    const onChange = vi.fn();
    render(<ViewModeToggle value="owner" onChange={onChange} disabled />);

    const owner = screen.getByRole('button', { name: 'Owner view' });
    const observer = screen.getByRole('button', { name: 'Public observer view' });
    expect(owner).toBeDisabled();
    expect(observer).toBeDisabled();

    fireEvent.click(observer);
    expect(onChange).not.toHaveBeenCalled();
  });
});
