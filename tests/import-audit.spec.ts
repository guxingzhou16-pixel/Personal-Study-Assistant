import { test, expect, _electron as electron } from '@playwright/test';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createReadingFiles } from './fixtures/reading-files';

test.beforeAll(() => {
  mkdirSync('artifacts/acceptance-v12-20261008', { recursive: true });
});

test('records the actual independent parser report for generated Markdown, text PDF, scan and corrupt PDF', async () => {
  const root = mkdtempSync(join(tmpdir(), 'study-import-audit-'));
  const files = await createReadingFiles(root);
  const { ELECTRON_RUN_AS_NODE: _ignored, ...env } = process.env;
  const app = await electron.launch({
    args: ['.'],
    env: { ...env, STUDY_COMPANION_DATA_DIR: join(root, 'data') },
  });
  try {
    const page = await app.firstWindow();
    await expect(page.getByRole('heading', { name: '开始今天的小进步' })).toBeVisible();
    await app.evaluate(
      ({ dialog }, paths) => {
        dialog.showOpenDialog = async () => ({ canceled: false, filePaths: paths });
      },
      [files.markdown, files.pdf, files.scan, files.corrupt],
    );
    const started = Date.now();
    const report = await page.evaluate(() => window.studyCompanion!.importSources());
    writeFileSync(
      'artifacts/acceptance-v12-20261008/import-report.json',
      JSON.stringify({ milliseconds: Date.now() - started, report }, null, 2),
    );
    expect(report.added).toBe(3);
    expect(report.failures).toHaveLength(1);
    expect(report.failures[0]).toMatchObject({ file: 'broken.pdf' });
  } finally {
    await app.close();
  }
});
