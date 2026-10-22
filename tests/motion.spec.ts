import { test, expect, _electron as electron } from '@playwright/test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { createReadingFiles } from './fixtures/reading-files';

declare global {
  interface Window {
    __motionEvents: { name: string; key: string | undefined; duration: number }[];
  }
}

test('navigation indicator follows the selected button when all learning entries wrap', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'study-motion-navigation-'));
  const { ELECTRON_RUN_AS_NODE: _ignored, ...env } = process.env;
  const app = await electron.launch({
    args: ['.'],
    env: { ...env, STUDY_COMPANION_DATA_DIR: directory },
  });
  try {
    const page = await app.firstWindow();
    await page.setViewportSize({ width: 900, height: 640 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.getByRole('button', { name: '学习助手', exact: true }).click();
    await expect(page.getByRole('heading', { name: '从一个具体的问题开始' })).toBeInViewport({ ratio: 1 });
    await expect(page.getByRole('textbox', { name: '输入学习问题' })).toBeInViewport({ ratio: 1 });
    await page.getByRole('button', { name: '学习计划', exact: true }).click();
    await expect
      .poll(async () => {
        const indicator = await page.locator('.nav-indicator').boundingBox();
        const selected = await page.locator('.nav-item[aria-current="page"]').boundingBox();
        if (!indicator || !selected) return false;
        return ['x', 'y', 'width', 'height'].every(
          (key) =>
            Math.abs(
              indicator[key as keyof typeof indicator] - selected[key as keyof typeof selected],
            ) < 1,
        );
      })
      .toBe(true);
  } finally {
    await app.close();
  }
});

for (const reduced of [false, true]) {
  test(`motion remains interruptible and preserves real actions (${reduced ? 'reduced' : 'normal'})`, async () => {
    test.setTimeout(90_000);
    const directory = mkdtempSync(join(tmpdir(), 'study-motion-'));
    const files = await createReadingFiles(directory);
    const markdown = join(directory, '动效阅读示例.md');
    writeFileSync(
      markdown,
      '# 学习记录\n\n## 事务隔离\n\n事务隔离避免脏读。阅读后用自己的话说明事务隔离，并对照原文核实。\n',
    );
    const { ELECTRON_RUN_AS_NODE: _ignored, ...env } = process.env;
    const app = await electron.launch({
      args: ['.'],
      env: { ...env, STUDY_COMPANION_DATA_DIR: join(directory, 'data') },
    });
    try {
      const page = await app.firstWindow();
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await expect(page.locator('.home-page')).toBeVisible();
      await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' });
      await page.addInitScript(() => {
        window.__motionEvents = [];
        const original = Element.prototype.animate;
        Element.prototype.animate = function (frames, options) {
          if (this instanceof HTMLElement) {
            window.__motionEvents.push({
              name:
                this.dataset.motion ||
                (this.classList.contains('nav-indicator') ? 'navigation' : ''),
              key: this.dataset.motionKey,
              duration: typeof options === 'object' ? Number(options?.duration) : Number(options),
            });
          }
          return original.call(this, frames, options);
        };
      });
      await page.reload();
      await expect(page.locator('.home-page')).toBeVisible();
      const initialEvents = await page.evaluate(() => window.__motionEvents.length);
      if (reduced) expect(initialEvents).toBe(0);
      else expect(initialEvents).toBeGreaterThan(0);
      await page.getByRole('button', { name: '资料库', exact: true }).click();
      await page.getByRole('button', { name: '学习助手', exact: true }).click();
      await page.getByRole('button', { name: '学习首页', exact: true }).click();
      await expect(page.locator('.home-page')).toBeVisible();
      // Selecting the already active page must not replay its entrance.
      const before = await page.evaluate(() => window.__motionEvents.length);
      await page.getByRole('button', { name: '学习首页', exact: true }).click();
      expect(await page.evaluate(() => window.__motionEvents.length)).toBe(before);
      await page.getByRole('button', { name: '今日签到', exact: true }).click();
      await expect(page.getByRole('button', { name: '今日已签到', exact: true })).toBeDisabled();
      await page.getByRole('button', { name: '开始学习', exact: true }).click();
      await expect
        .poll(() => page.getByTestId('study-duration').textContent())
        .not.toBe('00:00:00');
      const timerEvents = await page.evaluate(
        () => window.__motionEvents.filter((e) => e.name === 'state' && e.key === 'true').length,
      );
      const firstDuration = await page.getByTestId('study-duration').textContent();
      await expect
        .poll(() => page.getByTestId('study-duration').textContent())
        .not.toBe(firstDuration);
      expect(
        await page.evaluate(
          () => window.__motionEvents.filter((e) => e.name === 'state' && e.key === 'true').length,
        ),
      ).toBe(timerEvents);
      await page.getByRole('button', { name: '暂停计时', exact: true }).click();
      await app.evaluate(
        ({ dialog }, paths) => {
          dialog.showOpenDialog = async () => ({ canceled: false, filePaths: paths });
        },
        [markdown, files.pdf],
      );
      await page.getByRole('button', { name: '资料库', exact: true }).click();
      await page.getByRole('button', { name: '导入资料', exact: true }).click();
      await expect(page.getByText('导入完成：2 份新增，0 份重复，0 份失败。')).toBeVisible({
        timeout: 15_000,
      });
      await page.getByRole('textbox', { name: '搜索资料' }).fill('不存在');
      await expect(page.getByText('没有找到匹配的资料，换个关键词试试。')).toBeVisible();
      await page.getByRole('textbox', { name: '搜索资料' }).clear();
      if (reduced) {
        await page.getByRole('button', { name: '阅读 Learning Notes', exact: true }).hover();
        expect(
          await page
            .locator('.source-card')
            .last()
            .evaluate((element) => getComputedStyle(element).transform),
        ).toBe('none');
      }
      await page.getByRole('button', { name: '阅读 Learning Notes', exact: true }).click();
      await expect(page.getByTestId('pdf-text-layer')).toContainText('Active recall');
      await page.getByRole('button', { name: '目录', exact: true }).click();
      await expect(page.locator('.reader-outline')).toHaveAttribute('inert', '');
      await page.getByRole('button', { name: '目录', exact: true }).click();
      await expect(page.locator('.reader-outline')).toBeVisible();
      await page.getByRole('button', { name: '下一页', exact: true }).click();
      await expect(page.getByTestId('pdf-text-layer')).toContainText('Evidence matters');
      expect(
        await page
          .locator('.pdf-page')
          .evaluate((el) =>
            el
              .getAnimations()
              .every((a) =>
                (a.effect as KeyframeEffect).getKeyframes().every((k) => !('transform' in k)),
              ),
          ),
      ).toBe(true);
      await page.getByRole('button', { name: '返回资料库', exact: true }).click();
      await page.getByRole('button', { name: '学习助手', exact: true }).click();
      await page.getByRole('combobox', { name: '问答方式' }).selectOption('sources');
      await page.getByRole('textbox', { name: '输入学习问题' }).fill('事务隔离');
      await page.getByRole('button', { name: '检索原文', exact: true }).click();
      const evidence = page.locator('.evidence-preview details').first();
      await expect(evidence).toBeVisible();
      await evidence.locator('summary').click();
      await expect(evidence).toHaveAttribute('open', '');
      await evidence.locator('summary').click();
      await expect(evidence).not.toHaveAttribute('open', '');
      await page.setViewportSize({ width: 900, height: 640 });
      await expect(page.getByRole('textbox', { name: '输入学习问题' })).toBeInViewport();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.screenshot({ path: `artifacts/motion-${reduced ? 'reduced' : 'normal'}-900.png` });
      if (reduced) expect(await page.evaluate(() => window.__motionEvents)).toEqual([]);
      else {
        expect(
          await page.evaluate(() => window.__motionEvents.some((e) => e.name === 'navigation')),
        ).toBe(true);
        // Changing the system preference must cancel animations already in flight.
        await page.getByRole('button', { name: '学习首页', exact: true }).click();
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await expect.poll(() => page.evaluate(() => document.getAnimations().length)).toBe(0);
      }
      expect(errors).toEqual([]);
    } finally {
      await app.close();
      const target = resolve(directory);
      if (!target.startsWith(resolve(tmpdir()) + sep) || !target.includes('study-motion-'))
        throw new Error('Unexpected cleanup path');
      rmSync(target, { recursive: true, force: true });
    }
  });
}
