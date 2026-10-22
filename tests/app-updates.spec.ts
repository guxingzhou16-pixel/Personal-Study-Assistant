import { test, expect, _electron as electron, type ElectronApplication } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const repository = 'https://github.com/guxingzhou16-pixel/Personal-Study-Assistant';
const release = {
  id: 200,
  tag_name: 'v0.2.0',
  name: '拾知 0.2.0',
  draft: false,
  prerelease: false,
  published_at: '2026-10-21T08:00:00Z',
  html_url: `${repository}/releases/tag/v0.2.0`,
  body: '改进阅读与学习安排。\n<img src="https://example.invalid/tracking.png">',
  assets: [
    {
      name: 'StudyCompanion-0.2.0-win-x64-setup.exe',
      state: 'uploaded',
      size: 140_000_000,
      browser_download_url: `${repository}/releases/download/v0.2.0/StudyCompanion-0.2.0-win-x64-setup.exe`,
    },
  ],
};

interface Probe {
  fail: boolean;
  requests: string[];
  opened: string[];
}

async function launch(fail = false) {
  const data = mkdtempSync(join(tmpdir(), 'study-app-updates-'));
  const { ELECTRON_RUN_AS_NODE: _ignored, ...env } = process.env;
  const app = await electron.launch({
    args: ['.'],
    env: { ...env, STUDY_COMPANION_DATA_DIR: data },
  });
  await app.evaluate(
    ({ net, shell }, input) => {
      const probe: Probe = { fail: input.fail, requests: [], opened: [] };
      (globalThis as unknown as { appUpdateProbe: Probe }).appUpdateProbe = probe;
      net.fetch = async (url) => {
        probe.requests.push(String(url));
        if (
          !String(url).startsWith(
            'https://api.github.com/repos/guxingzhou16-pixel/Personal-Study-Assistant/releases?',
          )
        )
          throw new Error('Unexpected update destination');
        return new Response(
          JSON.stringify(probe.fail ? { message: 'unavailable' } : [input.release]),
          {
            status: probe.fail ? 503 : 200,
            headers: { 'content-type': 'application/json' },
          },
        );
      };
      shell.openExternal = async (url) => {
        probe.opened.push(url);
      };
    },
    { release, fail },
  );
  const page = await app.firstWindow();
  page.setDefaultTimeout(10_000);
  return { app, page };
}

async function probe(app: ElectronApplication) {
  return app.evaluate(() => {
    const state = (globalThis as unknown as { appUpdateProbe: Probe }).appUpdateProbe;
    return { requests: state.requests, opened: state.opened };
  });
}

test('settings shows release notes and upgrades only through the checked official release page', async () => {
  const { app, page } = await launch();
  try {
    await page.getByRole('button', { name: '设置', exact: true }).click();
    const panel = page.getByRole('region', { name: '软件更新', exact: true });
    await expect(panel.getByRole('heading', { name: '软件更新', exact: true })).toBeVisible();
    await expect(panel.getByText('发现新版本', { exact: true })).toBeVisible();
    await expect(panel.getByText(/本地开发/)).toBeVisible();
    await expect(panel.getByText(/改进阅读与学习安排/)).toBeVisible();
    await expect(panel.locator('img')).toHaveCount(0);
    await expect(panel.locator('script')).toHaveCount(0);
    expect((await probe(app)).requests).toHaveLength(1);
    await panel.getByRole('button', { name: '升级最新版', exact: true }).click();
    await expect
      .poll(async () => (await probe(app)).opened)
      .toEqual([`${repository}/releases/tag/v0.2.0`]);
    const rejected = await page.evaluate(async () => {
      const api = window.studyCompanion as unknown as {
        openAppUpdate(target: unknown): Promise<void>;
      };
      try {
        await api.openAppUpdate('https://example.invalid/untrusted.exe');
        return false;
      } catch {
        return true;
      }
    });
    expect(rejected).toBe(true);
    expect((await probe(app)).opened).toHaveLength(1);
    await page.setViewportSize({ width: 900, height: 640 });
    await panel.getByRole('button', { name: '检查更新', exact: true }).focus();
    await expect(panel.getByRole('button', { name: '检查更新', exact: true })).toBeInViewport();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  } finally {
    await app.close();
  }
});

test('a failed check can be retried and switching settings reuses a successful check', async () => {
  const { app, page } = await launch(true);
  try {
    await page.getByRole('button', { name: '设置', exact: true }).click();
    const panel = page.getByRole('region', { name: '软件更新', exact: true });
    await expect(panel.getByRole('alert')).toBeVisible();
    await panel.getByRole('button', { name: '查看发布记录', exact: true }).click();
    await expect.poll(async () => (await probe(app)).opened).toEqual([`${repository}/releases`]);
    await app.evaluate(() => {
      (globalThis as unknown as { appUpdateProbe: Probe }).appUpdateProbe.fail = false;
    });
    await panel.getByRole('button', { name: '检查更新', exact: true }).click();
    await expect(panel.getByText('发现新版本', { exact: true })).toBeVisible();
    await expect(panel.getByRole('alert')).toHaveCount(0);
    expect((await probe(app)).requests).toHaveLength(2);
    await page.getByRole('button', { name: '学习首页', exact: true }).click();
    await page.getByRole('button', { name: '设置', exact: true }).click();
    await expect(panel.getByText('发现新版本', { exact: true })).toBeVisible();
    expect((await probe(app)).requests).toHaveLength(2);
  } finally {
    await app.close();
  }
});
