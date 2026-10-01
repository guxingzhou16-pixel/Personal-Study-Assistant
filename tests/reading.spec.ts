import { test, expect, _electron as electron, type ElectronApplication } from '@playwright/test';
import { mkdtempSync, mkdirSync, rmSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createReadingFiles } from './fixtures/reading-files';

test('imports local files, reads Markdown and PDF, and restores positions after restart', async () => {
  test.setTimeout(90_000);
  const directory = mkdtempSync(join(tmpdir(), 'study-reading-'));
  const originals = join(directory, 'originals');
  mkdirSync(originals);
  const files = await createReadingFiles(originals);
  let application: ElectronApplication | undefined;
  async function launch() {
    const { ELECTRON_RUN_AS_NODE: _ignored, ...taskEnv } = process.env;
    application = await electron.launch({ args: ['.'], env: { ...taskEnv, STUDY_COMPANION_DATA_DIR: join(directory, 'data') } });
    return application.firstWindow();
  }
  async function choose(paths: string[]) {
    await application!.evaluate(({ dialog }, selected) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: selected });
    }, paths);
  }
  try {
    let page = await launch();
    await page.getByRole('button', { name: '打开我的资料库' }).click();
    await expect(page.getByRole('button', { name: '导入资料', exact: true })).toBeVisible({ timeout: 1500 });
    await choose([files.markdown, files.pdf, files.scan, files.corrupt]);
    await page.getByRole('button', { name: '导入资料', exact: true }).click();
    await expect(page.getByText('导入完成：3 份新增，0 份重复，1 份失败。')).toBeVisible();
    await choose([files.markdown]);
    await page.getByRole('button', { name: '导入资料', exact: true }).click();
    await expect(page.getByText('导入完成：0 份新增，1 份重复，0 份失败。')).toBeVisible();
    unlinkSync(files.markdown);
    unlinkSync(files.pdf);
    await page.getByRole('button', { name: '阅读 学习方法', exact: true }).click();
    await expect(page.getByRole('heading', { name: '学习方法', exact: true })).toBeVisible();
    await page.getByRole('button', { name: '复盘与检验', exact: true }).click();
    await expect(page.getByRole('heading', { name: '复盘与检验', exact: true })).toBeInViewport();
    await expect(page.getByRole('table')).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as Record<string, unknown>).__unsafeExecuted)).toBeUndefined();
    await expect(page.getByText('远程图片已阻止加载')).toBeVisible();
    await expect(page.getByText('阅读位置已保存', { exact: true })).toBeVisible();
    await application!.close();
    page = await launch();
    await page.getByRole('button', { name: '打开我的资料库' }).click();
    await page.getByRole('button', { name: '阅读 学习方法', exact: true }).click();
    await expect(page.getByRole('heading', { name: '复盘与检验', exact: true })).toBeInViewport();
    await page.getByRole('button', { name: '返回资料库' }).click();
    await page.getByRole('button', { name: '阅读 Learning Notes', exact: true }).click();
    await expect(page.getByTestId('pdf-text-layer')).toContainText('Active recall');
    await page.getByRole('button', { name: '下一页' }).click();
    await expect(page.getByTestId('pdf-text-layer')).toContainText('Evidence matters');
    await page.getByRole('combobox', { name: 'PDF 缩放' }).selectOption('1.25');
    await page.getByRole('button', { name: '护眼', exact: true }).click();
    await expect(page.getByText('阅读位置已保存', { exact: true })).toBeVisible();
    await application!.close();
    page = await launch();
    await page.getByRole('button', { name: '打开我的资料库' }).click();
    await page.getByRole('button', { name: '阅读 Learning Notes', exact: true }).click();
    await expect(page.getByRole('spinbutton', { name: 'PDF 页码' })).toHaveValue('2');
    await expect(page.getByRole('combobox', { name: 'PDF 缩放' })).toHaveValue('1.25');
    await expect(page.getByRole('button', { name: '护眼', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('pdf-text-layer')).toContainText('Evidence matters');
    await page.getByRole('button', { name: '返回资料库' }).click();
    await page.getByRole('button', { name: '阅读 Scan only', exact: true }).click();
    await expect(page.getByText('这份 PDF 没有可提取文字，可以阅读原页；OCR 和检索暂不可用。')).toBeVisible();
    await page.screenshot({ path: 'artifacts/pdf-reader.png' });
  } finally {
    await application?.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
