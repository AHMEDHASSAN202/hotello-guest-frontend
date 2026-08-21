import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  esbuild: { jsx: 'automatic' },
  test: {
    // Required for @testing-library/react's automatic DOM cleanup between tests.
    globals: true,
    environment: 'node',
    // Component tests run in jsdom; pure-function suites stay on node (faster).
    environmentMatchGlobs: [['src/**/*.test.tsx', 'jsdom']],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
