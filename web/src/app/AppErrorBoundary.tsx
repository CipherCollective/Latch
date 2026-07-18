import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  failed: boolean;
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo): void {
    // Deliberately do not log raw errors: provider payloads may contain private data.
  }

  render(): ReactNode {
    if (this.state.failed) {
      return (
        <main className="fatal-state" id="main-content">
          <div className="fatal-card" role="alert" aria-live="assertive">
            <span className="eyebrow">Latch recovered safely</span>
            <h1>Something interrupted the private gate.</h1>
            <p>No policy data was displayed or sent. Reload to start a clean session.</p>
            <button type="button" className="button button-primary" onClick={() => window.location.reload()}>
              Reload Latch
            </button>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}
