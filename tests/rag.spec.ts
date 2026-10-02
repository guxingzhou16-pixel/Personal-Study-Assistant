import { test, expect, _electron as electron, type ElectronApplication } from '@playwright/test';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createReadingFiles } from './fixtures/reading-files';

test('desktop retrieves source evidence, answers with citations, opens original anchors and restores them', async () => {
  test.setTimeout(90_000);
  const directory = mkdtempSync(join(tmpdir(), 'study-rag-desktop-'));
  mkdirSync(join(directory, 'originals'));
  const files = await createReadingFiles(join(directory, 'originals'));
  const chinese = join(directory, 'originals', '数据库.md');
  writeFileSync(
    chinese,
    '# 数据库学习\n\n入门内容。\n\n## 事务隔离\n\n事务隔离避免脏读。事务由 BEGIN 开始，COMMIT 提交。\n\n## 原文位置\n\n这是另一个章节。',
  );
  let calls = 0;
  let sentEvidence = '';
  const server = createServer(async (request, response) => {
    let body = '';
    for await (const chunk of request) body += chunk;
    calls++;
    const messages = JSON.parse(body).messages;
    sentEvidence = messages[1].content;
    response.write(JSON.stringify({ message: { content: '根据原文，' }, done: false }) + '\n');
    setTimeout(
      () =>
        response.end(
          JSON.stringify({ message: { content: '可以据此理解。[1]' }, done: true }) + '\n',
        ),
      150,
    );
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  let application: ElectronApplication | undefined;
  async function launch() {
    const { ELECTRON_RUN_AS_NODE: _ignored, ...env } = process.env;
    application = await electron.launch({
      args: ['.'],
      env: { ...env, STUDY_COMPANION_DATA_DIR: join(directory, 'data') },
    });
    return application.firstWindow();
  }
  try {
    let page = await launch();
    await expect(page.getByRole('heading', { name: '开始今天的小进步' })).toBeVisible();
    await page.evaluate(async (endpoint) => {
      const { settings } = await window.studyCompanion!.bootstrap();
      await window.studyCompanion!.saveSettings({
        ...settings,
        ollama: { baseUrl: endpoint, model: 'rag-test' },
      });
    }, baseUrl);
    await page.reload();
    await application!.evaluate(
      ({ dialog }, paths) => {
        dialog.showOpenDialog = async () => ({ canceled: false, filePaths: paths });
      },
      [chinese, files.pdf, files.scan],
    );
    await page.getByRole('button', { name: '资料库', exact: true }).click();
    await page.getByRole('button', { name: '导入资料', exact: true }).click();
    await expect(page.getByRole('button', { name: '阅读 数据库', exact: true })).toBeVisible();
    await page.getByRole('button', { name: '阅读 数据库', exact: true }).click();
    await expect(page.getByRole('button', { name: '问这份资料', exact: true })).toBeVisible();
    await page.getByRole('button', { name: '问这份资料', exact: true }).click();
    await expect(page.getByRole('combobox', { name: '问答方式' })).toHaveValue('sources');
    await page.getByRole('textbox', { name: '输入学习问题' }).fill('什么是事务隔离？');
    await page.getByRole('button', { name: '检索原文', exact: true }).click();
    await expect(page.locator('.evidence-preview summary')).toContainText('事务隔离避免脏读。');
    expect(calls).toBe(0);
    await page.getByRole('button', { name: '发送问题', exact: true }).click();
    await expect(page.getByTestId('chat-answer').last()).toContainText('可以据此理解。');
    expect(sentEvidence).toContain('事务隔离避免脏读');
    await page.getByRole('button', { name: '引用 1', exact: true }).click();
    await expect(page.locator('.markdown-reading #md-line-5')).toBeInViewport();
    await page.getByRole('button', { name: '返回问答', exact: true }).click();
    await page.getByRole('textbox', { name: '输入学习问题' }).fill('黑洞的霍金辐射是什么？');
    await page.getByRole('button', { name: '检索原文', exact: true }).click();
    await expect(page.getByText('没有找到匹配的原文')).toBeVisible();
    await page.getByRole('button', { name: '发送问题', exact: true }).click();
    await expect(page.getByTestId('chat-answer').last()).toContainText('没有找到足够的关键词证据');
    expect(calls).toBe(1);
    await page.getByRole('combobox', { name: '资料范围' }).selectOption('');
    await page.getByRole('textbox', { name: '输入学习问题' }).fill('Evidence original source');
    await page.getByRole('button', { name: '检索原文', exact: true }).click();
    await expect(page.getByText(/第 2 页/).last()).toBeVisible();
    await page.getByRole('button', { name: '发送问题', exact: true }).click();
    await expect(page.getByTestId('chat-answer').last()).toContainText('可以据此理解。');
    await page.getByRole('button', { name: '引用 1', exact: true }).last().click();
    await expect(page.getByRole('spinbutton', { name: 'PDF 页码' })).toHaveValue('2');
    await page.getByRole('button', { name: '返回问答', exact: true }).click();
    await application!.close();
    page = await launch();
    await page.getByRole('button', { name: '学习助手', exact: true }).click();
    await expect(page.getByTestId('chat-answer')).toHaveCount(3);
    await page.getByRole('button', { name: '引用 1', exact: true }).last().click();
    await expect(page.getByRole('spinbutton', { name: 'PDF 页码' })).toHaveValue('2');
    await page.getByRole('button', { name: '返回问答', exact: true }).click();
    await page.getByRole('combobox', { name: '问答方式' }).selectOption('sources');
    const cancelled = await page.evaluate(async () => {
      const pending = window.studyCompanion!.rebuildIndex().then(
        () => null,
        (error: { code: string }) => ({ code: error.code }),
      );
      await window.studyCompanion!.cancelRetrieval();
      return pending;
    });
    expect(cancelled).toMatchObject({ code: 'cancelled' });
    const retained = await page.evaluate(() =>
      window.studyCompanion!.prepareQuestion('Evidence original source', null),
    );
    expect(retained).toMatchObject({
      hits: [expect.objectContaining({ page: 2 })],
    });
    await page.getByRole('button', { name: '重建检索索引', exact: true }).click();
    await expect(page.getByText('检索索引已重建。', { exact: true })).toBeVisible();
    await page.setViewportSize({ width: 900, height: 640 });
    await expect(page.getByRole('textbox', { name: '输入学习问题' })).toBeInViewport();
    await page.screenshot({ path: 'artifacts/rag-desktop.png', fullPage: true });
  } finally {
    await application?.close();
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    rmSync(directory, { recursive: true, force: true });
  }
});
