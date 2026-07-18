import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const contractRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const managedEntry = join(contractRoot, 'src', 'managed', 'moat', 'contract', 'index.d.ts');

if (existsSync(managedEntry)) {
  process.exit(0);
}

console.log('Managed Compact bindings missing; running npm run compact…');
const result = spawnSync(process.execPath, [join(contractRoot, 'scripts', 'run-compact.mjs')], {
  cwd: contractRoot,
  stdio: 'inherit',
  shell: false,
});
process.exit(result.status ?? 1);
