import { test, expect, _electron as electron, type ElectronApplication } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('sunny island layout keeps the monthly calendar, check-in and real study time', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'study-calendar-e2e-'));
  const { ELECTRON_RUN_AS_NODE: _ignored, ...taskEnv } = process.env;
  let application: ElectronApplication | undefined;
  async function launch() {
    application = await electron.launch({
      args: ['.'],
      env: { ...taskEnv, STUDY_COMPANION_DATA_DIR: dataDir },
    });
    return application.firstWindow();
  }
  try {
    let page = await launch();
    const now = new Date();
    const title = `${now.getFullYear()}年${now.getMonth() + 1}月学习日历`;
    await expect(page.getByRole('table', { name: title })).toBeVisible();
    await expect(page.getByTestId('study-duration')).toHaveText('00:00:00');
    await expect
      .poll(() =>
        page
          .locator('.plant-illustration')
          .evaluate((image: HTMLImageElement) => image.naturalWidth),
      )
      .toBeGreaterThan(0);
    await page.getByRole('button', { name: '上个月', exact: true }).click();
    await expect(page.getByRole('table')).not.toHaveAccessibleName(title);
    await page.getByRole('button', { name: '本月', exact: true }).click();
    await expect(page.getByRole('table', { name: title })).toBeVisible();
    const layout = await page.evaluate(() => {
      const columns = document.querySelector('.home-columns')!.children;
      const left = columns[0].getBoundingClientRect();
      const right = columns[1].getBoundingClientRect();
      const calendar = document.querySelector('.calendar-panel')!.getBoundingClientRect();
      const timer = document.querySelector('.study-time-panel')!.getBoundingClientRect();
      return {
        leftWidth: left.width,
        rightWidth: right.width,
        calendarBottom: calendar.bottom,
        calendarLeft: calendar.left,
        calendarWidth: calendar.width,
        timerTop: timer.top,
        timerLeft: timer.left,
        timerWidth: timer.width,
      };
    });
    expect(layout.leftWidth).toBeGreaterThan(layout.rightWidth);
    expect(layout.timerTop).toBeGreaterThan(layout.calendarBottom);
    expect(layout.timerLeft).toBeCloseTo(layout.calendarLeft, 1);
    expect(layout.timerWidth).toBeCloseTo(layout.calendarWidth, 1);
    await expect(
      page.locator('.calendar-panel').getByRole('button', { name: '今日签到', exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: '今日签到', exact: true }).click();
    await expect(page.getByRole('button', { name: '今日已签到', exact: true })).toBeDisabled();
    await expect(page.locator('.calendar-day[aria-current="date"]')).toHaveClass(/is-signed/);
    await expect(page.getByText('本月已签到 1 天', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: '开始学习', exact: true }).click();
    await expect(page.getByRole('button', { name: '暂停计时', exact: true })).toBeVisible();
    await expect
      .poll(async () => page.getByTestId('study-duration').textContent())
      .not.toBe('00:00:00');
    await page.getByRole('button', { name: '暂停计时', exact: true }).click();
    const saved = await page.getByTestId('study-duration').textContent();
    await page.locator('.daily-section').screenshot({ path: 'artifacts/study-calendar.png' });
    await page.locator('main').evaluate((element) => element.scrollTo(0, 0));
    await page.screenshot({ path: 'artifacts/calendar-home.png', fullPage: true });
    await application!.close();
    page = await launch();
    await expect(page.getByRole('button', { name: '今日已签到', exact: true })).toBeDisabled();
    await expect(page.getByTestId('study-duration')).toHaveText(saved!);
    await expect(page.getByRole('button', { name: '开始学习', exact: true })).toBeEnabled();
    await page.setViewportSize({ width: 900, height: 640 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    const minimumLayout = await page.evaluate(() => {
      const columns = document.querySelector('.home-columns')!.children;
      const calendar = document.querySelector('.calendar-panel')!.getBoundingClientRect();
      const timer = document.querySelector('.study-time-panel')!.getBoundingClientRect();
      return {
        leftWidth: columns[0].getBoundingClientRect().width,
        rightWidth: columns[1].getBoundingClientRect().width,
        calendarBottom: calendar.bottom,
        timerTop: timer.top,
      };
    });
    expect(minimumLayout.leftWidth).toBeGreaterThan(minimumLayout.rightWidth);
    expect(minimumLayout.timerTop).toBeGreaterThan(minimumLayout.calendarBottom);
    await page
      .locator('.daily-section')
      .screenshot({ path: 'artifacts/calendar-minimum-width.png' });
  } finally {
    await application?.close();
    rmSync(dataDir, { recursive: true, force: true });
  }
});
