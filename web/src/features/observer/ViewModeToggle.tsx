export type ViewMode = 'owner' | 'observer';

interface ViewModeToggleProps {
  value: ViewMode;
  onChange: (value: ViewMode) => void;
  disabled?: boolean;
}

export function ViewModeToggle({ value, onChange, disabled = false }: ViewModeToggleProps) {
  return (
    <div className="view-mode-toggle" role="group" aria-label="Workspace view">
      <button
        className="view-mode-option"
        type="button"
        aria-pressed={value === 'owner'}
        disabled={disabled}
        onClick={() => onChange('owner')}
      >
        Owner view
      </button>
      <button
        className="view-mode-option"
        type="button"
        aria-pressed={value === 'observer'}
        disabled={disabled}
        onClick={() => onChange('observer')}
      >
        Public observer view
      </button>
    </div>
  );
}
