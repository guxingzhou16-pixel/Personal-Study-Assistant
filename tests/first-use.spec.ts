import { test, expect, _electron as electron } from '@playwright/test';
import { createServer } from 'node:http';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('a new user imports the public example, checks each capability and completes the first question', async () => {
  const root = mkdtempSync(join(tmpdir(), 'study-first-use-'));
  const server = createServer((request, response) => {
    if (request.url === '/api/tags')
      response.end(JSON.stringify({ models: [{ name: 'fixture' }] }));
    else {
      request.resume();
      response.setHeader('Content-Type', 'application/x-ndjson');
      response.end(
        JSON.stringify({ message: { content: '先用自己的话复述，再核对原文。[1]' }, done: true }) +
          '\n',
      );
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const endpoint = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const { ELECTRON_RUN_AS_NODE: _ignored, ...env } = process.env;
  const app = await electron.launch({
    args: ['.'],
    env: { ...env, STUDY_COMPANION_DATA_DIR: root },
  });
  try {
    const page = await app.firstWindow();
    await page.getByRole('button', { name: '导入学习示例', exact: true }).click();
    await expect(page.getByRole('button', { name: '先阅读示例', exact: true })).toBeVisible();
    await page.getByRole('button', { name: '前往模型配置与检查', exact: true }).click();
    await page.getByRole('textbox', { name: '服务基础地址' }).fill(endpoint);
    await page.getByRole('button', { name: '检测连接', exact: true }).click();
    await page.getByRole('combobox', { name: '可用模型', exact: true }).selectOption('fixture');
    await page.getByRole('button', { name: '保存设置', exact: true }).click();
    await page.getByRole('button', { name: '检查已保存连接', exact: true }).click();
    await expect(
      page.getByText('本次列表存在所选模型；生成仍需另测。', { exact: false }),
    ).toBeVisible();
    await page.getByRole('button', { name: '测试一次实际生成', exact: true }).click();
    await expect(
      page.getByText('本次固定文本生成成功；不代表 RAG 回答质量已验收。', { exact: false }),
    ).toBeVisible();
    await page.getByRole('button', { name: '测试本地嵌入推理', exact: true }).click();
    await expect(page.getByText(/未通过实际嵌入推理/)).toBeVisible();
    await page.getByRole('button', { name: '学习首页', exact: true }).click();
    await page.getByText('第一次使用：用一份示例开始学习', { exact: true }).click();
    await page.getByRole('button', { name: '核对／重新导入示例', exact: true }).click();
    await page.getByRole('button', { name: '用示例准备第一次提问', exact: true }).click();
    await expect(page.getByRole('textbox', { name: '输入学习问题' })).toHaveValue(
      '为什么需要用自己的话复述，并核对原文？',
    );
    await page.getByRole('button', { name: '检索原文', exact: true }).click();
    await page.getByRole('button', { name: '发送问题', exact: true }).click();
    await expect(page.getByText(/先用自己的话复述，再核对原文。/).last()).toBeVisible();
    expect((await page.evaluate(() => window.studyCompanion!.listSources())).length).toBe(1);
    await page.screenshot({ path: 'artifacts/first-use-question.png' });
  } finally {
    await app.close();
    await new Promise<void>((resolve) => {
      server.closeAllConnections();
      server.close(() => resolve());
    });
  }
});
