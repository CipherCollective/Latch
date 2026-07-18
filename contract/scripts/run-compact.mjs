import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const args = ['compile', 'src/moat.compact', 'src/managed/moat'];

const candidates = [
  process.env.COMPACT_BIN,
  join(homedir(), '.local', 'bin', 'compact'),
  join(homedir(), '.compact', 'bin', 'compact'),
  'compact',
].filter(Boolean);

function looksLikeMidnightCompact(bin) {
  const probe = spawnSync(bin, ['compile', '--version'], {
    encoding: 'utf8',
    shell: false,
  });
  if (probe.error || probe.status !== 0) return false;
  const text = `${probe.stdout ?? ''}${probe.stderr ?? ''}`.trim();
  // Midnight prints a semver like 0.31.1; Windows FS compact.exe does not.
  return /^\d+\.\d+\.\d+/.test(text);
}

const bin = candidates.find((candidate) => {
  if (candidate !== 'compact' && !existsSync(candidate)) return false;
  return looksLikeMidnightCompact(candidate);
});

if (!bin) {
  console.error(
    [
      'Midnight Compact compiler not found on PATH.',
      'On Windows, install and run Compact inside WSL, then either:',
      '  - run: npm run build --workspace @latch/contract   (from WSL), or',
      '  - set COMPACT_BIN to the Midnight compact binary and retry.',
      'Do not use the Windows filesystem utility also named compact.exe.',
    ].join('\n'),
  );
  process.exit(1);
}

const result = spawnSync(bin, args, { stdio: 'inherit', shell: false });
process.exit(result.status ?? 1);
