import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// The committed `/Latch/` static artifact is built through `npm run build:pages`.
// The default `/` base remains correct for a future approved Vercel deployment.

export default defineConfig(({ command, mode }) => {
  // Production bundling already orders the generated WASM wrappers correctly.
  // These aliases are only needed by Vite's native-module development server.
  const useDevelopmentWasmShims = command === 'serve' && mode !== 'test';

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@latch/contract': fileURLToPath(new URL('../contract/src/index.ts', import.meta.url)),
        ...(useDevelopmentWasmShims
          ? {
              '@midnight-ntwrk/ledger-v8': fileURLToPath(new URL('./src/shims/ledger-v8-runtime.js', import.meta.url)),
              '@midnight-ntwrk/onchain-runtime-v3': fileURLToPath(new URL('./src/shims/onchain-runtime-v3.js', import.meta.url)),
              '#self': fileURLToPath(new URL('./src/shims/ledger-v8-runtime.js', import.meta.url)),
            }
          : {}),
        'isomorphic-ws': fileURLToPath(new URL('./src/shims/isomorphic-ws.ts', import.meta.url)),
        assert: fileURLToPath(new URL('./src/shims/assert.ts', import.meta.url)),
      },
    },
    test: {
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts',
      css: true,
      coverage: {
        reporter: ['text', 'html'],
      },
    },
  };
});
