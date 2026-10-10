import {
  test,
  expect,
  _electron as electron,
  type ElectronApplication,
  type Page,
} from '@playwright/test';
import { createHash, randomUUID } from 'node:crypto';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  renameSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Storage } from '../electron/core/storage';
import {
  createLegacyDatabase,
  fixtureIds,
  fixtureSourceId,
  fixtureText,
} from './fixtures/legacy-databases';
import { inspectDatabases } from '../electron/core/backup-data';

const artifacts = join('artifacts', 'final-acceptance-20261010-' + randomUUID());
let root: string;
let app: ElectronApplication | undefined;
test.beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'study-v12-desktop-'));
});
test.afterEach(async () => {
  await app?.close().catch(() => {});
  app = undefined;
});
async function launch(): Promise<Page> {
  const { ELECTRON_RUN_AS_NODE: _ignored, ...env } = process.env;
  app = await electron.launch({ args: ['.'], env: { ...env, STUDY_COMPANION_DATA_DIR: root } });
  const page = await app.firstWindow();
  await expect(page.getByRole('heading', { name: /开始今天的小进步/ })).toBeVisible();
  return page;
}
async function nav(page: Page, name: string) {
  await page
    .getByRole('navigation', { name: '主导航' })
    .getByRole('button', { name, exact: true })
    .click();
}
function day() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
function seed() {
  createLegacyDatabase(join(root, 'study-companion.sqlite3'), 11);
  mkdirSync(join(root, 'sources'));
  writeFileSync(join(root, 'sources', fixtureSourceId + '.md'), fixtureText);
}
async function selectFolder(path: string | null) {
  await app!.evaluate(({ dialog }, selected) => {
    dialog.showOpenDialog = async () => ({
      canceled: selected === null,
      filePaths: selected ? [selected] : [],
    });
  }, path);
}

test.beforeAll(() => {
  mkdirSync(artifacts, { recursive: true });
});

test('completes a manual project, task, real timer, review and check-in without a model', async () => {
  test.setTimeout(60_000);
  let page = await launch();
  const before = await page.evaluate(() => {
    const date = new Date();
    return window.studyCompanion!.studyOverview(date.getFullYear(), date.getMonth() + 1);
  });
  await page.getByRole('button', { name: /设定目标 在学习计划/ }).click();
  await page.getByRole('button', { name: '新建项目', exact: true }).click();
  await page.getByLabel('标题', { exact: true }).fill('事务验证项目');
  await page.getByRole('textbox', { name: '学习目标', exact: true }).fill('用失败实验核对原子性');
  await page.getByRole('button', { name: '确认保存到本机', exact: true }).click();
  await expect(page.locator('.planning-editor [role=status]').first()).toContainText('已保存');
  await page.getByRole('button', { name: '新建任务', exact: true }).click();
  await page.getByLabel('标题', { exact: true }).fill('触发中途失败并检查回滚');
  await page.getByLabel('具体行动与说明', { exact: true }).fill('记录前后余额，两笔修改都不应生效');
  const projects = await page.evaluate(
    (day) => window.studyCompanion!.planningOverview(day),
    day(),
  );
  await page.getByRole('combobox', { name: /关联项目/ }).selectOption(projects.projects[0].id);
  await page.getByRole('button', { name: '确认保存到本机', exact: true }).click();
  await expect(page.locator('.planning-editor [role=status]').first()).toContainText('已保存');
  await page.getByRole('button', { name: '为这项任务安排专注', exact: true }).click();
  await page.getByLabel('本轮专注分钟', { exact: true }).fill('5');
  await page.getByRole('button', { name: '确认并开始本轮', exact: true }).click();
  await expect
    .poll(
      async () =>
        (await page.evaluate(() => window.studyCompanion!.focusOverview())).current?.elapsedMs ?? 0,
    )
    .toBeGreaterThanOrEqual(2000);
  await page.getByRole('button', { name: '暂停', exact: true }).click();
  const paused = (await page.evaluate(() => window.studyCompanion!.focusOverview())).current!;
  expect(paused.status).toBe('paused');
  await page.waitForTimeout(1100);
  expect(
    (await page.evaluate(() => window.studyCompanion!.focusOverview())).current!.elapsedMs,
  ).toBe(paused.elapsedMs);
  await page.getByRole('button', { name: '继续专注', exact: true }).click();
  await expect
    .poll(
      async () =>
        (await page.evaluate(() => window.studyCompanion!.focusOverview())).current!.elapsedMs,
    )
    .toBeGreaterThan(paused.elapsedMs + 1000);
  await page.getByRole('button', { name: '提前结束本轮', exact: true }).click();
  await page.getByLabel('一句收获、一个疑问或下一步').fill('中途失败必须全部回滚；下次检查日志');
  await page.getByRole('button', { name: '保存复盘', exact: true }).click();
  await expect(page.getByText('复盘已保存到本机。', { exact: true })).toBeVisible();
  const ended = await page.evaluate(() => window.studyCompanion!.focusOverview());
  expect(ended.current).toBeNull();
  expect(ended.recent[0].status).toBe('stopped');
  expect(ended.recent[0].review).toContain('下次检查日志');
  expect(
    (await page.evaluate((d) => window.studyCompanion!.planningOverview(d), day())).tasks[0].status,
  ).toBe('todo');
  const after = await page.evaluate(() => {
    const d = new Date();
    return window.studyCompanion!.studyOverview(d.getFullYear(), d.getMonth() + 1);
  });
  expect(after).toEqual(before);
  await page.getByRole('button', { name: '查看任务／手动完成', exact: true }).click();
  await page.getByRole('button', { name: '手动标记完成', exact: true }).click();
  expect(
    (await page.evaluate((d) => window.studyCompanion!.planningOverview(d), day())).tasks[0].status,
  ).toBe('completed');
  await nav(page, '专注时光');
  await page.getByRole('button', { name: '签到今天', exact: true }).click();
  await app!.close();
  app = undefined;
  page = await launch();
  const saved = await page.evaluate((d) => window.studyCompanion!.planningOverview(d), day());
  expect(saved.projects[0].title).toBe('事务验证项目');
  expect(saved.tasks[0].status).toBe('completed');
  expect((await page.evaluate(() => window.studyCompanion!.focusOverview())).recent[0]).toEqual(
    ended.recent[0],
  );
  writeFileSync(
    join(artifacts, 'manual-workflow.json'),
    JSON.stringify({ root, before, after, saved, ended }, null, 2),
  );
});

test('memory editing retains drafts on cancel and stale revision errors, then deletes only after confirmation', async () => {
  const page = await launch();
  await nav(page, '长期记忆');
  await page.getByRole('button', { name: '新建记忆', exact: true }).click();
  await page.getByLabel('标题', { exact: true }).fill('先给小例子');
  await page.getByRole('textbox', { name: /^内容/ }).fill('学习新概念时先给一个小例子');
  await page.getByRole('button', { name: '确认保存到本机', exact: true }).click();
  await expect(page.locator('.memory-editor [role=status]').first()).toContainText('已保存');
  let saved = (await page.evaluate(() => window.studyCompanion!.listMemories()))[0];
  expect(saved.scope).toBe('local');
  await page.getByRole('textbox', { name: /^内容/ }).fill('未保存的本地草稿');
  await page.getByRole('button', { name: '新建记忆', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '取消', exact: true }).click();
  await expect(page.getByRole('textbox', { name: /^内容/ })).toHaveValue('未保存的本地草稿');
  saved = await page.evaluate(
    (saved) =>
      window.studyCompanion!.saveMemory({
        content: '另一个窗口已修改',
        id: saved.id,
        revision: saved.revision,
        title: saved.title,
        kind: saved.kind,
        scope: saved.scope,
      }),
    saved,
  );
  await page.getByRole('button', { name: '确认保存到本机', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('版本');
  await expect(page.getByRole('textbox', { name: /^内容/ })).toHaveValue('未保存的本地草稿');
  expect((await page.evaluate(() => window.studyCompanion!.listMemories()))[0].content).toBe(
    '另一个窗口已修改',
  );
  await page.getByRole('button', { name: '删除', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '取消', exact: true }).click();
  expect(await page.evaluate(() => window.studyCompanion!.listMemories())).toHaveLength(1);
  await page.reload();
  await nav(page, '长期记忆');
  await page
    .getByRole('complementary', { name: '记忆列表' })
    .getByRole('button', { name: /先给小例子/ })
    .click();
  await page.getByRole('button', { name: '删除', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '确认删除', exact: true }).click();
  expect(await page.evaluate(() => window.studyCompanion!.listMemories())).toEqual([]);
});

test('exports and restores with the real backup worker, startup switch, preserved data and manual rollback', async () => {
  test.setTimeout(90_000);
  seed();
  let page = await launch();
  await page.evaluate(() => {
    const d = new Date();
    return window.studyCompanion!.checkIn(d.getFullYear(), d.getMonth() + 1);
  });
  const backupParent = mkdtempSync(join(tmpdir(), 'study-v12-export-'));
  await selectFolder(backupParent);
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await page.getByRole('button', { name: '导出完整备份', exact: true }).click();
  await expect(page.getByText('备份已导出', { exact: true })).toBeVisible({ timeout: 30_000 });
  const exported = (await page.evaluate(() => window.studyCompanion!.backupState())).lastExport!;
  expect(inspectDatabases(exported.directory).counts).toEqual(exported.counts);
  const baseline = await page.evaluate(
    async ({ note, conversation, day }) => ({
      note: await window.studyCompanion!.getNote(note),
      conversation: await window.studyCompanion!.getConversation(conversation),
      planning: await window.studyCompanion!.planningOverview(day),
    }),
    { note: fixtureIds.note, conversation: fixtureIds.chat, day: '2026-10-01' },
  );
  await page.evaluate(async () => {
    const settings = (await window.studyCompanion!.bootstrap()).settings;
    return window.studyCompanion!.saveSettings({ ...settings, displayName: '恢复前新昵称' });
  });
  await selectFolder(exported.directory);
  await page.getByRole('button', { name: '选择备份并预览', exact: true }).click();
  await expect(page.getByRole('heading', { name: '恢复内容预览' })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByRole('button', { name: '恢复并重启', exact: true })).toBeDisabled();
  const preview = (await page.evaluate(() => window.studyCompanion!.backupState())).preview!;
  expect((await page.evaluate(() => window.studyCompanion!.bootstrap())).settings.displayName).toBe(
    '恢复前新昵称',
  );
  await app!.evaluate(({ dialog }) => {
    dialog.showMessageBox = async () => ({ response: 0, checkboxChecked: false });
  });
  await page.getByRole('checkbox', { name: /我已保存需要保留的输入/ }).check();
  await page.getByRole('button', { name: '恢复并重启', exact: true }).click();
  await expect
    .poll(async () => (await page.evaluate(() => window.studyCompanion!.backupState())).operation)
    .toBe('idle');
  expect(existsSync(join(root, 'pending-restore.json'))).toBe(false);
  expect((await page.evaluate(() => window.studyCompanion!.backupState())).preview!.id).toBe(
    preview.id,
  );
  // Suppress only OS relaunch; the application quits normally and the test explicitly launches
  // the same source with the same isolated root. The subsequent startup switch is production code.
  await app!.evaluate(({ dialog, app }) => {
    dialog.showMessageBox = async () => ({ response: 1, checkboxChecked: false });
    app.relaunch = () => {};
  });
  const closed = app!.waitForEvent('close');
  await page.getByRole('button', { name: '恢复并重启', exact: true }).click();
  await closed;
  app = undefined;
  expect(existsSync(join(root, 'pending-restore.json'))).toBe(true);
  page = await launch();
  const restored = await page.evaluate(() => window.studyCompanion!.backupState());
  expect(restored.restoreReceipt?.preservedDirectory).toBe(root);
  expect(restored.learningDirectory).not.toBe(root);
  expect(existsSync(join(root, 'pending-restore.json'))).toBe(false);
  const current = await page.evaluate(
    async ({ note, conversation, day }) => ({
      note: await window.studyCompanion!.getNote(note),
      conversation: await window.studyCompanion!.getConversation(conversation),
      planning: await window.studyCompanion!.planningOverview(day),
    }),
    { note: fixtureIds.note, conversation: fixtureIds.chat, day: '2026-10-01' },
  );
  expect(current).toEqual(baseline);
  const original = new Storage(join(root, 'study-companion.sqlite3'));
  expect(original.loadSettings().displayName).toBe('恢复前新昵称');
  original.close();
  expect(
    readFileSync(join(restored.learningDirectory, 'sources', fixtureSourceId + '.md'), 'utf8'),
  ).toBe(fixtureText);
  const active = JSON.parse(readFileSync(join(root, 'active-learning.json'), 'utf8'));
  await app!.close();
  app = undefined;
  renameSync(
    join(root, 'active-learning.json'),
    join(root, 'active-learning.json.saved-for-audit'),
  );
  page = await launch();
  expect((await page.evaluate(() => window.studyCompanion!.bootstrap())).settings.displayName).toBe(
    '恢复前新昵称',
  );
  writeFileSync(
    join(artifacts, 'restore-desktop.json'),
    JSON.stringify(
      {
        root,
        exported,
        preview,
        active,
        restored,
        current,
        manualRollback:
          'active-learning record moved aside after clean exit; original root restored',
      },
      null,
      2,
    ),
  );
});

test('backup operation locks mutation IPC and cancellation leaves the current databases unchanged', async () => {
  seed();
  const page = await launch();
  await app!.evaluate(({ dialog }) => {
    dialog.showOpenDialog = () =>
      new Promise((resolve) => {
        (
          globalThis as unknown as {
            finishAuditDialog: (value: Electron.OpenDialogReturnValue) => void;
          }
        ).finishAuditDialog = resolve;
      });
  });
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await page.getByRole('button', { name: '导出完整备份', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  const blocked = await page.evaluate(async () => {
    try {
      await window.studyCompanion!.createConversation();
      return null;
    } catch (error) {
      return (error as { code: string }).code;
    }
  });
  expect(blocked).toBe('backupBusy');
  await page.getByRole('button', { name: '取消操作', exact: true }).click();
  await app!.evaluate(() => {
    (
      globalThis as unknown as {
        finishAuditDialog: (value: Electron.OpenDialogReturnValue) => void;
      }
    ).finishAuditDialog({ canceled: true, filePaths: [] });
  });
  await expect(page.getByRole('dialog')).not.toBeVisible();
  expect((await page.evaluate(() => window.studyCompanion!.backupState())).lastError).toBeNull();
  expect(existsSync(join(root, 'pending-restore.json'))).toBe(false);
  expect(
    (await page.evaluate((id) => window.studyCompanion!.getNote(id), fixtureIds.note)).title,
  ).toBe('事务笔记');
});

test('rejects array-valued reading tone through real IPC without making complete backup impossible', async () => {
  seed();
  const page = await launch();
  const result = await page.evaluate(async (id) => {
    const api = window.studyCompanion!;
    const source = (await api.listSources()).find((source) => source.id === id)!;
    let error: string | null = null;
    try {
      await api.saveReadingPosition(id, {
        ...source.position,
        tone: ['paper'],
      } as unknown as typeof source.position);
    } catch (reason) {
      error = (reason as { code: string }).code;
    }
    return {
      error,
      before: source.position,
      position: (await api.listSources()).find((source) => source.id === id)!.position,
    };
  }, fixtureSourceId);
  await app!.close();
  app = undefined;
  let backupError: string | null = null;
  try {
    inspectDatabases(root);
  } catch (error) {
    backupError = String(error);
  }
  writeFileSync(
    join(artifacts, 'reading-tone-ipc.json'),
    JSON.stringify(
      {
        root,
        result,
        backupError,
        sourceId: fixtureSourceId,
        sha256: createHash('sha256')
          .update(readFileSync(join(root, 'study-companion.sqlite3')))
          .digest('hex'),
      },
      null,
      2,
    ),
  );
  expect(result.error).toBe('readingPosition');
  expect(result.position).toEqual(result.before);
  expect(backupError).toBeNull();
});
