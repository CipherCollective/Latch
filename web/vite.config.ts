import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// The committed `/Latch/` static artifact is built through `npm run build:pages`.
// The default `/` base remains correct for a future approved Vercel deployment.

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@latch/contract': fileURLToPath(new URL('../contract/src/index.ts', import.meta.url)),
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
});
