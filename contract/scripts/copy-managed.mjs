import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const contractRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const sourceManaged = join(contractRoot, 'src', 'managed');
const destManaged = join(contractRoot, 'dist', 'managed');

if (!existsSync(sourceManaged)) {
  console.error(
    `Missing ${sourceManaged}. Run "npm run compact" before build so generated bindings exist.`,
  );
  process.exit(1);
}

mkdirSync(join(contractRoot, 'dist'), { recursive: true });
rmSync(destManaged, { recursive: true, force: true });
cpSync(sourceManaged, destManaged, { recursive: true });

console.log(`Copied ${sourceManaged} -> ${destManaged}`);
