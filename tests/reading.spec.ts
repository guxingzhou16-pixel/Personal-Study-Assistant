import { test, expect, _electron as electron, type ElectronApplication } from '@playwright/test';
import { mkdtempSync, mkdirSync, readdirSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createReadingFiles } from './fixtures/reading-files';
import { PDFDocument, StandardFonts } from 'pdf-lib';

test('imports local files, reads Markdown and PDF, and restores positions after restart', async () => {
  test.setTimeout(90_000);
  const directory = mkdtempSync(join(tmpdir(), 'study-reading-'));
  const originals = join(directory, 'originals');
  mkdirSync(originals);
  const files = await createReadingFiles(originals);
  let application: ElectronApplication | undefined;
  const networkRequests: string[] = [];
  async function launch() {
    const { ELECTRON_RUN_AS_NODE: _ignored, ...taskEnv } = process.env;
    application = await electron.launch({
      args: ['.'],
      env: { ...taskEnv, STUDY_COMPANION_DATA_DIR: join(directory, 'data') },
    });
    const page = await application.firstWindow();
    page.on('request', (request) => {
      if (/^https?:/.test(request.url())) networkRequests.push(request.url());
    });
    return page;
  }
  async function choose(paths: string[]) {
    await application!.evaluate(({ dialog }, selected) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: selected });
    }, paths);
  }
  try {
    let page = await launch();
    await page.getByRole('button', { name: '打开我的资料库' }).click();
    await expect(page.getByRole('button', { name: '导入资料', exact: true })).toBeVisible({
      timeout: 1500,
    });
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
    expect(
      await page.evaluate(() => (window as unknown as Record<string, unknown>).__unsafeExecuted),
    ).toBeUndefined();
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
    await page.getByTestId('pdf-text-layer').evaluate((layer) => {
      const span = Array.from(layer.querySelectorAll('span')).find((item) =>
        item.textContent?.startsWith('Evidence matters.'),
      )!;
      const range = document.createRange();
      range.setStart(span.firstChild!, 0);
      range.setEnd(span.firstChild!, 16);
      const selection = window.getSelection()!;
      selection.removeAllRanges();
      selection.addRange(range);
      span.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    });
    await page.getByRole('button', { name: '复制引用', exact: true }).click();
    await expect(page.getByText('引用已复制，包含资料位置。')).toBeVisible();
    expect(await application!.evaluate(({ clipboard }) => clipboard.readText())).toContain(
      '《Learning Notes》第 2 页',
    );
    await page.getByRole('combobox', { name: 'PDF 缩放' }).selectOption('1.25');
    await page.getByRole('button', { name: '护眼', exact: true }).click();
    await expect(page.getByText('阅读位置已保存', { exact: true })).toBeVisible();
    await application!.close();
    page = await launch();
    await page.getByRole('button', { name: '打开我的资料库' }).click();
    await page.getByRole('button', { name: '阅读 Learning Notes', exact: true }).click();
    await expect(page.getByRole('spinbutton', { name: 'PDF 页码' })).toHaveValue('2');
    await expect(page.getByRole('combobox', { name: 'PDF 缩放' })).toHaveValue('1.25');
    await expect(page.getByRole('button', { name: '护眼', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.getByTestId('pdf-text-layer')).toContainText('Evidence matters');
    await page.getByRole('button', { name: '返回资料库' }).click();
    await page.getByRole('button', { name: '阅读 Scan only', exact: true }).click();
    await expect(
      page.getByText('这份 PDF 没有可提取文字，可以阅读原页；OCR 和检索暂不可用。'),
    ).toBeVisible();
    await expect(page.getByText('正在铺开第 1 页…')).toBeHidden();
    expect(networkRequests).toEqual([]);
    await page.screenshot({ path: 'artifacts/pdf-reader.png' });
  } finally {
    await application?.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('cancelling the isolated parser preserves completed files and leaves the desktop usable', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'study-reading-cancel-'));
  let application: ElectronApplication | undefined;
  try {
    const files = await createReadingFiles(directory);
    const longPdf = await PDFDocument.create();
    const font = await longPdf.embedFont(StandardFonts.Helvetica);
    for (let number = 1; number <= 250; number++) {
      const page = longPdf.addPage();
      for (let line = 0; line < 35; line++)
        page.drawText(`Page ${number} line ${line}: a cancellable local document.`, {
          x: 40,
          y: 760 - line * 20,
          size: 12,
          font,
        });
    }
    const longPath = join(directory, 'long.pdf');
    writeFileSync(longPath, await longPdf.save());
    const { ELECTRON_RUN_AS_NODE: _ignored, ...taskEnv } = process.env;
    application = await electron.launch({
      args: ['.'],
      env: { ...taskEnv, STUDY_COMPANION_DATA_DIR: join(directory, 'data') },
    });
    const page = await application.firstWindow();
    await page.getByRole('button', { name: '打开我的资料库' }).click();
    await application.evaluate(({ dialog }, path) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] });
    }, files.markdown);
    await page.getByRole('button', { name: '导入资料', exact: true }).click();
    await expect(page.getByText('导入完成：1 份新增，0 份重复，0 份失败。')).toBeVisible();
    // Use the public progress/cancel bridge at a deterministic parse boundary.
    await page.evaluate(() => {
      const unsubscribe = window.studyCompanion!.onImportProgress((progress) => {
        if (progress.message.startsWith('提取文字')) {
          unsubscribe();
          void window.studyCompanion!.cancelImport();
        }
      });
    });
    await application.evaluate(({ dialog }, path) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] });
    }, longPath);
    await page.getByRole('button', { name: '导入资料', exact: true }).click();
    await expect(page.getByText('导入已取消：已完成 0 份，0 份重复。')).toBeVisible();
    await page.getByRole('button', { name: '阅读 学习方法', exact: true }).click();
    await expect(page.getByRole('heading', { name: '学习方法', exact: true })).toBeVisible();
    expect(
      readdirSync(join(directory, 'data', 'sources')).some((name) => name.startsWith('.import-')),
    ).toBe(false);
    expect(
      await page.evaluate(async () => (await window.studyCompanion!.listSources()).length),
    ).toBe(1);
  } finally {
    await application?.close();
    if (!directory.startsWith(tmpdir())) throw new Error('Invalid test cleanup directory');
    rmSync(directory, { recursive: true, force: true });
  }
});
