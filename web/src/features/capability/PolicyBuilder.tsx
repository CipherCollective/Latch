import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { EyeOff, LockKeyhole, ShieldCheck } from 'lucide-react';
import { DEFAULT_CAPABILITY_INPUT } from '../../demo/defaults';
import { compareDecimal, isPositiveDecimal } from '../../lib/decimal';
import type { CreateCapabilityInput } from '../../types/domain';

type FormValues = {
  alias: string;
  agentName: string;
  perTransactionLimit: string;
  totalBudget: string;
  maxUses: string;
  allowedCategory: string;
};

type FormErrors = Partial<Record<keyof FormValues, string>>;

const initialValues = (): FormValues => ({
  alias: DEFAULT_CAPABILITY_INPUT.alias,
  agentName: DEFAULT_CAPABILITY_INPUT.policy.agentName,
  perTransactionLimit: DEFAULT_CAPABILITY_INPUT.policy.perTransactionLimit,
  totalBudget: DEFAULT_CAPABILITY_INPUT.policy.totalBudget,
  maxUses: DEFAULT_CAPABILITY_INPUT.policy.maxUses.toString(),
  allowedCategory: DEFAULT_CAPABILITY_INPUT.policy.allowedCategory,
});

function validate(values: FormValues): FormErrors {
  const errors: FormErrors = {};
  const alias = values.alias.trim();
  const agentName = values.agentName.trim();
  if (!alias || alias.length > 64) errors.alias = 'Use a capability alias between 1 and 64 characters.';
  if (!agentName || agentName.length > 64) errors.agentName = 'Use an agent name between 1 and 64 characters.';
  if (!isPositiveDecimal(values.perTransactionLimit)) {
    errors.perTransactionLimit = 'Enter a positive amount with up to 6 decimal places.';
  }
  if (!isPositiveDecimal(values.totalBudget)) {
    errors.totalBudget = 'Enter a positive amount with up to 6 decimal places.';
  }
  const relation = compareDecimal(values.perTransactionLimit, values.totalBudget);
  if (relation === 1) errors.perTransactionLimit = 'The per-transaction limit cannot exceed the total budget.';
  if (!/^[1-9]\d?$/.test(values.maxUses) || Number(values.maxUses) > 99) {
    errors.maxUses = 'Enter a whole number from 1 to 99.';
  }
  if (!values.allowedCategory.trim()) errors.allowedCategory = 'Choose an allowed category.';
  return errors;
}

interface PolicyBuilderProps {
  busy: boolean;
  clientError: string | null;
  onCommit: (input: CreateCapabilityInput) => Promise<void>;
  onBack: () => void;
}

export function PolicyBuilder({ busy, clientError, onCommit, onBack }: PolicyBuilderProps) {
  const [values, setValues] = useState<FormValues>(initialValues);
  const [submitted, setSubmitted] = useState(false);
  const [touched, setTouched] = useState<Partial<Record<keyof FormValues, boolean>>>({});
  const headingRef = useRef<HTMLHeadingElement>(null);
  const errors = useMemo(() => validate(values), [values]);
  const invalid = Object.keys(errors).length > 0;

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const setField = (field: keyof FormValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
  };

  const markTouched = (field: keyof FormValues) => {
    setTouched((current) => ({ ...current, [field]: true }));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (Object.keys(errors).length > 0 || busy) return;
    await onCommit({
      alias: values.alias.trim(),
      policy: {
        agentName: values.agentName.trim(),
        perTransactionLimit: values.perTransactionLimit,
        totalBudget: values.totalBudget,
        maxUses: Number(values.maxUses),
        allowedCategory: values.allowedCategory,
      },
    });
  };

  const fieldError = (field: keyof FormValues) => (submitted || touched[field] ? errors[field] : undefined);

  return (
    <section className="workflow-section" aria-labelledby="policy-title">
      <div className="workflow-heading">
        <span className="eyebrow">Step 1 · Delegate</span>
        <h1 id="policy-title" ref={headingRef} tabIndex={-1}>
          Set the private gate.
        </h1>
        <p>These readable limits remain in the owner experience. Demo mode commits only stable fixtures.</p>
      </div>

      <div className="builder-grid">
        <form className="policy-form panel-light" onSubmit={(event) => void submit(event)} noValidate>
          <div className="form-section-heading">
            <LockKeyhole aria-hidden="true" size={20} />
            <div>
              <h2>Private capability policy</h2>
              <p>Fixed demo defaults are editable.</p>
            </div>
          </div>

          <div className="field-grid">
            <FormField label="Capability alias" id="alias" error={fieldError('alias')}>
              <input
                id="alias"
                value={values.alias}
                onChange={(event) => setField('alias', event.target.value)}
                onBlur={() => markTouched('alias')}
                aria-invalid={Boolean(fieldError('alias'))}
                aria-describedby={fieldError('alias') ? 'alias-error' : undefined}
                maxLength={65}
              />
            </FormField>
            <FormField label="Agent name" id="agentName" error={fieldError('agentName')}>
              <input
                id="agentName"
                value={values.agentName}
                onChange={(event) => setField('agentName', event.target.value)}
                onBlur={() => markTouched('agentName')}
                aria-invalid={Boolean(fieldError('agentName'))}
                aria-describedby={fieldError('agentName') ? 'agentName-error' : undefined}
                maxLength={65}
              />
            </FormField>
            <FormField
              label="Per-transaction limit"
              id="perTransactionLimit"
              hint="Credits"
              error={fieldError('perTransactionLimit')}
            >
              <input
                id="perTransactionLimit"
                inputMode="decimal"
                value={values.perTransactionLimit}
                onChange={(event) => setField('perTransactionLimit', event.target.value)}
                onBlur={() => markTouched('perTransactionLimit')}
                aria-invalid={Boolean(fieldError('perTransactionLimit'))}
                aria-describedby={fieldError('perTransactionLimit') ? 'perTransactionLimit-error' : undefined}
              />
            </FormField>
            <FormField label="Total budget" id="totalBudget" hint="Credits" error={fieldError('totalBudget')}>
              <input
                id="totalBudget"
                inputMode="decimal"
                value={values.totalBudget}
                onChange={(event) => setField('totalBudget', event.target.value)}
                onBlur={() => markTouched('totalBudget')}
                aria-invalid={Boolean(fieldError('totalBudget'))}
                aria-describedby={fieldError('totalBudget') ? 'totalBudget-error' : undefined}
              />
            </FormField>
            <FormField label="Maximum uses" id="maxUses" error={fieldError('maxUses')}>
              <input
                id="maxUses"
                inputMode="numeric"
                value={values.maxUses}
                onChange={(event) => setField('maxUses', event.target.value)}
                onBlur={() => markTouched('maxUses')}
                aria-invalid={Boolean(fieldError('maxUses'))}
                aria-describedby={fieldError('maxUses') ? 'maxUses-error' : undefined}
              />
            </FormField>
            <FormField label="Allowed category" id="allowedCategory" error={fieldError('allowedCategory')}>
              <select
                id="allowedCategory"
                value={values.allowedCategory}
                onChange={(event) => setField('allowedCategory', event.target.value)}
                onBlur={() => markTouched('allowedCategory')}
                aria-invalid={Boolean(fieldError('allowedCategory'))}
                aria-describedby={fieldError('allowedCategory') ? 'allowedCategory-error' : undefined}
              >
                <option value="developer-tools">developer-tools</option>
                <option value="cloud-infrastructure">cloud-infrastructure</option>
                <option value="research-data">research-data</option>
              </select>
            </FormField>
          </div>

          {clientError ? (
            <div className="form-alert" role="alert" aria-live="assertive">
              {clientError}
            </div>
          ) : null}

          <div className="form-actions">
            <button className="button button-ghost-light" type="button" onClick={onBack} disabled={busy}>
              Back
            </button>
            <button
              className="button button-primary"
              type="submit"
              disabled={busy || invalid}
              aria-describedby={invalid ? 'policy-validation-status' : undefined}
            >
              <ShieldCheck aria-hidden="true" size={18} />
              {busy ? 'Committing fixture…' : 'Commit private capability'}
            </button>
          </div>
          <p className="form-validation-status" id="policy-validation-status" aria-live="polite">
            {invalid ? 'Resolve the highlighted policy fields before committing.' : 'Policy fields are valid.'}
          </p>
        </form>

        <aside className="privacy-preview" aria-labelledby="privacy-preview-title">
          <div className="privacy-preview-header">
            <EyeOff aria-hidden="true" size={20} />
            <div>
              <span className="eyebrow">Disclosure preview</span>
              <h2 id="privacy-preview-title">Private by default.</h2>
            </div>
          </div>
          <div className="privacy-block privacy-private">
            <strong>Private in owner view</strong>
            <ul>
              <li>Agent identity and owner-agent relationship</li>
              <li>Per-transaction and total budget limits</li>
              <li>Maximum uses and allowed category</li>
            </ul>
          </div>
          <div className="privacy-block privacy-public">
            <strong>Public after creation</strong>
            <ul>
              <li>Opaque capability identifier</li>
              <li>Policy commitment</li>
              <li>Spend-state commitment</li>
            </ul>
          </div>
          <p className="fixture-note">Demo mode generates stable SHA-256 fixtures. No transaction is submitted.</p>
        </aside>
      </div>
    </section>
  );
}

function FormField({
  label,
  id,
  error,
  hint,
  children,
}: {
  label: string;
  id: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="form-field">
      <label htmlFor={id}>
        {label}
        {hint ? <span>{hint}</span> : null}
      </label>
      {children}
      {error ? (
        <p className="field-error" id={`${id}-error`} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
