export function BrandMark({ onNavigateHome }: { onNavigateHome?: () => void }) {
  return (
    <a className="brand" href="#top" aria-label="Latch home" onClick={(event) => {
      if (!onNavigateHome) return;
      event.preventDefault();
      onNavigateHome();
    }}>
      <span className="brand-symbol" aria-hidden="true">
        <span />
      </span>
      <span className="brand-word">Latch</span>
    </a>
  );
}
