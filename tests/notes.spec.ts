import {
  test,
  expect,
  _electron as electron,
  type ElectronApplication,
  type Page,
} from '@playwright/test';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { once } from 'node:events';
import { execFileSync } from 'node:child_process';
import {
  createLegacyNotesDatabase,
  legacyConversationId,
  legacySourceId,
  legacyText,
  legacyTurnId,
} from './fixtures/notes-legacy';

let directory: string;
let application: ElectronApplication | undefined;
test.beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'study-notes-desktop-'));
});
test.afterEach(async () => {
  if (application) {
    await application.evaluate(({ dialog }) => {
      dialog.showMessageBox = async () => ({ response: 1, checkboxChecked: false });
    });
    await application.close();
    application = undefined;
  }
  rmSync(directory, { recursive: true, force: true });
});
async function launch() {
  const { ELECTRON_RUN_AS_NODE: _ignored, STUDY_COMPANION_DEV_URL: _dev, ...taskEnv } = process.env;
  application = await electron.launch({
    args: ['.'],
    env: { ...taskEnv, STUDY_COMPANION_DATA_DIR: join(directory, 'data') },
  });
  return application.firstWindow();
}
async function notesPage(page: Page) {
  await page.getByRole('button', { name: '学习笔记', exact: true }).click();
  await expect(page.getByRole('heading', { name: '学习笔记', exact: true })).toBeVisible();
}
async function fillNote(page: Page, title = '事务笔记') {
  await page.getByLabel('笔记标题', { exact: true }).fill(title);
  await page.getByRole('textbox', { name: /我的理解/ }).fill('中文🙂\n```ts\ncommit();\n```');
  await page
    .getByRole('textbox', { name: /原文依据/ })
    .fill('事务全部提交或回滚。出处：事务学习.md');
  await page.getByRole('textbox', { name: /待解问题/ }).fill('失败如何处理？');
  await page.getByRole('textbox', { name: /下一步练习/ }).fill('写一个回滚示例');
}
async function save(page: Page) {
  await page.getByRole('button', { name: '保存笔记', exact: true }).click();
  await expect(page.getByText('笔记已保存到本机。', { exact: true })).toBeVisible();
}
async function chooseExport(path: string | null) {
  await application!.evaluate(({ dialog }, selected) => {
    dialog.showSaveDialog = async () => ({ canceled: selected === null, filePath: selected ?? '' });
  }, path);
}
function noteList(page: Page) {
  return page.getByRole('complementary', { name: '笔记列表' });
}

test('migrates a v4 desktop database and restores saved notes, old evidence and activity after clean and abrupt exits', async () => {
  test.setTimeout(90_000);
  const data = join(directory, 'data');
  mkdirSync(join(data, 'sources'), { recursive: true });
  const path = join(data, 'study-companion.sqlite3');
  createLegacyNotesDatabase(path);
  writeFileSync(join(data, 'sources', legacySourceId + '.md'), legacyText);
  let page = await launch();
  const networkRequests: string[] = [];
  page.on('request', (request) => {
    if (/^https?:/.test(request.url())) networkRequests.push(request.url());
  });
  await expect(page.getByRole('heading', { name: '迁移验收，开始今天的小进步' })).toBeVisible();
  await page.getByRole('button', { name: '今日签到', exact: true }).click();
  const activity = await page.evaluate(() => {
    const now = new Date();
    return window.studyCompanion!.studyOverview(now.getFullYear(), now.getMonth() + 1);
  });
  const old = await page.evaluate(
    async ({ conversationId, turnId }) => ({
      conversation: await window.studyCompanion!.getConversation(conversationId),
      citation: await window.studyCompanion!.resolveCitation(turnId, 1),
    }),
    { conversationId: legacyConversationId, turnId: legacyTurnId },
  );
  expect(old.conversation.turns[0].answer).toBe('全部提交或者回滚。[1]');
  expect(old.citation).toEqual({ sourceId: legacySourceId, anchor: 'md-line-1', page: 1 });
  await notesPage(page);
  await page.getByRole('button', { name: '新建笔记', exact: true }).click();
  await fillNote(page);
  await page.getByRole('combobox', { name: '关联资料', exact: true }).selectOption(legacySourceId);
  await save(page);
  const saved = await page.evaluate(async () =>
    window.studyCompanion!.getNote((await window.studyCompanion!.listNotes())[0].id),
  );
  await page.getByRole('button', { name: '查看资料', exact: true }).click();
  await expect(page.getByRole('heading', { name: '事务学习', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '返回笔记', exact: true }).click();
  await expect(page.getByLabel('笔记标题', { exact: true })).toHaveValue('事务笔记');
  await application!.close();
  application = undefined;
  page = await launch();
  await notesPage(page);
  await noteList(page)
    .getByRole('button', { name: /事务笔记/ })
    .click();
  await expect(page.getByRole('textbox', { name: /我的理解/ })).toHaveValue(saved.understanding);
  expect(await page.evaluate((id) => window.studyCompanion!.getNote(id), saved.id)).toEqual(saved);
  expect(
    await page.evaluate((id) => window.studyCompanion!.getConversation(id), legacyConversationId),
  ).toEqual(old.conversation);
  expect(
    await page.evaluate(() => {
      const now = new Date();
      return window.studyCompanion!.studyOverview(now.getFullYear(), now.getMonth() + 1);
    }),
  ).toEqual(activity);
  await page.getByRole('textbox', { name: /待解问题/ }).fill('保存后新增的问题');
  await save(page);
  await page.getByRole('textbox', { name: /待解问题/ }).fill('强退前未保存草稿');
  const testProcess = application!.process();
  const exited = once(testProcess, 'exit');
  if (process.platform === 'win32') {
    execFileSync('taskkill', ['/pid', String(testProcess.pid), '/t', '/f']);
  } else expect(testProcess.kill('SIGKILL')).toBe(true);
  await exited;
  application = undefined;
  page = await launch();
  await notesPage(page);
  await noteList(page)
    .getByRole('button', { name: /事务笔记/ })
    .click();
  await expect(page.getByRole('textbox', { name: /待解问题/ })).toHaveValue('保存后新增的问题');
  const db = new DatabaseSync(path, { readOnly: true });
  try {
    expect(db.prepare('PRAGMA user_version').get()?.user_version).toBe(12);
    expect(db.prepare('PRAGMA integrity_check').get()?.integrity_check).toBe('ok');
  } finally {
    db.close();
  }
  const backups = readdirSync(data).filter((name) => name.includes('before-v5-'));
  expect(backups).toHaveLength(1);
  const backup = new DatabaseSync(join(data, backups[0]), { readOnly: true });
  try {
    expect(backup.prepare('PRAGMA user_version').get()?.user_version).toBe(4);
    expect(backup.prepare('SELECT answer FROM chat_turns').get()?.answer).toBe(
      old.conversation.turns[0].answer,
    );
  } finally {
    backup.close();
  }
  expect(networkRequests).toEqual([]);
});

test('keeps drafts, handles save/discard/cancel, search, copying and deletion, including keyboard and minimum window', async () => {
  test.setTimeout(90_000);
  const page = await launch();
  await notesPage(page);
  await page.getByRole('button', { name: '新建笔记', exact: true }).click();
  await fillNote(page);
  await save(page);
  await page.getByRole('textbox', { name: /我的理解/ }).fill('未保存理解');
  await page.getByRole('button', { name: '学习首页', exact: true }).click();
  await notesPage(page);
  await expect(page.getByRole('textbox', { name: /我的理解/ })).toHaveValue('未保存理解');
  await page.getByRole('button', { name: '新建笔记', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('textbox', { name: /我的理解/ })).toHaveValue('未保存理解');
  await page.getByRole('button', { name: '新建笔记', exact: true }).click();
  await dialog.getByRole('button', { name: '保存并继续', exact: true }).click();
  await expect(page.getByLabel('笔记标题', { exact: true })).toHaveValue('');
  await fillNote(page, '第二份笔记');
  await save(page);
  await page.getByRole('textbox', { name: /我的理解/ }).fill('将放弃的修改');
  await noteList(page)
    .getByRole('button', { name: /事务笔记/ })
    .click();
  await dialog.getByRole('button', { name: '取消', exact: true }).click();
  await expect(page.getByLabel('笔记标题', { exact: true })).toHaveValue('第二份笔记');
  await noteList(page)
    .getByRole('button', { name: /事务笔记/ })
    .click();
  await dialog.getByRole('button', { name: '放弃修改并继续', exact: true }).click();
  await expect(page.getByRole('textbox', { name: /我的理解/ })).toHaveValue('未保存理解');
  await page.getByLabel('搜索笔记标题').fill('不存在');
  await expect(page.getByText('没有匹配的标题。')).toBeVisible();
  await page.getByLabel('搜索笔记标题').fill('第二份');
  await expect(noteList(page).getByRole('button', { name: /第二份笔记/ })).toBeVisible();
  await expect(noteList(page).getByRole('button', { name: /事务笔记/ })).toHaveCount(0);
  await page.getByLabel('搜索笔记标题').fill('');
  await page.getByLabel('笔记标题', { exact: true }).fill('另存笔记');
  await page.getByRole('button', { name: '另存为新笔记', exact: true }).click();
  await expect(page.getByText('3 份笔记', { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 900, height: 640 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('textbox', { name: /下一步练习/ }).focus();
  await expect(page.getByRole('textbox', { name: /下一步练习/ })).toBeInViewport();
  await page.getByRole('button', { name: '删除这份笔记', exact: true }).click();
  await dialog.getByRole('button', { name: '取消', exact: true }).click();
  await expect(page.getByText('3 份笔记', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '删除这份笔记', exact: true }).click();
  await dialog.getByRole('button', { name: '确认删除', exact: true }).click();
  await expect(page.getByText('2 份笔记', { exact: true })).toBeVisible();
  await application!.close();
  application = undefined;
  const restarted = await launch();
  await notesPage(restarted);
  await expect(restarted.getByText('2 份笔记', { exact: true })).toBeVisible();
  await expect(noteList(restarted).getByRole('button', { name: /另存笔记/ })).toHaveCount(0);
});

test('rejects stale save/delete/export, retains failed edits and preserves source-entry and normal-exit confirmation', async () => {
  test.setTimeout(90_000);
  const data = join(directory, 'data');
  mkdirSync(join(data, 'sources'), { recursive: true });
  createLegacyNotesDatabase(join(data, 'study-companion.sqlite3'));
  writeFileSync(join(data, 'sources', legacySourceId + '.md'), legacyText);
  const page = await launch();
  await page.getByRole('button', { name: '打开我的资料库' }).click();
  await page.getByRole('button', { name: '阅读 事务学习.md', exact: true }).click();
  await page.getByRole('button', { name: '记笔记', exact: true }).click();
  await expect(page.getByRole('combobox', { name: '关联资料', exact: true })).toHaveValue(
    legacySourceId,
  );
  await fillNote(page);
  await save(page);
  const original = await page.evaluate(async () =>
    window.studyCompanion!.getNote((await window.studyCompanion!.listNotes())[0].id),
  );
  await page.evaluate(async (note) => {
    const { createdAt: _created, updatedAt: _updated, ...draft } = note;
    await window.studyCompanion!.saveNote({ ...draft, understanding: '外部操作的新版本' });
  }, original);
  await page.getByRole('textbox', { name: /我的理解/ }).fill('保存冲突时保留的草稿');
  await page.getByRole('button', { name: '保存笔记', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('尚未覆盖新版本');
  await expect(page.getByRole('textbox', { name: /我的理解/ })).toHaveValue('保存冲突时保留的草稿');
  const refused = await page.evaluate(async (note) => {
    const errors: string[] = [];
    for (const action of [
      () => window.studyCompanion!.deleteNote(note.id, note.revision),
      () => window.studyCompanion!.exportNote(note.id, note.revision),
    ]) {
      try {
        await action();
      } catch (error) {
        errors.push((error as { code: string }).code);
      }
    }
    return errors;
  }, original);
  expect(refused).toEqual(['noteConflict', 'noteConflict']);
  expect(
    (await page.evaluate((id) => window.studyCompanion!.getNote(id), original.id)).understanding,
  ).toBe('外部操作的新版本');
  await page.getByRole('button', { name: '新建笔记', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '保存并继续', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('尚未覆盖新版本');
  await page.getByRole('dialog').getByRole('button', { name: '取消', exact: true }).click();
  await page.getByRole('button', { name: '另存为新笔记', exact: true }).click();
  await expect(page.getByText('2 份笔记', { exact: true })).toBeVisible();
  const copy = await page.evaluate(async (id) => {
    const item = (await window.studyCompanion!.listNotes()).find((note) => note.id !== id)!;
    return window.studyCompanion!.getNote(item.id);
  }, original.id);
  const db = new DatabaseSync(join(data, 'study-companion.sqlite3'));
  try {
    db.exec(
      "CREATE TRIGGER reject_note_write BEFORE UPDATE ON notes BEGIN SELECT RAISE(ABORT, 'simulated write failure'); END;",
    );
    await page.getByRole('textbox', { name: /我的理解/ }).fill('写入失败时的草稿');
    await page.getByRole('button', { name: '保存笔记', exact: true }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByRole('textbox', { name: /我的理解/ })).toHaveValue('写入失败时的草稿');
    expect(await page.evaluate((id) => window.studyCompanion!.getNote(id), copy.id)).toEqual(copy);
    await expect(page.getByText('笔记已保存到本机。', { exact: true })).not.toBeVisible();
  } finally {
    db.exec('DROP TRIGGER reject_note_write;');
    db.close();
  }
  await page.getByRole('button', { name: '重新加载已保存版本', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: '放弃修改并继续', exact: true })
    .click();
  await expect(page.getByRole('textbox', { name: /我的理解/ })).toHaveValue(copy.understanding);
  await page.getByRole('textbox', { name: /我的理解/ }).fill('阅读来回保留的草稿');
  await page.getByRole('button', { name: '查看资料', exact: true }).click();
  await page.getByRole('button', { name: '记笔记', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '取消', exact: true }).click();
  await expect(page.getByRole('textbox', { name: /我的理解/ })).toHaveValue('阅读来回保留的草稿');
  await page.getByRole('button', { name: '学习首页', exact: true }).click();
  await application!.evaluate(({ BrowserWindow, dialog }) => {
    dialog.showMessageBox = async () => ({ response: 0, checkboxChecked: false });
    BrowserWindow.getAllWindows()[0].close();
  });
  await expect(page.getByRole('textbox', { name: /我的理解/ })).toHaveValue('阅读来回保留的草稿');
  // Both responses drive the real window-close handler; only the OS choice is stubbed.
  await application!.evaluate(({ dialog }) => {
    dialog.showMessageBox = async () => ({ response: 1, checkboxChecked: false });
  });
  const exited = application!.waitForEvent('close');
  await application!.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close());
  await exited;
  application = undefined;
  const restarted = await launch();
  await notesPage(restarted);
  const restored = await restarted.evaluate(async () => {
    const list = await window.studyCompanion!.listNotes();
    return Promise.all(list.map((item) => window.studyCompanion!.getNote(item.id)));
  });
  expect(restored.map((note) => note.understanding).sort()).toEqual(
    ['保存冲突时保留的草稿', '外部操作的新版本'].sort(),
  );
  expect(
    (await restarted.evaluate((id) => window.studyCompanion!.getNote(id), copy.id)).revision,
  ).toBe(copy.revision);
});

test('exports the saved UTF-8 snapshot, handles dialog cancellation, protected locations, failures and changes while selecting', async () => {
  test.setTimeout(90_000);
  const page = await launch();
  await notesPage(page);
  await page.getByRole('button', { name: '新建笔记', exact: true }).click();
  await fillNote(page);
  await chooseExport(null);
  await page.getByRole('button', { name: '导出 Markdown', exact: true }).click();
  await expect(page.getByText('导出已取消，笔记仍保存在本机。')).toBeVisible();
  const saved = await page.evaluate(async () =>
    window.studyCompanion!.getNote((await window.studyCompanion!.listNotes())[0].id),
  );
  expect(saved.understanding).toContain('中文🙂');
  const destination = join(directory, '自选名称.md');
  writeFileSync(destination, '旧导出');
  await chooseExport(destination);
  await page.getByRole('button', { name: '导出 Markdown', exact: true }).click();
  await expect(page.getByText('已导出 自选名称.md。')).toBeVisible();
  const exported = readFileSync(destination, 'utf8');
  for (const value of [
    '# 事务笔记',
    '## 我的理解',
    saved.understanding,
    saved.evidence,
    saved.questions,
    saved.nextStep,
  ])
    expect(exported).toContain(value);
  expect(exported).not.toMatch(/apiKey|baseUrl|ollama|credentials/);
  await chooseExport(join(directory, 'data', '禁止.md'));
  await page.getByRole('button', { name: '导出 Markdown', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('数据目录以外');
  await chooseExport(join(directory, 'missing', '失败.md'));
  await page.getByRole('button', { name: '导出 Markdown', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('未能导出');
  expect(readFileSync(destination, 'utf8')).toBe(exported);
  await application!.evaluate(({ dialog }, selected) => {
    dialog.showSaveDialog = () =>
      new Promise((resolve) => {
        (globalThis as unknown as { finishExport: () => void }).finishExport = () =>
          resolve({ canceled: false, filePath: selected });
      });
  }, destination);
  await page.getByRole('button', { name: '导出 Markdown', exact: true }).click();
  await expect(page.getByRole('button', { name: '导出 Markdown', exact: true })).toBeDisabled();
  await page.evaluate(async (note) => {
    const { createdAt: _created, updatedAt: _updated, ...draft } = note;
    await window.studyCompanion!.saveNote({ ...draft, nextStep: '选址期间修改' });
  }, saved);
  await expect
    .poll(() =>
      application!.evaluate(
        () => typeof (globalThis as unknown as { finishExport?: () => void }).finishExport,
      ),
    )
    .toBe('function');
  await application!.evaluate(() =>
    (globalThis as unknown as { finishExport: () => void }).finishExport(),
  );
  await expect(page.getByRole('alert')).toContainText('选择位置期间笔记已更新');
  expect(readFileSync(destination, 'utf8')).toBe(exported);
});
