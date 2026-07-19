import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CompiledContract } from '@midnight-ntwrk/compact-js';
import {
  Moat,
  witnesses,
  type MoatPrivateState,
} from '@latch/contract';

/** Private-state store key for MOAT openings (one active witness blob per call). */
export const MOAT_PRIVATE_STATE_ID = 'moatPrivateState' as const;
export type MoatPrivateStateId = typeof MOAT_PRIVATE_STATE_ID;

export type MoatContract = Moat.Contract<MoatPrivateState>;

/**
 * Default path to Compact-managed ZK assets (keys + zkir).
 * Override with `MOAT_ZK_ASSETS_PATH` when packaging for the browser/CDN.
 */
export function defaultMoatZkAssetsPath(): string {
  if (process.env.MOAT_ZK_ASSETS_PATH) return process.env.MOAT_ZK_ASSETS_PATH;
  return join(dirname(fileURLToPath(import.meta.url)), '../../contract/src/managed/moat');
}

/**
 * Bind the generated Compact contract + witnesses + ZK asset directory for Midnight.js (Node).
 */
export function makeMoatCompiledContract(zkAssetsPath: string = defaultMoatZkAssetsPath()) {
  return CompiledContract.make('moat', Moat.Contract).pipe(
    CompiledContract.withWitnesses(witnesses as never),
    CompiledContract.withCompiledFileAssets(zkAssetsPath),
  );
}

/**
 * Browser-safe compiled contract (witnesses only).
 * Pair with `FetchZkConfigProvider` pointed at `/zk/moat` (see `npm run sync:zk-assets`).
 */
export function makeMoatCompiledContractBrowser() {
  return CompiledContract.make('moat', Moat.Contract).pipe(
    CompiledContract.withWitnesses(witnesses as never),
  );
}

export type MoatCompiledContract = ReturnType<typeof makeMoatCompiledContract>;
