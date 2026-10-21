import { test, expect, _electron as electron } from '@playwright/test';
import { cpSync, mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { embeddingPath, verifyEmbeddingFiles } from '../electron/core/embedding-files';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

test('real CPU model retrieves a Chinese synonym offline, opens its citation, restores vectors and survives corruption', async () => {
  const cached = embeddingPath(resolve('artifacts/embedding-model'));
  if (!(await verifyEmbeddingFiles(cached)))
    throw new Error('请先运行 npm run model:download 准备已校验的评测权重。');
  const directory = mkdtempSync(join(tmpdir(), 'study-real-embedding-'));
  const data = join(directory, 'data');
  const installed = embeddingPath(join(data, 'embedding-models'));
  mkdirSync(join(directory, 'originals'));
  const original = join(directory, 'originals', '数据库.md');
  writeFileSync(
    original,
    '# 事务\n\n事务避免脏读。\n\n## 索引\n\n数据库索引使查询更快。\n\n## 专注\n\n番茄钟帮助安排休息。',
  );
  cpSync(cached, installed, { recursive: true });
  let calls = 0;
  let sentEvidence = '';
  const server = createServer(async (request, response) => {
    let body = '';
    for await (const part of request) body += part;
    sentEvidence = JSON.parse(body).messages[1].content;
    calls++;
    response.end(
      JSON.stringify({ message: { content: '索引使查询更快。[1]' }, done: true }) + '\n',
    );
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  const endpoint = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const { ELECTRON_RUN_AS_NODE: _ignored, ...env } = process.env;
  let application = await electron.launch({
    args: ['.'],
    env: { ...env, STUDY_COMPANION_DATA_DIR: data },
  });
  try {
    let page = await application.firstWindow();
    await application.evaluate(({ dialog, net }, path) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] });
      net.fetch = async () => {
        throw new Error('offline model download');
      };
    }, original);
    await page.getByRole('button', { name: '资料库', exact: true }).click();
    await page.getByRole('button', { name: '导入资料', exact: true }).click();
    await expect(page.getByRole('button', { name: '阅读 数据库', exact: true })).toBeVisible();
    await page.evaluate(async (baseUrl) => {
      const { settings } = await window.studyCompanion!.bootstrap();
      await window.studyCompanion!.saveSettings({
        ...settings,
        ollama: { baseUrl, model: 'answer-mock' },
      });
    }, endpoint);
    await page.reload();
    await page.getByRole('button', { name: '设置', exact: true }).click();
    const verified = page.getByRole('button', { name: '模型文件已校验', exact: true });
    await expect(verified).toBeVisible();
    await expect(verified).toBeDisabled();
    expect(await page.evaluate(() => window.studyCompanion!.embeddingStatus())).toMatchObject({
      state: 'ready',
    });
    await page.getByRole('button', { name: '学习助手', exact: true }).click();
    await page.getByRole('combobox', { name: '问答方式' }).selectOption('sources');
    await page.getByRole('textbox', { name: '输入学习问题' }).fill('怎样让查找更迅速？');
    await page.getByRole('button', { name: '检索原文', exact: true }).click();
    await expect(page.locator('.evidence-preview')).toContainText('数据库索引使查询更快。');
    await expect(page.locator('.evidence-preview')).toContainText('混合检索');
    expect(calls).toBe(0);
    for (const question of [
      '请用 demo 解释数据库索引',
      '请帮我 review 一下数据库索引',
      '请 Describe 数据库索引',
    ]) {
      const casual = await page.evaluate(
        (question) => window.studyCompanion!.prepareQuestion(question, null),
        question,
      );
      expect(casual.notice).toContain('混合检索');
      expect(casual.hits.some((hit) => hit.text.includes('数据库索引使查询更快。'))).toBe(true);
    }
    await page.getByRole('button', { name: '发送问题', exact: true }).click();
    await expect(page.getByTestId('chat-answer')).toContainText('索引使查询更快。');
    expect(sentEvidence).toContain('数据库索引使查询更快。');
    await page.getByRole('button', { name: '引用 1', exact: true }).click();
    await expect(page.locator('.markdown-reading #md-line-5')).toBeInViewport();
    await page.getByRole('button', { name: '返回问答', exact: true }).click();
    const cancelled = await page.evaluate(async () => {
      const pending = window.studyCompanion!.rebuildIndex().then(
        () => null,
        (error: { code: string }) => error.code,
      );
      await window.studyCompanion!.cancelRetrieval();
      return pending;
    });
    expect(cancelled).toBe('cancelled');
    await application.close();
    application = await electron.launch({
      args: ['.'],
      env: { ...env, STUDY_COMPANION_DATA_DIR: data },
    });
    page = await application.firstWindow();
    const restored = await page.evaluate(() =>
      window.studyCompanion!.prepareQuestion('怎样让查找更迅速？', null),
    );
    expect(restored.hits[0].text).toContain('数据库索引使查询更快。');
    expect(restored.notice).toContain('混合检索');
    const weight = join(installed, 'onnx/model_quantized.onnx');
    const changed = readFileSync(weight);
    changed[0] ^= 1;
    writeFileSync(weight, changed);
    expect(await page.evaluate(() => window.studyCompanion!.embeddingStatus())).toMatchObject({
      state: 'invalid',
    });
    const fallback = await page.evaluate(() =>
      window.studyCompanion!.prepareQuestion('数据库索引', null),
    );
    expect(fallback.notice).toContain('已使用关键词检索');
    expect(fallback.hits[0].text).toContain('数据库索引使查询更快。');
    expect(calls).toBe(1);
    await page.getByRole('button', { name: '学习助手', exact: true }).click();
    await page.getByRole('button', { name: '引用 1', exact: true }).click();
    await expect(page.locator('.markdown-reading #md-line-5')).toBeInViewport();
    await page.setViewportSize({ width: 900, height: 640 });
    await page.screenshot({ path: 'artifacts/embedding-real-desktop.png', fullPage: true });
  } finally {
    await application.close();
    server.closeAllConnections();
    await new Promise<void>((done) => server.close(() => done()));
    rmSync(directory, { recursive: true, force: true });
  }
});
