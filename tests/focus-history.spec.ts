import {
  test,
  expect,
  _electron as electron,
  type ElectronApplication,
  type Page,
} from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { DailyTask } from '../src/lib/types';
import { Storage } from '../electron/core/storage';

const artifacts = join('artifacts', 'focus-history-acceptance-' + randomUUID());
let root: string;
let app: ElectronApplication | undefined;
let task: DailyTask;
let oldId: string;
const historyDay = '2026-10-06';

test.beforeAll(() => mkdirSync(artifacts, { recursive: true }));
test.beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'study-focus-history-desktop-'));
  const path = join(root, 'study-companion.sqlite3');
  const store = new Storage(path);
  task = store.planning.saveTask({
    id: null,
    revision: 0,
    title: '旧历史关联任务',
    details: '合成测试夹具，不表示实际学习时长',
    day: '1999-12-31',
    minutes: 5,
    projectId: null,
  });
  store.close();
  const db = new DatabaseSync(path);
  try {
    const insert = db.prepare(
      `INSERT INTO focus_sessions
       (id, task_id, task_revision, task_title, task_day, planned_minutes, elapsed_ms,
        status, reason, review, started_at, ended_at, updated_at, revision)
       VALUES (?, ?, 1, ?, ?, 5, ?, ?, ?, ?, ?, ?, ?, 2)`,
    );
    for (let index = 0; index < 45; index++) {
      const id = randomUUID();
      if (index === 0) oldId = id;
      const status = index % 3 === 0 ? 'stopped' : index % 3 === 1 ? 'completed' : 'interrupted';
      const start = new Date(2026, 9, 6, 10, index);
      const elapsed = status === 'completed' ? 300000 : 1000;
      const end = new Date(start.getTime() + elapsed).toISOString();
      insert.run(
        id,
        task.id,
        `合成历史 ${String(index).padStart(2, '0')}`,
        task.day,
        elapsed,
        status,
        status === 'completed' ? 'elapsed' : status === 'stopped' ? 'user-stop' : 'sleep',
        index === 0 ? '旧分页复盘原文' : '',
        start.toISOString(),
        end,
        end,
      );
    }
  } finally {
    db.close();
  }
});
test.afterEach(async () => {
  await app?.close().catch(() => {});
  app = undefined;
});

async function launch(): Promise<Page> {
  const { ELECTRON_RUN_AS_NODE: _ignored, ...env } = process.env;
  app = await electron.launch({ args: ['.'], env: { ...env, STUDY_COMPANION_DATA_DIR: root } });
  const page = await app.firstWindow();
  await expect(
    page.getByRole('heading', { name: /今天，也长出\s*一点新想法/, exact: true }),
  ).toBeVisible();
  return page;
}

async function nav(page: Page, name: string) {
  await page
    .getByRole('navigation', { name: '主导航' })
    .getByRole('button', { name, exact: true })
    .click();
}

async function openOldReview(page: Page) {
  await nav(page, '专注时光');
  await page.getByRole('button', { name: '全部专注记录', exact: true }).click();
  const history = page.locator('.focus-full-history');
  await expect(history.getByRole('status').last()).toContainText('45 条');
  await history.getByRole('button', { name: '下一页', exact: true }).click();
  await expect(history.getByRole('status').last()).toContainText('第 2 / 3 页');
  await history.getByRole('button', { name: '下一页', exact: true }).click();
  await expect(history.getByRole('status').last()).toContainText('第 3 / 3 页');
  await expect(history.getByRole('button', { name: '下一页', exact: true })).toBeDisabled();
  await history.getByRole('button', { name: /合成历史 00/ }).click();
  await expect(page.getByLabel('一句收获、一个疑问或下一步')).toHaveValue('旧分页复盘原文');
  return history;
}

test('reads a review beyond recent twenty, saves the selected old record, and restores it after an actual app restart', async () => {
  const page = await launch();
  const before = await page.evaluate(() => window.studyCompanion!.focusOverview());
  expect(before.current).toBeNull();
  expect(before.recent).toHaveLength(20);
  expect(before.recent.some((item) => item.id === oldId)).toBe(false);
  const history = await openOldReview(page);
  const draft = page.getByLabel('一句收获、一个疑问或下一步');
  await draft.fill('在第三页修改旧复盘，保留本轮的原始计时和任务快照');
  await page.getByRole('button', { name: '保存复盘', exact: true }).click();
  await expect(page.getByText('复盘已保存到本机。', { exact: true })).toBeVisible();
  const saved = await page.evaluate((id) => window.studyCompanion!.getFocusSession(id), oldId);
  expect(saved).toMatchObject({ id: oldId, revision: 3, elapsedMs: 1000, status: 'stopped' });
  expect(saved.review).toContain('第三页修改旧复盘');
  await history.getByRole('button', { name: '刷新记录', exact: true }).click();
  await expect(history.getByRole('button', { name: /合成历史 00/ })).toContainText(saved.review);
  await page.screenshot({ path: join(artifacts, 'old-paged-review.png') });
  await app!.close();
  app = undefined;
  const reopened = await launch();
  expect(
    await reopened.evaluate((id) => window.studyCompanion!.getFocusSession(id), oldId),
  ).toEqual(saved);
  expect(
    (await reopened.evaluate(() => window.studyCompanion!.focusOverview())).recent.some(
      (item) => item.id === oldId,
    ),
  ).toBe(false);
  writeFileSync(
    join(artifacts, 'old-review-restart.json'),
    JSON.stringify(
      { root, fixture: '45 direct SQL synthetic historical sessions', before, saved },
      null,
      2,
    ),
  );
});

test('filters by start day, retains draft across refresh and stale review conflict, and navigates without changing tasks or timers', async () => {
  const page = await launch();
  const before = await page.evaluate(
    (day) => window.studyCompanion!.planningOverview(day),
    task.day,
  );
  const studyBefore = await page.evaluate(() => {
    const now = new Date();
    return window.studyCompanion!.studyOverview(now.getFullYear(), now.getMonth() + 1);
  });
  const history = await openOldReview(page);
  await history.getByLabel('开始日期', { exact: true }).fill(task.day);
  await history.getByRole('button', { name: '应用筛选', exact: true }).click();
  await expect(history.getByRole('status').last()).toContainText('0 条');
  await expect(history.getByText('当前筛选下没有专注记录。', { exact: true })).toBeVisible();
  await history.getByLabel('开始日期', { exact: true }).fill(historyDay);
  await history.getByRole('button', { name: '应用筛选', exact: true }).click();
  await expect(history.getByRole('status').last()).toContainText('45 条');
  const draft = page.getByLabel('一句收获、一个疑问或下一步');
  await draft.fill('未保存旧复盘草稿');
  await history.getByRole('button', { name: '刷新记录', exact: true }).click();
  await page.getByRole('button', { name: '重新读取记录', exact: true }).click();
  await expect(draft).toHaveValue('未保存旧复盘草稿');
  const remoteSaved = await page.evaluate(
    (id) => window.studyCompanion!.saveFocusReview(id, 2, '另一编辑器已保存的复盘'),
    oldId,
  );
  await page.getByRole('button', { name: '重新读取记录', exact: true }).click();
  await expect(draft).toHaveValue('未保存旧复盘草稿');
  await expect(page.getByText(/保存版本已更新，当前草稿仍保留/)).toBeVisible();
  await page.getByRole('button', { name: '保存复盘', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: '未覆盖新版本' })).toBeVisible();
  await expect(draft).toHaveValue('未保存旧复盘草稿');
  expect(await page.evaluate((id) => window.studyCompanion!.getFocusSession(id), oldId)).toEqual(
    remoteSaved.session,
  );
  await page.getByRole('button', { name: '重新读取记录', exact: true }).click();
  await page.getByRole('button', { name: '查看任务／手动完成', exact: true }).click();
  await expect(page.getByRole('heading', { name: '学习计划', exact: true })).toBeVisible();
  await expect(page.getByLabel('标题', { exact: true })).toHaveValue(task.title);
  expect(
    await page.evaluate((day) => window.studyCompanion!.planningOverview(day), task.day),
  ).toEqual(before);
  expect((await page.evaluate(() => window.studyCompanion!.focusOverview())).current).toBeNull();
  const studyAfter = await page.evaluate(() => {
    const now = new Date();
    return window.studyCompanion!.studyOverview(now.getFullYear(), now.getMonth() + 1);
  });
  expect(studyAfter).toEqual(studyBefore);
  await nav(page, '专注时光');
  await expect(draft).toHaveValue('未保存旧复盘草稿');
  await page.evaluate(
    (saved) => window.studyCompanion!.deleteDailyTask(saved.id, saved.revision),
    task,
  );
  expect(await page.evaluate((id) => window.studyCompanion!.getFocusSession(id), oldId)).toEqual(
    remoteSaved.session,
  );
  await page.getByRole('button', { name: '查看任务／手动完成', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: /删除|不存在/ })).toBeVisible();
  writeFileSync(
    join(artifacts, 'draft-filter-navigation.json'),
    JSON.stringify(
      {
        root,
        fixture: 'synthetic SQL history, real UI and IPC',
        oldId,
        before,
        remoteSaved,
        studyBefore,
        studyAfter,
      },
      null,
      2,
    ),
  );
});
