import { test, expect, _electron as electron, type ElectronApplication } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Storage } from '../electron/core/storage';
import {
  createLegacyDatabase,
  fixtureIds,
  fixtureTurn,
  fixtureSourceId,
  fixtureText,
} from './fixtures/legacy-databases';

test('saved recall and manual dates survive restart, remain separate from mastery, and open original evidence', async () => {
  const root = mkdtempSync(join(tmpdir(), 'study-reviews-desktop-'));
  const exportRoot = mkdtempSync(join(tmpdir(), 'study-reviews-export-'));
  const path = join(root, 'study-companion.sqlite3');
  createLegacyDatabase(path, 11);
  mkdirSync(join(root, 'sources'));
  writeFileSync(join(root, 'sources', `${fixtureSourceId}.md`), fixtureText);
  const storage = new Storage(path);
  const turn = fixtureTurn(fixtureIds.chat, {
    id: randomUUID(),
    practiceRequest: { kind: 'quiz', topic: '事务', sourceId: fixtureSourceId },
    answer: JSON.stringify({
      items: [1, 2, 3].map((index) => ({
        question: `事务回忆问题 ${index}`,
        answer: '事务要么全部提交，要么全部回滚。',
        citations: [1],
      })),
    }),
  });
  storage.chat.addTurn(turn);
  storage.close();
  const { ELECTRON_RUN_AS_NODE: _ignored, ...env } = process.env;
  let app: ElectronApplication | undefined;
  async function launch() {
    app = await electron.launch({ args: ['.'], env: { ...env, STUDY_COMPANION_DATA_DIR: root } });
    return app.firstWindow();
  }
  try {
    let page = await launch();
    await page.getByRole('button', { name: '学习助手', exact: true }).click();
    await page
      .getByRole('textbox', { name: '第 1 题 · 我的作答', exact: true })
      .fill('我先记下自己的回答。');
    await page.getByRole('checkbox', { name: '第 1 题仍有疑问', exact: true }).check();
    await page.getByLabel('第 1 题复习日期', { exact: true }).fill('2026-10-13');
    await page.getByRole('button', { name: '保存第 1 题作答与安排', exact: true }).click();
    await expect(
      page.getByText('第 1 题的作答与安排已保存；没有评分或掌握判断。', { exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: '学习首页', exact: true }).click();
    await expect(
      page.getByText('1 项到期安排或未解决疑问；已保存 1 份作答。', { exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: '打开轻量复习', exact: true }).click();
    await page.locator('.review-list-item').first().click();
    await expect(page.locator('.reviews-page h3')).toHaveCount(0);
    await page.getByRole('button', { name: '开始这次回忆', exact: true }).click();
    await page
      .getByRole('textbox', { name: '这次的回忆与作答', exact: true })
      .fill('我这次回忆到全部提交或全部回滚。');
    await page.getByRole('button', { name: '查看参考答案与出处', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: '参考答案（AI生成，需核对）', exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: '复习出处 [1]', exact: true }).click();
    await expect(page.locator('.markdown-reading')).toBeVisible();
    await page.getByRole('button', { name: '返回复习', exact: true }).click();
    await expect(page.getByRole('textbox', { name: '这次的回忆与作答', exact: true })).toHaveValue(
      '我这次回忆到全部提交或全部回滚。',
    );
    await page.getByRole('button', { name: '保存作答与复习安排', exact: true }).click();
    await expect(
      page.getByText('这份作答和复习安排已保存，没有评分或掌握判断。', { exact: true }),
    ).toBeVisible();
    const saved = (await page.evaluate(() => window.studyCompanion!.listReviews(null)))[0];
    const exportPath = join(exportRoot, '作答.md');
    await app!.evaluate(({ dialog }, filePath) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath });
    }, exportPath);
    await page
      .getByRole('button', { name: '导出已保存作答（不含未保存输入）', exact: true })
      .click();
    await expect(page.getByText('已导出 作答.md', { exact: true })).toBeVisible();
    expect(readFileSync(exportPath, 'utf8')).toContain(saved.response);
    expect(readFileSync(exportPath, 'utf8')).toContain('2026-10-13');
    await app!.close();
    app = undefined;
    page = await launch();
    await page.getByRole('button', { name: '轻量复习', exact: true }).click();
    await page.locator('.review-list-item').first().click();
    await page.getByRole('button', { name: '查看上次保存的作答', exact: true }).click();
    await expect(
      page
        .getByRole('region', { name: '轻量复习', exact: true })
        .getByText(saved.response, { exact: true }),
    ).toBeVisible();
    expect(await page.evaluate((id) => window.studyCompanion!.getReview(id), saved.id)).toEqual(
      saved,
    );
    await page.screenshot({ path: 'artifacts/saved-recall.png' });
  } finally {
    await app?.close();
  }
});
