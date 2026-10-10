import { randomUUID } from 'node:crypto';
import { test, expect, _electron as electron, type ElectronApplication } from '@playwright/test';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const artifacts = join('artifacts', 'final-acceptance-20261010-' + randomUUID());

test.beforeAll(() => {
  mkdirSync(artifacts, { recursive: true });
});

async function launch(root: string) {
  const { ELECTRON_RUN_AS_NODE: _ignored, ...env } = process.env;
  return electron.launch({ args: ['.'], env: { ...env, STUDY_COMPANION_DATA_DIR: root } });
}
async function task(app: ElectronApplication) {
  const page = await app.firstWindow();
  await expect(page.getByRole('heading', { name: '开始今天的小进步' })).toBeVisible();
  const saved = await page.evaluate(() =>
    window.studyCompanion!.saveDailyTask({
      id: null,
      revision: 0,
      title: '真实计时验收',
      details: '这是合成任务',
      projectId: null,
      day: new Date().toLocaleDateString('sv-SE'),
      minutes: 5,
    }),
  );
  return { page, saved };
}
test('completes a real five minute focus only after durable elapsed time without marking the task complete', async () => {
  test.setTimeout(345_000);
  const root = mkdtempSync(join(tmpdir(), 'study-focus-five-minute-'));
  const app = await launch(root);
  const started = Date.now();
  try {
    const { page, saved } = await task(app);
    const initial = await page.evaluate(
      (saved) =>
        window.studyCompanion!.startFocus({
          taskId: saved.id,
          taskRevision: saved.revision,
          minutes: 5,
        }),
      saved,
    );
    await expect
      .poll(
        async () => (await page.evaluate(() => window.studyCompanion!.focusOverview())).current,
        { timeout: 320_000, intervals: [1000] },
      )
      .toBeNull();
    const result = await page.evaluate(() => window.studyCompanion!.focusOverview());
    expect(result.recent[0].status).toBe('completed');
    expect(result.recent[0].elapsedMs).toBe(300_000);
    const planning = await page.evaluate(
      (day) => window.studyCompanion!.planningOverview(day),
      saved.day,
    );
    expect(planning.tasks[0].status).toBe('todo');
    const seconds = (Date.now() - started) / 1000;
    expect(seconds).toBeGreaterThanOrEqual(300);
    writeFileSync(
      join(artifacts, 'focus-five-minute.json'),
      JSON.stringify(
        {
          root,
          initial,
          result,
          planning,
          realElapsedSeconds: seconds,
          clock: 'real OS monotonic clock, no fake timers',
        },
        null,
        2,
      ),
    );
  } finally {
    await app.close();
  }
});
test('interrupts on renderer reload, clean exit, force kill, injected suspend and a real long main-process heartbeat gap', async () => {
  test.setTimeout(90_000);
  const root = mkdtempSync(join(tmpdir(), 'study-focus-interruptions-'));
  let app = await launch(root);
  const results: unknown[] = [];
  try {
    let { page, saved } = await task(app);
    const start = () =>
      page.evaluate(
        (saved) =>
          window.studyCompanion!.startFocus({
            taskId: saved.id,
            taskRevision: saved.revision,
            minutes: 5,
          }),
        saved,
      );
    await start();
    await expect
      .poll(
        async () =>
          (await page.evaluate(() => window.studyCompanion!.focusOverview())).current!.elapsedMs,
      )
      .toBeGreaterThan(1000);
    await page.reload();
    await expect(page.getByRole('heading', { name: '开始今天的小进步' })).toBeVisible();
    let ended = (await page.evaluate(() => window.studyCompanion!.focusOverview())).recent[0];
    expect(ended.reason).toBe('renderer-reload');
    expect(ended.status).toBe('interrupted');
    results.push({ cause: 'actual renderer reload', ended });
    await start();
    await app.close();
    app = await launch(root);
    page = await app.firstWindow();
    await expect(page.getByRole('heading', { name: '开始今天的小进步' })).toBeVisible();
    ended = (await page.evaluate(() => window.studyCompanion!.focusOverview())).recent[0];
    expect(ended.reason).toBe('app-exit');
    results.push({ cause: 'actual normal exit and restart', ended });
    await start();
    await app.evaluate(({ powerMonitor }) => powerMonitor.emit('suspend'));
    ended = (await page.evaluate(() => window.studyCompanion!.focusOverview())).recent[0];
    expect(ended.reason).toBe('sleep');
    results.push({ cause: 'injected Electron suspend event; actual OS sleep UNEXECUTED', ended });
    await start();
    await expect
      .poll(
        async () =>
          (await page.evaluate(() => window.studyCompanion!.focusOverview())).current!.elapsedMs,
      )
      .toBeGreaterThan(1000);
    const pid = app.process().pid!;
    execFileSync('taskkill', ['/PID', String(pid), '/T', '/F']);
    await app.close().catch(() => {});
    app = await launch(root);
    page = await app.firstWindow();
    await expect(page.getByRole('heading', { name: '开始今天的小进步' })).toBeVisible();
    ended = (await page.evaluate(() => window.studyCompanion!.focusOverview())).recent[0];
    expect(ended.reason).toBe('app-restart');
    expect(ended.status).toBe('interrupted');
    results.push({ cause: 'actual process-tree force termination and startup recovery', ended });
    await start();
    await app.evaluate(() => {
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 31_100);
    });
    await expect
      .poll(async () => (await page.evaluate(() => window.studyCompanion!.focusOverview())).current)
      .toBeNull();
    ended = (await page.evaluate(() => window.studyCompanion!.focusOverview())).recent[0];
    expect(ended.reason).toBe('heartbeat-gap');
    expect(ended.status).toBe('interrupted');
    expect(ended.elapsedMs).toBeLessThan(10_000);
    results.push({ cause: 'actual 31.1s main-process stall', ended });
    expect(
      (await page.evaluate((day) => window.studyCompanion!.planningOverview(day), saved.day))
        .tasks[0].status,
    ).toBe('todo');
  } finally {
    writeFileSync(
      join(artifacts, 'focus-interruptions.json'),
      JSON.stringify({ root, results }, null, 2),
    );
    await app.close().catch(() => {});
  }
});
