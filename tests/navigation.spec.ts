import { test, expect, _electron as electron } from '@playwright/test';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openPage } from './helpers/navigation';
import { createLegacyDatabase, fixtureSourceId, fixtureText } from './fixtures/legacy-databases';

for (const reduced of [false, true]) {
  test(`three primary entries, optional guide and secondary destinations (${reduced ? 'reduced' : 'normal'})`, async () => {
    const { ELECTRON_RUN_AS_NODE: _ignored, ...env } = process.env;
    const app = await electron.launch({
      args: ['.'],
      env: { ...env, STUDY_COMPANION_DATA_DIR: mkdtempSync(join(tmpdir(), 'study-navigation-')) },
    });
    try {
      const page = await app.firstWindow();
      await expect(page.locator('.home-page')).toBeVisible();
      await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' });
      const nav = page.getByRole('navigation', { name: '主导航' });
      await expect(nav.getByRole('button')).toHaveText(['学习首页', '资料库', '学习助手']);
      await expect(page.locator('.first-use-guide')).not.toHaveAttribute('open');
      const summary = page.locator('.first-use-guide summary');
      await summary.focus();
      await page.keyboard.press('Enter');
      await expect(page.getByRole('button', { name: '导入学习示例', exact: true })).toBeVisible();
      await page.keyboard.press('Enter');
      await expect(page.locator('.first-use-guide')).not.toHaveAttribute('open');
      await expect(page.getByText('还没有学习路线', { exact: true })).toBeVisible();
      await expect(page.getByText('还没有学习笔记', { exact: true })).toBeVisible();
      for (const size of [
        { width: 1280, height: 900 },
        { width: 900, height: 640 },
      ]) {
        await page.setViewportSize(size);
        const brand = await page.locator('.brand').boundingBox();
        const settings = await page
          .getByRole('button', { name: '设置', exact: true })
          .boundingBox();
        const avatar = await page.locator('.header-tools .profile-avatar').boundingBox();
        expect(settings!.x).toBeGreaterThan(brand!.x + brand!.width);
        expect(settings!.x).toBeLessThan(size.width / 2);
        expect(avatar!.x).toBeGreaterThan(size.width / 2);
        await expect(nav).toBeInViewport({ ratio: 1 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
      }
      for (const name of ['专注时光', '学习计划', '轻量复习', '长期记忆']) {
        await openPage(page, name);
        await expect(page.getByRole('button', { name: '设置', exact: true })).toHaveAttribute(
          'aria-current',
          'page',
        );
        await expect(nav.locator('[aria-current]')).toHaveCount(0);
        await page.getByRole('button', { name: '返回设置', exact: true }).click();
        await expect(page.getByRole('region', { name: '学习工具', exact: true })).toBeVisible();
      }
      for (const name of ['学习路线', '学习笔记']) {
        await openPage(page, name);
        await expect(nav.getByRole('button', { name: '学习首页', exact: true })).toHaveAttribute(
          'aria-current',
          'page',
        );
        await page.getByRole('button', { name: '返回学习首页', exact: true }).click();
      }
      expect(await page.evaluate(() => window.studyCompanion!.listSources())).toEqual([]);
      expect(await page.evaluate(() => window.studyCompanion!.listNotes())).toEqual([]);
      expect(await page.evaluate(() => window.studyCompanion!.listLearningDrafts())).toEqual([]);
    } finally {
      await app.close();
    }
  });
}

test('home summaries refresh saved data, preserve drafts and distinguish errors from empty records', async () => {
  const root = mkdtempSync(join(tmpdir(), 'study-home-summary-'));
  createLegacyDatabase(join(root, 'study-companion.sqlite3'), 11);
  mkdirSync(join(root, 'sources'));
  writeFileSync(join(root, 'sources', fixtureSourceId + '.md'), fixtureText);
  const { ELECTRON_RUN_AS_NODE: _ignored, ...env } = process.env;
  const app = await electron.launch({
    args: ['.'],
    env: { ...env, STUDY_COMPANION_DATA_DIR: root },
  });
  try {
    const page = await app.firstWindow();
    const route = page.getByRole('region', { name: '学习路线', exact: true });
    const notes = page.getByRole('region', { name: '学习笔记', exact: true });
    await expect(route).toContainText('理解事务');
    await expect(route).toContainText('25 分钟预算');
    await expect(route).toContainText('草稿已保存');
    await expect(notes).toContainText('事务笔记');
    await expect(notes).toContainText('事务学习');
    const timeBox = await route.locator('time').boundingBox();
    const linkBox = await route.getByRole('link').boundingBox();
    expect(linkBox!.y).toBeGreaterThanOrEqual(timeBox!.y + timeBox!.height);
    await page.getByRole('link', { name: '查看完整学习笔记', exact: true }).click();
    await expect(page.getByLabel('笔记标题', { exact: true })).toHaveValue('事务笔记');
    await page.getByLabel('笔记标题', { exact: true }).fill('窗口内未保存的笔记');
    await openPage(page, '学习首页');
    await page.getByRole('link', { name: '查看完整学习笔记', exact: true }).click();
    await expect(page.getByLabel('笔记标题', { exact: true })).toHaveValue('窗口内未保存的笔记');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await openPage(page, '学习首页');
    const saved = await page.evaluate(() =>
      window.studyCompanion!.saveNote({
        id: null,
        revision: 0,
        title: '最新保存的笔记',
        sourceId: null,
        understanding: '手动理解',
        evidence: '',
        questions: '',
        nextStep: '',
      }),
    );
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(notes).toContainText('最新保存的笔记');
    await expect(notes).toContainText('共 2 份笔记');
    await page.getByRole('link', { name: '查看完整学习笔记', exact: true }).click();
    await expect(page.getByRole('dialog', { name: '先处理未保存的内容' })).toBeVisible();
    await page.getByRole('button', { name: '取消', exact: true }).click();
    await expect(page.getByLabel('笔记标题', { exact: true })).toHaveValue('窗口内未保存的笔记');
    await openPage(page, '学习首页');
    await page.evaluate(
      (saved) => window.studyCompanion!.deleteNote(saved.id, saved.revision),
      saved,
    );
    await openPage(page, '资料库');
    await openPage(page, '学习首页');
    await expect(notes).toContainText('事务笔记');
    await expect(notes).toContainText('共 1 份笔记');
    const routes = await page.evaluate(() => window.studyCompanion!.listLearningDrafts());
    await app.evaluate(({ ipcMain }) => {
      ipcMain.removeHandler('study:list-learning-drafts');
      ipcMain.handle('study:list-learning-drafts', () => ({
        ok: false,
        error: { code: 'testReadFailure', message: '模拟路线读取失败' },
      }));
    });
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(route.getByRole('alert')).toContainText('模拟路线读取失败');
    await expect(route.getByText('还没有学习路线', { exact: true })).toHaveCount(0);
    await expect(notes).toContainText('事务笔记');
    await app.evaluate(({ ipcMain }, value) => {
      ipcMain.removeHandler('study:list-learning-drafts');
      ipcMain.handle('study:list-learning-drafts', () => ({ ok: true, value }));
    }, routes);
    await page.getByRole('button', { name: '重试读取学习路线', exact: true }).click();
    await expect(route).toContainText('理解事务');
    const stopped = routes.map((turn) => ({
      ...turn,
      status: 'stopped' as const,
      revision: turn.revision + 1,
    }));
    await app.evaluate(({ ipcMain, BrowserWindow }, value) => {
      ipcMain.removeHandler('study:list-learning-drafts');
      ipcMain.handle('study:list-learning-drafts', () => ({ ok: true, value }));
      BrowserWindow.getAllWindows()[0].webContents.send('study:chat-update', value[0]);
    }, stopped);
    await expect(route).toContainText('已停止，保留部分草稿');
    await page.getByRole('link', { name: '查看完整学习路线', exact: true }).click();
    await expect(page.locator('.agent-result .agent-request-summary')).toContainText('理解事务');
  } finally {
    await app.evaluate(({ dialog }) => {
      dialog.showMessageBox = async () => ({ response: 1, checkboxChecked: false });
    });
    await app.close();
  }
});

test('home summaries pause during backup and ignore replies from the earlier read', async () => {
  const { ELECTRON_RUN_AS_NODE: _ignored, ...env } = process.env;
  const app = await electron.launch({
    args: ['.'],
    env: {
      ...env,
      STUDY_COMPANION_DATA_DIR: mkdtempSync(join(tmpdir(), 'study-summary-backup-')),
    },
  });
  try {
    const page = await app.firstWindow();
    await expect(page.getByText('还没有学习路线', { exact: true })).toBeVisible();
    const state = await page.evaluate(() => window.studyCompanion!.backupState());
    await app.evaluate(({ ipcMain }) => {
      const task = globalThis as unknown as {
        summaryReads: number;
        finishSummaryRead?: () => void;
      };
      task.summaryReads = 0;
      ipcMain.removeHandler('study:list-learning-drafts');
      ipcMain.handle('study:list-learning-drafts', () => {
        task.summaryReads++;
        if (task.summaryReads === 1)
          return new Promise((resolve) => {
            task.finishSummaryRead = () => resolve({ ok: true, value: [] });
          });
        return { ok: true, value: [] };
      });
    });
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    const reads = () =>
      app.evaluate(() => (globalThis as unknown as { summaryReads: number }).summaryReads);
    await expect.poll(reads).toBe(1);
    await app.evaluate(({ BrowserWindow }, state) => {
      BrowserWindow.getAllWindows()[0].webContents.send('study:backup-update', {
        ...state,
        revision: state.revision + 100,
        operation: 'export',
        progress: { current: 0, total: 1, message: '测试中的备份事件' },
      });
    }, state);
    const summary = page.locator('.home-learning-summary');
    await expect(summary).toContainText('备份处理结束后会重新读取。');
    await app.evaluate(() =>
      (globalThis as unknown as { finishSummaryRead: () => void }).finishSummaryRead(),
    );
    await page.evaluate(async () => {
      window.dispatchEvent(new Event('focus'));
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
    });
    expect(await reads()).toBe(1);
    await expect(summary).not.toContainText('还没有学习路线');
    await app.evaluate(({ BrowserWindow }, state) => {
      BrowserWindow.getAllWindows()[0].webContents.send('study:backup-update', {
        ...state,
        revision: state.revision + 101,
      });
    }, state);
    await expect(page.getByText('还没有学习路线', { exact: true })).toBeVisible();
    expect(await reads()).toBe(2);
  } finally {
    await app.close();
  }
});
