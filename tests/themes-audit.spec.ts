import { openPage } from './helpers/navigation';
import { randomUUID } from 'node:crypto';
import { test, expect, _electron as electron } from '@playwright/test';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Theme, ResponseStyle } from '../src/lib/types';

const artifacts = join('artifacts', 'final-acceptance-20261010-' + randomUUID());

test.beforeAll(() => {
  mkdirSync(artifacts, { recursive: true });
});

test('records actual theme, keyboard, native window, zoom and visible text contrast evidence', async () => {
  test.setTimeout(90_000);
  const root = mkdtempSync(join(tmpdir(), 'study-themes-audit-'));
  const { ELECTRON_RUN_AS_NODE: _ignored, ...env } = process.env;
  const app = await electron.launch({
    args: ['.'],
    env: { ...env, STUDY_COMPANION_DATA_DIR: root },
  });
  const records: unknown[] = [];
  try {
    const page = await app.firstWindow();
    await expect(page.getByRole('heading', { name: /今天，也长出\s*一点新想法/ })).toBeVisible();
    const themes = [
      ['modern', '清爽现代'],
      ['study', '安静书房'],
      ['playful', '活泼游戏化'],
    ] as const;
    for (const [theme, name] of themes) {
      await app.evaluate(({ BrowserWindow }) => {
        BrowserWindow.getAllWindows()[0].webContents.setZoomFactor(1);
        BrowserWindow.getAllWindows()[0].setContentSize(1360, 900);
      });
      await page.getByRole('button', { name: '设置', exact: true }).click();
      const original = await page.evaluate(() => document.documentElement.dataset.theme);
      const radio = page.getByRole('radio', { name: new RegExp(name) });
      await radio.check();
      expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe(original);
      await radio.focus();
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('ArrowLeft');
      await expect(radio).toBeChecked();
      await page.getByRole('button', { name: '保存设置', exact: true }).click();
      await expect
        .poll(() => page.evaluate(() => document.documentElement.dataset.theme))
        .toBe(theme);
      for (const style of ['gentle', 'game', 'coach'] as ResponseStyle[]) {
        const saved = await page.evaluate(
          async ({ theme, style }: { theme: Theme; style: ResponseStyle }) => {
            const { settings } = await window.studyCompanion!.bootstrap();
            return window.studyCompanion!.saveSettings({
              ...settings,
              theme,
              responseStyle: style,
            });
          },
          { theme, style },
        );
        expect(saved.theme).toBe(theme);
        expect(saved.responseStyle).toBe(style);
      }
      await page.reload();
      await expect
        .poll(() => page.evaluate(() => document.documentElement.dataset.theme))
        .toBe(theme);
      for (const pageName of [
        '学习首页',
        '资料库',
        '学习助手',
        '学习笔记',
        '学习路线',
        '长期记忆',
        '学习计划',
        '专注时光',
        '设置',
      ]) {
        await app.evaluate(({ BrowserWindow }) =>
          BrowserWindow.getAllWindows()[0].setContentSize(1360, 900),
        );
        await openPage(page, pageName);
        await app.evaluate(({ BrowserWindow }) =>
          BrowserWindow.getAllWindows()[0].setContentSize(900, 640),
        );
        const evidence = await page.evaluate(() => {
          const rgb = (text: string) => {
            const numbers = text.match(/[\d.]+/g)?.map(Number) ?? [];
            return { color: numbers.slice(0, 3), alpha: numbers[3] ?? 1 };
          };
          const luminosity = (color: number[]) =>
            color
              .map((v) => v / 255)
              .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
              .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
          const sample: unknown[] = [];
          for (const element of document.querySelectorAll<HTMLElement>(
            'p,small,label,button,span,h1,h2,h3',
          )) {
            const rect = element.getBoundingClientRect();
            const css = getComputedStyle(element);
            if (
              !rect.width ||
              !rect.height ||
              rect.bottom < 0 ||
              rect.top >= innerHeight ||
              css.visibility === 'hidden' ||
              element.closest('[hidden]') ||
              element.matches(':disabled') ||
              !Array.from(element.childNodes).some(
                (n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim(),
              )
            )
              continue;
            let cursor: HTMLElement | null = element;
            let background: number[] | null = null;
            while (cursor) {
              const candidate = rgb(getComputedStyle(cursor).backgroundColor);
              if (candidate.alpha === 1) {
                background = candidate.color;
                break;
              }
              cursor = cursor.parentElement;
            }
            if (!background) continue;
            const foreground = rgb(css.color);
            if (foreground.alpha !== 1) continue;
            const l1 = luminosity(foreground.color),
              l2 = luminosity(background);
            const contrast = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
            const size = parseFloat(css.fontSize);
            const threshold =
              size >= 24 || (size >= 18.666 && Number(css.fontWeight) >= 700) ? 3 : 4.5;
            sample.push({
              text: element.innerText.trim().slice(0, 90),
              tag: element.tagName,
              className: element.className,
              color: css.color,
              background,
              contrast,
              threshold,
              low: contrast < threshold,
            });
          }
          const settings = document.querySelector<HTMLButtonElement>(
            '.app-header [aria-label="设置"]',
          )!;
          const rect = settings.getBoundingClientRect();
          const side = document.querySelector('.app-nav')!;
          return {
            viewport: { width: innerWidth, height: innerHeight },
            horizontalOverflow: document.documentElement.scrollWidth - innerWidth,
            settingsRect: { top: rect.top, bottom: rect.bottom },
            navigationOverflow: {
              scrollHeight: side.scrollHeight,
              clientHeight: side.clientHeight,
              overflowY: getComputedStyle(side).overflowY,
            },
            contrast: sample,
          };
        });
        records.push({ theme, pageName, ...evidence });
        await page.screenshot({
          path: join(artifacts, `theme-${theme}-${pageName}-900.png`),
        });
      }
      for (const zoom of [1.25, 1.5, 2]) {
        await app.evaluate(
          ({ BrowserWindow }, zoom) =>
            BrowserWindow.getAllWindows()[0].webContents.setZoomFactor(zoom),
          zoom,
        );
        records.push({
          theme,
          zoom,
          layout: await page.evaluate(() => ({
            width: innerWidth,
            height: innerHeight,
            scrollWidth: document.documentElement.scrollWidth,
            radios: Array.from(document.querySelectorAll('input[type=radio]')).map((e) => ({
              width: e.getBoundingClientRect().width,
              height: e.getBoundingClientRect().height,
            })),
          })),
        });
        await page.screenshot({
          path: join(artifacts, `theme-${theme}-zoom-${zoom}.png`),
        });
      }
    }
  } finally {
    writeFileSync(
      join(artifacts, 'themes-desktop.json'),
      JSON.stringify(
        {
          root,
          records,
          note: 'Computed opaque foreground/ancestor background samples; gradients, transparency and assistive technology require separate review.',
        },
        null,
        2,
      ),
    );
    await app.close();
  }
});

test('settings navigation stays visible and usable at the declared native minimum window', async () => {
  const root = mkdtempSync(join(tmpdir(), 'study-native-minimum-'));
  const { ELECTRON_RUN_AS_NODE: _ignored, ...env } = process.env;
  const app = await electron.launch({
    args: ['.'],
    env: { ...env, STUDY_COMPANION_DATA_DIR: root },
  });
  try {
    const page = await app.firstWindow();
    await expect(page.getByRole('heading', { name: /今天，也长出\s*一点新想法/ })).toBeVisible();
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].setContentSize(900, 640),
    );
    const button = page.getByRole('button', { name: '设置', exact: true });
    await button.focus();
    const evidence = await page.evaluate(() => {
      const b = document.querySelector('.app-header [aria-label="设置"]')!;
      const r = b.getBoundingClientRect();
      return {
        width: innerWidth,
        height: innerHeight,
        top: r.top,
        bottom: r.bottom,
        navigationScrollHeight: document.querySelector('.app-nav')!.scrollHeight,
      };
    });
    writeFileSync(
      join(artifacts, 'native-minimum.json'),
      JSON.stringify({ root, evidence }, null, 2),
    );
    await page.screenshot({ path: join(artifacts, 'native-minimum.png') });
    await expect(button).toBeInViewport();
    await button.click();
  } finally {
    await app.close();
  }
});

test('modern theme keeps the learning goal unit readable at normal text contrast', async () => {
  const root = mkdtempSync(join(tmpdir(), 'study-theme-contrast-'));
  const { ELECTRON_RUN_AS_NODE: _ignored, ...env } = process.env;
  const app = await electron.launch({
    args: ['.'],
    env: { ...env, STUDY_COMPANION_DATA_DIR: root },
  });
  try {
    const page = await app.firstWindow();
    await expect(page.getByRole('heading', { name: /今天，也长出\s*一点新想法/ })).toBeVisible();
    await page.getByRole('button', { name: '设置', exact: true }).click();
    const evidence = await page
      .locator('.label-detail')
      .first()
      .evaluate((element) => {
        const css = getComputedStyle(element);
        const rgb = (color: string) =>
          color
            .match(/[\d.]+/g)!
            .slice(0, 3)
            .map(Number);
        const l = (color: number[]) =>
          color
            .map((v) => v / 255)
            .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
            .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
        let background = element.parentElement!;
        while (getComputedStyle(background).backgroundColor === 'rgba(0, 0, 0, 0)')
          background = background.parentElement!;
        const bg = getComputedStyle(background).backgroundColor;
        const a = l(rgb(css.color)),
          b = l(rgb(bg));
        return {
          text: element.textContent,
          fontSize: css.fontSize,
          color: css.color,
          background: bg,
          ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
        };
      });
    writeFileSync(
      join(artifacts, 'contrast-regression.json'),
      JSON.stringify({ root, evidence }, null, 2),
    );
    expect(evidence.ratio).toBeGreaterThanOrEqual(4.5);
  } finally {
    await app.close();
  }
});

test('all navigation remains keyboard and mouse accessible across themes and 100–200% zoom', async () => {
  test.setTimeout(90_000);
  const root = mkdtempSync(join(tmpdir(), 'study-navigation-fix-'));
  const { ELECTRON_RUN_AS_NODE: _ignored, ...env } = process.env;
  const app = await electron.launch({
    args: ['.'],
    env: { ...env, STUDY_COMPANION_DATA_DIR: root },
  });
  try {
    const page = await app.firstWindow();
    await expect(page.getByRole('heading', { name: /今天，也长出\s*一点新想法/ })).toBeVisible();
    for (const theme of ['modern', 'study', 'playful'] as const) {
      await page.evaluate(async (theme) => {
        const { settings } = await window.studyCompanion!.bootstrap();
        await window.studyCompanion!.saveSettings({ ...settings, theme });
      }, theme);
      await page.reload();
      await expect
        .poll(() => page.evaluate(() => document.documentElement.dataset.theme))
        .toBe(theme);
      for (const zoom of [1, 1.25, 1.5, 2]) {
        await app.evaluate(({ BrowserWindow }, zoom) => {
          const window = BrowserWindow.getAllWindows()[0];
          window.setContentSize(900, 640);
          window.webContents.setZoomFactor(zoom);
        }, zoom);
        for (const name of ['学习首页', '资料库', '学习助手', '设置']) {
          const button = page.getByRole('button', { name, exact: true });
          await button.focus();
          await expect(button).toBeInViewport({ ratio: 1 });
          await page.keyboard.press('ArrowDown');
          const focus = await button.evaluate((button) => {
            const nav = button.closest('nav');
            if (!nav) return null;
            const rect = button.getBoundingClientRect(),
              clip = nav.getBoundingClientRect();
            const css = getComputedStyle(button);
            const extent = Math.max(
              0,
              parseFloat(css.outlineWidth) + parseFloat(css.outlineOffset),
            );
            return {
              visible: button.matches(':focus-visible'),
              left: rect.left - extent,
              right: rect.right + extent,
              clipLeft: clip.left,
              clipRight: clip.right,
            };
          });
          if (focus) {
            expect(focus.visible).toBe(true);
            expect(focus.left).toBeGreaterThanOrEqual(focus.clipLeft);
            expect(focus.right).toBeLessThanOrEqual(focus.clipRight);
          }
          await page.keyboard.press('Enter');
          await expect(button).toHaveClass(/selected/);
          await button.click();
        }
      }
    }
  } finally {
    await app.close();
  }
});
