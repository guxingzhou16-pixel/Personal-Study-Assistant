import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  testMatch: 'quality.real.ts',
  workers: 1,
  timeout: 600_000,
  reporter: 'list',
  use: { trace: 'retain-on-failure' },
});
