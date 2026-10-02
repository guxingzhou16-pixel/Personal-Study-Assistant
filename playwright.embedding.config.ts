import { defineConfig } from '@playwright/test';

// Explicit real-model gate: routine desktop tests never download model weights.
export default defineConfig({
  testDir: './tests',
  testMatch: 'embedding.real.ts',
  timeout: 90_000,
  workers: 1,
  reporter: 'list',
  use: { trace: 'retain-on-failure' },
});
