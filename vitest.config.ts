import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts', 'mini-services/**/*.test.js'],
  },
  resolve: {
    alias: {
      // fileURLToPath (not URL.pathname) so the alias resolves correctly on
      // Windows, where .pathname yields a broken "/C:/..." path.
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
