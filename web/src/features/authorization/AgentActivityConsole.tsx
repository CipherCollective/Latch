import { useEffect, useId, useRef, useState } from 'react';
import { Braces, Database, Play, RefreshCcw, RotateCcw, ShieldAlert, X } from 'lucide-react';
import { ALPHA_SIGNAL_REQUEST, CODE_SHIELD_REQUEST } from '../../demo/requests';
import type { SpendRequest } from '../../types/domain';

export type DemoRequestKind = 'approved' | 'rejected' | 'replay';

export interface ActivityEvent {
  id: string;
  label: string;
}

interface AgentActivityConsoleProps {
  capabilityStatus: 'active' | 'revoked';
  busy: boolean;
  canReplay: boolean;
  events: ActivityEvent[];
  onRun: (kind: DemoRequestKind) => Promise<void>;
  onReset: () => void;
}

export function AgentActivityConsole({
  capabilityStatus,
  busy,
  canReplay,
  events,
  onRun,
  onReset,
}: AgentActivityConsoleProps) {
  const [inspectedRequest, setInspectedRequest] = useState<SpendRequest | null>(null);
  const inspectionTrigger = useRef<HTMLButtonElement | null>(null);
  const disabled = busy || capabilityStatus === 'revoked';

  return (
    <section className="activity-console" aria-labelledby="activity-title" aria-busy={busy}>
      <div className="activity-heading">
        <div>
          <span className="eyebrow">Step 2 · Prove</span>
          <h2 id="activity-title">Agent activity console</h2>
          <p>Run fixed purchase requests through the capability. This is protocol activity, not chat.</p>
        </div>
        <button className="button button-secondary" type="button" onClick={onReset} disabled={busy}>
          <RotateCcw aria-hidden="true" size={16} />
          Reset demo
        </button>
      </div>

      {capabilityStatus === 'revoked' ? (
        <div className="activity-disabled" role="status">
          <ShieldAlert aria-hidden="true" size={18} />
          This capability has been revoked. New request actions are disabled.
        </div>
      ) : null}

      <div className="service-grid">
        <ServiceCard
          request={CODE_SHIELD_REQUEST}
          product="Security report"
          tone="approved"
          disabled={disabled}
          actionLabel={busy ? 'Authorization running…' : 'Run approved request'}
          onRun={() => onRun('approved')}
          onInspect={(trigger) => {
            inspectionTrigger.current = trigger;
            setInspectedRequest(CODE_SHIELD_REQUEST);
          }}
        />
        <ServiceCard
          request={ALPHA_SIGNAL_REQUEST}
          product="Trading dataset"
          tone="rejected"
          disabled={disabled}
          actionLabel={busy ? 'Authorization running…' : 'Run rejected request'}
          onRun={() => onRun('rejected')}
          onInspect={(trigger) => {
            inspectionTrigger.current = trigger;
            setInspectedRequest(ALPHA_SIGNAL_REQUEST);
          }}
        />
      </div>

      <div className="console-controls">
        <button
          className="button button-replay"
          type="button"
          disabled={disabled || !canReplay}
          onClick={() => void onRun('replay')}
        >
          <RefreshCcw aria-hidden="true" size={16} />
          Replay same authorization
        </button>
        <span>{canReplay ? 'Reuses the consumed CodeShield nonce.' : 'Available after CodeShield is approved.'}</span>
      </div>

      <div className="event-log" aria-labelledby="event-log-title">
        <div className="event-log-heading">
          <Database aria-hidden="true" size={17} />
          <h3 id="event-log-title">Session events</h3>
        </div>
        {events.length > 0 ? (
          <ol>
            {events.map((event) => (
              <li key={event.id}>{event.label}</li>
            ))}
          </ol>
        ) : (
          <p>No authorization submitted yet.</p>
        )}
      </div>

      {inspectedRequest ? (
        <StructuredRequestDialog
          request={inspectedRequest}
          returnFocusTo={inspectionTrigger.current}
          onClose={() => setInspectedRequest(null)}
        />
      ) : null}
    </section>
  );
}

function ServiceCard({
  request,
  product,
  tone,
  disabled,
  actionLabel,
  onRun,
  onInspect,
}: {
  request: SpendRequest;
  product: string;
  tone: 'approved' | 'rejected';
  disabled: boolean;
  actionLabel: string;
  onRun: () => Promise<void>;
  onInspect: (trigger: HTMLButtonElement) => void;
}) {
  return (
    <article className={`service-card service-card-${tone}`}>
      <div className="service-topline">
        <span>{tone === 'approved' ? 'Expected approval' : 'Expected private rejection'}</span>
        <Braces aria-hidden="true" size={17} />
      </div>
      <h3>{request.merchant.displayName}</h3>
      <p>{product}</p>
      <dl>
        <div>
          <dt>Amount</dt>
          <dd>{request.amount} credits</dd>
        </div>
        <div>
          <dt>Category</dt>
          <dd>{request.category}</dd>
        </div>
      </dl>
      <div className="service-actions">
        <button className="button button-primary" type="button" disabled={disabled} onClick={() => void onRun()}>
          <Play aria-hidden="true" size={16} />
          {actionLabel}
        </button>
        <button
          className="structured-action"
          type="button"
          onClick={(event) => onInspect(event.currentTarget)}
          disabled={disabled}
        >
          View structured request
        </button>
      </div>
    </article>
  );
}

function StructuredRequestDialog({
  request,
  returnFocusTo,
  onClose,
}: {
  request: SpendRequest;
  returnFocusTo: HTMLButtonElement | null;
  onClose: () => void;
}) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previousFocus.current = returnFocusTo
      ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    closeRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const controls = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), [href]'));
      if (controls.length === 0) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previousFocus.current?.focus();
    };
  }, [onClose, returnFocusTo]);

  return (
    <div className="dialog-backdrop" role="presentation">
      <div ref={dialogRef} className="request-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="dialog-heading">
          <div>
            <span className="eyebrow">Owner-only fixture</span>
            <h2 id={titleId}>{request.merchant.displayName} request</h2>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close structured request">
            <X aria-hidden="true" size={19} />
          </button>
        </div>
        <p>The readable request is shown only in the owner workflow.</p>
        <pre>{JSON.stringify(request, null, 2)}</pre>
      </div>
    </div>
  );
}
