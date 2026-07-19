import { useRef, useState } from 'react';
import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';

import type { ConnectedWalletSession } from '../../wallet/midnight-wallet-connector';
import { deployMoatWithLace, type MoatDeploymentResult } from './lace-moat-deploy';

type DeploymentPhase = 'ready' | 'deploying' | 'submitted' | 'error';

type MoatPreprodDeployPanelProps = {
  session: ConnectedWalletSession | null;
  connectedApi: ConnectedAPI | null;
  deploy?: (session: ConnectedWalletSession | null, api: ConnectedAPI | null) => Promise<MoatDeploymentResult>;
};

async function copyText(value: string): Promise<void> {
  await navigator.clipboard.writeText(value);
}
export function MoatPreprodDeployPanel({
  session,
  connectedApi,
  deploy = deployMoatWithLace,
}: MoatPreprodDeployPanelProps) {
  const [phase, setPhase] = useState<DeploymentPhase>('ready');
  const [result, setResult] = useState<Pick<MoatDeploymentResult, 'contractAddress' | 'txId'> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [indexerNotice, setIndexerNotice] = useState<string | null>(null);
  const inFlight = useRef(false);

  const canDeploy =
    session?.snapshot.mode === 'real' &&
    session.snapshot.connectionState === 'connected' &&
    session.snapshot.networkId === 'preprod' &&
    session.configuration.networkId === 'preprod' &&
    connectedApi !== null;

  const startDeployment = async () => {
    if (inFlight.current || phase === 'deploying') return;
    if (!canDeploy) {
      setError('Connect Lace to Midnight Preprod before deploying.');
      setPhase('error');
      return;
    }

    inFlight.current = true;
    setPhase('deploying');
    setError(null);
    setIndexerNotice(null);
    try {
      const deployment = await deploy(session, connectedApi);
      setResult({ contractAddress: deployment.contractAddress, txId: deployment.txId });
      setPhase('submitted');
      void deployment.waitForIndexer().then(
        () => setIndexerNotice('The contract is now visible on the Preprod indexer.'),
        () => setIndexerNotice('Transaction submitted. The Preprod indexer has not shown the contract yet.'),
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'The deployment could not be completed. Check Lace and Preprod, then try later.',
      );
      setPhase('error');
    } finally {
      inFlight.current = false;
    }
  };

  return (
    <section className="workflow-section" aria-labelledby="developer-deploy-title">
      <div className="workflow-heading">
        <span className="eyebrow">Temporary developer tooling</span>
        <h1 id="developer-deploy-title">Deploy MOAT on Midnight Preprod</h1>
        <p>This route is not part of the demo. It can submit one real contract deployment through the connected Lace wallet.</p>
      </div>

      <div className="panel-light policy-form" aria-busy={phase === 'deploying'}>
        <p className="fixture-note">
          Deployment requires an already connected Lace wallet on Preprod. No wallet address, balance, private state, or
          wallet payload is displayed here.
        </p>
        {!canDeploy ? (
          <div className="form-alert" role="alert">
            Connect Lace to Midnight Preprod before deploying.
          </div>
        ) : null}
        {error ? (
          <div className="form-alert" role="alert" aria-live="assertive">
            {error}
          </div>
        ) : null}
        {result ? (
          <div className="wallet-connected-summary" role="status" aria-live="polite">
            <strong>Deployment submitted</strong>
            <label>
              Contract address
              <output>{result.contractAddress}</output>
            </label>
            <button className="button button-ghost-light" type="button" onClick={() => void copyText(result.contractAddress)}>
              Copy contract address
            </button>
            <label>
              Transaction ID
              <output>{result.txId}</output>
            </label>
            <button className="button button-ghost-light" type="button" onClick={() => void copyText(result.txId)}>
              Copy transaction ID
            </button>
            {indexerNotice ? <p>{indexerNotice}</p> : <p>Waiting for the Preprod indexer to show the deployment.</p>}
          </div>
        ) : null}
        <div className="form-actions wallet-actions">
          <button
            className="button button-primary"
            type="button"
            onClick={() => void startDeployment()}
            disabled={!canDeploy || phase === 'deploying' || result !== null}
          >
            {phase === 'deploying' ? 'Deploying Moat contract on Preprod…' : 'Deploy Moat contract on Preprod'}
          </button>
        </div>
      </div>
    </section>
  );
}

