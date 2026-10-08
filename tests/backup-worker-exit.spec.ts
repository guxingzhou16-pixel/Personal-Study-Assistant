import { test, expect, _electron as electron } from '@playwright/test';
import { buildSync } from 'esbuild';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test.beforeAll(() => {
  mkdirSync('artifacts/acceptance-v12-20261008', { recursive: true });
});

test('reports a real utility process crash before its result as failure', async () => {
  const root = mkdtempSync(join(tmpdir(), 'study-backup-exit-'));
  const runnerPath = join(root, 'audit-backup-runner.cjs');
  const workerPath = join(root, 'audit-worker-crash.mjs');
  buildSync({
    entryPoints: ['electron/core/backup-runner.ts'],
    bundle: true,
    format: 'cjs',
    platform: 'node',
    target: 'node24',
    outfile: runnerPath,
  });
  writeFileSync(workerPath, 'setTimeout(()=>process.abort(),100);');
  const { ELECTRON_RUN_AS_NODE: _ignored, ...env } = process.env;
  const app = await electron.launch({
    args: ['.'],
    env: { ...env, STUDY_COMPANION_DATA_DIR: root },
  });
  try {
    const page = await app.firstWindow();
    await expect(page.getByRole('heading', { name: '开始今天的小进步' })).toBeVisible();
    const actual = await app.evaluate(
      async ({ utilityProcess }, { runnerPath, workerPath }) => {
        const { BackupRunner } = process.getBuiltinModule('module').createRequire(runnerPath)(
          runnerPath,
        );
        let exitCode: number | null | undefined;
        const runner = new BackupRunner(workerPath, (path: string, args: string[]) => {
          const process = utilityProcess.fork(path, args);
          process.on('exit', (code) => {
            exitCode = code;
          });
          return process;
        });
        const outcome = await runner
          .run('export', 'unused', 'unused', () => {})
          .then(
            () => ({ status: 'resolved' }),
            (error: { code: string }) => ({ status: 'rejected', code: error.code }),
          );
        return { outcome, exitCode };
      },
      { runnerPath, workerPath },
    );
    writeFileSync(
      'artifacts/acceptance-v12-20261008/backup-worker-exit.json',
      JSON.stringify(
        {
          root,
          actual,
          scope:
            'Production BackupRunner bundled separately without edits; actual Electron utilityProcess aborts BEFORE sending any result. No backup files restored or overwritten.',
        },
        null,
        2,
      ),
    );
    expect(actual.outcome.status).toBe('rejected');
    expect(actual.outcome).toHaveProperty('code', 'backupWorker');
  } finally {
    await app.close();
  }
});
