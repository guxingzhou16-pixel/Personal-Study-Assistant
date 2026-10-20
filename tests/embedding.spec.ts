import { test, expect, _electron as electron } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

test('desktop offers an explicit local-model download and cancellation preserves keyword reading', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'study-embedding-desktop-'));
  const { ELECTRON_RUN_AS_NODE: _ignored, ...env } = process.env;
  const application = await electron.launch({
    args: ['.'],
    env: { ...env, STUDY_COMPANION_DATA_DIR: directory },
  });
  try {
    await application.evaluate(({ net }) => {
      net.fetch = async (_input, init) =>
        new Promise((_resolve, reject) => {
          if (init?.signal?.aborted) reject(new Error('cancelled'));
          else
            init?.signal?.addEventListener('abort', () => reject(new Error('cancelled')), {
              once: true,
            });
        });
    });
    const page = await application.firstWindow();
    await page.getByRole('button', { name: '设置', exact: true }).click();
    await expect(page.getByRole('heading', { name: '本地语义检索' })).toBeVisible();
    await expect(page.getByText('尚未下载，仍可使用关键词检索。', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: '下载检索模型', exact: true }).click();
    await expect(page.getByRole('button', { name: '取消模型下载', exact: true })).toBeVisible();
    await page.getByRole('button', { name: '取消模型下载', exact: true }).click();
    await expect(
      page.getByText('已取消模型下载，关键词检索仍可用。', { exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: '下载检索模型', exact: true })).toBeEnabled();
    expect(await page.evaluate(() => window.studyCompanion!.embeddingStatus())).toMatchObject({
      state: 'missing',
    });
    await page.getByRole('button', { name: '学习助手', exact: true }).click();
    const result = await page.evaluate(() =>
      window.studyCompanion!.prepareQuestion('事务隔离', null),
    );
    expect(result).toMatchObject({ hits: [], notice: expect.stringContaining('已使用关键词检索') });
  } finally {
    await application.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
