import { ArrowRight, Play, WalletCards } from 'lucide-react';

interface ModeChooserProps {
  onDemo: () => void;
  onWallet: () => void;
}

export function ModeChooser({ onDemo, onWallet }: ModeChooserProps) {
  return (
    <div className="mode-actions" aria-label="Choose how to use Latch">
      <button type="button" className="button button-primary" onClick={onDemo}>
        <Play aria-hidden="true" size={18} fill="currentColor" />
        Interactive policy simulator
        <ArrowRight aria-hidden="true" size={17} />
      </button>
      <button type="button" className="button button-secondary" onClick={onWallet}>
        <WalletCards aria-hidden="true" size={18} />
        Connect Midnight wallet
      </button>
    </div>
  );
}
