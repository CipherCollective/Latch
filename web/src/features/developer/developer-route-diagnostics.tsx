import type { ReactNode } from 'react';

export const DEVELOPER_ROUTE_ERROR_CODE = 'DEVELOPER_ROUTE_FAILURE' as const;

export type WalletSubmissionErrorCode =
  | 'USER_REJECTED'
  | 'INVALID_TRANSACTION'
  | 'WRONG_NETWORK'
  | 'WALLET_LOCKED'
  | 'ALREADY_SUBMITTED'
  | 'CONNECTOR_INTERNAL_ERROR'
  | 'AMBIGUOUS_SUBMISSION';

export type DeveloperRouteStage =
  | 'dynamic_import'
  | 'dynamic_import_timeout'
  | 'module_initialization'
  | 'connected_api_session_lookup'
  | 'panel_render'
  | 'deployment_precondition'
  | 'provider_adapter_construction'
  | 'zk_provider_initialization'
  | 'transaction_serialization'
  | 'wallet_balance'
  | 'balanced_transaction_deserialization'
  | 'wallet_submission'
  | 'deployment_submission';

export type DeveloperRouteDiagnostic = {
  readonly code: typeof DEVELOPER_ROUTE_ERROR_CODE;
  readonly stage: DeveloperRouteStage;
  readonly errorName: string;
  readonly missingIdentifier?: string;
  readonly walletErrorCode?: WalletSubmissionErrorCode;
  readonly message: string;
};

const STAGE_MESSAGES: Readonly<Record<DeveloperRouteStage, string>> = Object.freeze({
  dynamic_import: 'The developer deployment module could not be downloaded.',
  dynamic_import_timeout: 'The developer deployment module did not finish loading in time.',
  module_initialization: 'The developer deployment module could not initialize in this browser.',
  connected_api_session_lookup: 'The confirmed Lace session is no longer available. Reconnect Lace and try again.',
  panel_render: 'The developer deployment panel could not render safely.',
  deployment_precondition: 'Lace must be connected to Midnight Preprod before deployment.',
  provider_adapter_construction: 'The Lace deployment provider could not be prepared.',
  zk_provider_initialization: 'The browser ZK asset provider could not be initialized.',
  transaction_serialization: 'The deployment transaction could not be serialized safely.',
  wallet_balance: 'Lace could not authorize and balance the deployment transaction.',
  balanced_transaction_deserialization: 'The balanced Lace transaction could not be decoded safely.',
  wallet_submission: 'Lace could not submit the authorized deployment transaction.',
  deployment_submission: 'The explicit deployment request could not be completed.',
});

const SAFE_ERROR_NAME = /^[A-Za-z][A-Za-z0-9]{0,39}$/;

const WALLET_SUBMISSION_MESSAGES: Readonly<Record<WalletSubmissionErrorCode, string>> = Object.freeze({
  USER_REJECTED: 'The Lace submission request was rejected. No automatic retry will occur.',
  INVALID_TRANSACTION: 'Lace rejected the balanced transaction as invalid. No automatic retry will occur.',
  WRONG_NETWORK: 'Lace is no longer connected to Midnight Preprod. Reconnect before trying again.',
  WALLET_LOCKED: 'Lace disconnected or locked before confirming submission.',
  ALREADY_SUBMITTED: 'Lace reports this transaction was already submitted. Check wallet activity before continuing.',
  CONNECTOR_INTERNAL_ERROR: 'Lace could not start the submission request. Reconnect Lace before trying again.',
  AMBIGUOUS_SUBMISSION:
    'Lace did not confirm whether the transaction was broadcast. Check wallet activity before trying again; Latch will not retry automatically.',
});

function safeErrorName(error: unknown): string {
  if (!(error instanceof Error) || !SAFE_ERROR_NAME.test(error.name)) return 'Error';
  return error.name;
}

const SAFE_IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]{0,63}$/;
const REFERENCE_ERROR_PATTERNS = [
  /^([A-Za-z_$][A-Za-z0-9_$]{0,63}) is not defined$/,
  /^Cannot access '([A-Za-z_$][A-Za-z0-9_$]{0,63})' before initialization$/,
  /^Can't find variable: ([A-Za-z_$][A-Za-z0-9_$]{0,63})$/,
] as const;

function safeMissingIdentifier(error: unknown): string | undefined {
  if (!(error instanceof Error) || error.name !== 'ReferenceError' || error.message.length > 128) return undefined;
  for (const pattern of REFERENCE_ERROR_PATTERNS) {
    const candidate = pattern.exec(error.message)?.[1];
    if (candidate && SAFE_IDENTIFIER.test(candidate)) return candidate;
  }
  return undefined;
}

export class DeveloperRouteFailure extends Error {
  readonly stage: DeveloperRouteStage;
  readonly originalErrorName: string;
  readonly missingIdentifier?: string;
  readonly walletErrorCode?: WalletSubmissionErrorCode;
  readonly publicMessage: string;

  constructor(stage: DeveloperRouteStage, cause?: unknown, walletErrorCode?: WalletSubmissionErrorCode) {
    const publicMessage = walletErrorCode ? WALLET_SUBMISSION_MESSAGES[walletErrorCode] : STAGE_MESSAGES[stage];
    super(publicMessage);
    this.name = 'DeveloperRouteFailure';
    this.stage = stage;
    this.originalErrorName = safeErrorName(cause);
    this.missingIdentifier = safeMissingIdentifier(cause);
    this.walletErrorCode = walletErrorCode;
    this.publicMessage = publicMessage;
  }
}

export function developerRouteDiagnostic(
  stage: DeveloperRouteStage,
  error: unknown,
): DeveloperRouteDiagnostic {
  if (error instanceof DeveloperRouteFailure) {
    return {
      code: DEVELOPER_ROUTE_ERROR_CODE,
      stage: error.stage,
      errorName: error.originalErrorName,
      ...(error.missingIdentifier ? { missingIdentifier: error.missingIdentifier } : {}),
      ...(error.walletErrorCode ? { walletErrorCode: error.walletErrorCode } : {}),
      message: error.publicMessage,
    };
  }
  const missingIdentifier = safeMissingIdentifier(error);
  return {
    code: DEVELOPER_ROUTE_ERROR_CODE,
    stage,
    errorName: safeErrorName(error),
    ...(missingIdentifier ? { missingIdentifier } : {}),
    message: STAGE_MESSAGES[stage],
  };
}

export function DeveloperRouteDiagnosticView({
  diagnostic,
  action,
}: {
  diagnostic: DeveloperRouteDiagnostic;
  action?: ReactNode;
}) {
  return (
    <div className="form-alert" role="alert" aria-live="assertive">
      <strong>Temporary deployment tooling stopped safely</strong>
      <dl>
        <div><dt>Error code</dt><dd>{diagnostic.code}</dd></div>
        <div><dt>Failing stage</dt><dd>{diagnostic.stage}</dd></div>
        <div><dt>JavaScript error</dt><dd>{diagnostic.errorName}</dd></div>
        {diagnostic.missingIdentifier ? <div><dt>Missing identifier</dt><dd>{diagnostic.missingIdentifier}</dd></div> : null}
        {diagnostic.walletErrorCode ? <div><dt>Wallet error</dt><dd>{diagnostic.walletErrorCode}</dd></div> : null}
        <div><dt>Message</dt><dd>{diagnostic.message}</dd></div>
      </dl>
      {action}
    </div>
  );
}
