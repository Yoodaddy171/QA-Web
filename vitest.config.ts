import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: [
      'src/**/*.{test,spec}.{ts,tsx}',
      'mini-services/**/*.{test,spec}.js',
    ],
    exclude: ['src/**/*.integration.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      include: [
        'mini-services/{automation-event,relay-log-store,relay-security,frame-writer}.js',
        'src/lib/{ai-governance,ai-settings}.ts',
        'src/lib/client/execution-shortcuts.ts',
        'src/lib/client/automation/*.ts',
        'src/lib/domain/{bugfix,test-run,testcase-id}.ts',
        'src/lib/services/{activity-history-service,bugfix-sync-service,excel-normalization,report-integrity,stats-aggregation}.ts',
        'src/lib/storage/*.ts',
      ],
      thresholds: {
        lines: 75,
        functions: 70,
        branches: 65,
        statements: 75,
      },
    },
  },
  resolve: {
    alias: {
      // fileURLToPath (not URL.pathname) so the alias resolves correctly on
      // Windows, where .pathname yields a broken "/C:/..." path.
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
