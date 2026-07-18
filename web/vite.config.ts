import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// The committed `/Latch/` static artifact is built through `npm run build:pages`.
// The default `/` base remains correct for a future approved Vercel deployment.

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
    coverage: {
      reporter: ['text', 'html'],
    },
  },
});
