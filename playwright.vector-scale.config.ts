import { randomUUID } from 'node:crypto';
import { resolve, join } from 'node:path';
import { defineConfig } from '@playwright/test';

// Explicit offline CPU gate; routine desktop tests do not run this sample.
const artifacts =
  process.env.STUDY_VECTOR_SCALE_ARTIFACTS ??
  resolve('artifacts', `vector-scale-20261011-${randomUUID()}`);
process.env.STUDY_VECTOR_SCALE_ARTIFACTS = artifacts;

export default defineConfig({
  testDir: './tests',
  testMatch: 'vector-scale.real.ts',
  timeout: 600_000,
  workers: 1,
  outputDir: join(artifacts, 'playwright-results'),
  reporter: [['list'], ['json', { outputFile: join(artifacts, 'playwright.json') }]],
  use: { trace: 'retain-on-failure' },
});
