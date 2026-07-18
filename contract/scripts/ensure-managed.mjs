import { existsSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const contractRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const compactSource = join(contractRoot, 'src', 'moat.compact');
const managedEntry = join(contractRoot, 'src', 'managed', 'moat', 'contract', 'index.d.ts');
const contractInfo = join(contractRoot, 'src', 'managed', 'moat', 'compiler', 'contract-info.json');

function needsRebuild() {
  if (!existsSync(managedEntry) || !existsSync(contractInfo)) return true;
  if (!existsSync(compactSource)) {
    console.error(`Missing Compact source at ${compactSource}`);
    process.exit(1);
  }

  const sourceMtime = statSync(compactSource).mtimeMs;
  const managedMtime = Math.min(statSync(managedEntry).mtimeMs, statSync(contractInfo).mtimeMs);
  return sourceMtime > managedMtime;
}

if (!needsRebuild()) {
  process.exit(0);
}

console.log('Managed Compact bindings missing or stale vs moat.compact; regenerating…');
const result = spawnSync(process.execPath, [join(contractRoot, 'scripts', 'run-compact.mjs')], {
  cwd: contractRoot,
  stdio: 'inherit',
  shell: false,
});
process.exit(result.status ?? 1);
