#!/usr/bin/env node
/**
 * Copy Compact-managed MOAT ZK assets into the Vite public folder for Atharv.
 * Source: contract/src/managed/moat → web/public/zk/moat (served as /zk/moat/)
 */
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'contract', 'src', 'managed', 'moat');
const dest = join(root, 'web', 'public', 'zk', 'moat');

if (!existsSync(src)) {
  console.error(`Missing ${src}. Run: npm run compact && npm run prepare:contract`);
  process.exit(1);
}

mkdirSync(join(root, 'web', 'public', 'zk'), { recursive: true });
rmSync(dest, { recursive: true, force: true });
cpSync(src, dest, { recursive: true });
console.log(`Synced ZK assets → web/public/zk/moat (URL /zk/moat/)`);
