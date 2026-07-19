import type { ReactNode } from 'react';

export const DEVELOPER_ROUTE_ERROR_CODE = 'DEVELOPER_ROUTE_FAILURE' as const;

export type DeveloperRouteStage =
  | 'dynamic_import'
  | 'dynamic_import_timeout'
  | 'module_initialization'
  | 'connected_api_session_lookup'
  | 'panel_render'
  | 'deployment_precondition'
  | 'provider_adapter_construction'
  | 'zk_provider_initialization'
  | 'deployment_submission';

export type DeveloperRouteDiagnostic = {
  readonly code: typeof DEVELOPER_ROUTE_ERROR_CODE;
  readonly stage: DeveloperRouteStage;
  readonly errorName: string;
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
  deployment_submission: 'The explicit deployment request could not be completed.',
});

const SAFE_ERROR_NAME = /^[A-Za-z][A-Za-z0-9]{0,39}$/;

function safeErrorName(error: unknown): string {
  if (!(error instanceof Error) || !SAFE_ERROR_NAME.test(error.name)) return 'Error';
  return error.name;
}

export class DeveloperRouteFailure extends Error {
  readonly stage: DeveloperRouteStage;
  readonly originalErrorName: string;

  constructor(stage: DeveloperRouteStage, cause?: unknown) {
    super(STAGE_MESSAGES[stage]);
    this.name = 'DeveloperRouteFailure';
    this.stage = stage;
    this.originalErrorName = safeErrorName(cause);
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
      message: STAGE_MESSAGES[error.stage],
    };
  }
  return {
    code: DEVELOPER_ROUTE_ERROR_CODE,
    stage,
    errorName: safeErrorName(error),
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
        <div><dt>Message</dt><dd>{diagnostic.message}</dd></div>
      </dl>
      {action}
    </div>
  );
}
