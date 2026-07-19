import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

const sourceRoot = new URL('../src/', import.meta.url);
const approvedConsoleFile = 'app/AppErrorBoundary.tsx';
const sourceFiles = [];

async function collect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) await collect(absolute);
    else if (/\.(?:ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.test.ts') && !entry.name.endsWith('.test.tsx')) {
      sourceFiles.push(absolute);
    }
  }
}

const rootPath = sourceRoot.pathname.replace(/^\/[A-Za-z]:/, (drive) => drive.slice(1));
await collect(rootPath);
const violations = [];
for (const file of sourceFiles) {
  const relativeFile = relative(rootPath, file).replaceAll('\\', '/');
  if (relativeFile === approvedConsoleFile) continue;
  const lines = (await readFile(file, 'utf8')).split(/\r?\n/);
  lines.forEach((line, index) => {
    if (/\bconsole\.(?:log|debug|info|warn|error)\s*\(/.test(line)) {
      violations.push(`${relativeFile}:${index + 1}: console calls are not permitted outside AppErrorBoundary.`);
    }
  });
}

if (violations.length) {
  console.error(violations.join('\n'));
  process.exitCode = 1;
}
