import { test, expect, _electron as electron, type ElectronApplication } from '@playwright/test';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('real desktop streams both protocols, stops, handles broken streams and restores conversations', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'study-chat-desktop-'));
  let stoppedConnection = false;
  const received: {
    path: string;
    auth?: string;
    body: { messages: { role: string; content: string }[] };
  }[] = [];
  const server = createServer(async (request, response) => {
    let text = '';
    for await (const chunk of request) text += chunk;
    const body = JSON.parse(text);
    received.push({ path: request.url!, auth: request.headers.authorization, body });
    const question = body.messages.at(-1).content;
    if (request.url === '/v1/chat/completions') {
      response.end(
        'data: {"choices":[{"delta":{"content":"兼容接口回答"},"finish_reason":null}]}\n\ndata: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n',
      );
    } else {
      response.write(
        JSON.stringify({
          message: { content: question === '停止测试' ? '正在逐步解释' : '中文回答第一段' },
          done: false,
        }) + '\n',
      );
      if (question === '停止测试' || question === '退出测试') {
        response.on('close', () => {
          stoppedConnection = true;
        });
      } else if (question === '断流测试') response.end();
      else
        setTimeout(
          () =>
            response.end(
              JSON.stringify({ message: { content: '，现在完成。' }, done: true }) + '\n',
            ),
          600,
        );
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const endpoint = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  let app: ElectronApplication | undefined;
  async function launch() {
    const { ELECTRON_RUN_AS_NODE: _ignored, ...env } = process.env;
    app = await electron.launch({
      args: ['.'],
      env: { ...env, STUDY_COMPANION_DATA_DIR: dataDir },
    });
    return app.firstWindow();
  }
  try {
    let page = await launch();
    await expect(page.getByRole('heading', { name: /今天，也长出\s*一点新想法/ })).toBeVisible();
    await page.evaluate(async (baseUrl) => {
      const { settings } = await window.studyCompanion!.bootstrap();
      await window.studyCompanion!.saveSettings({
        ...settings,
        ollama: { baseUrl, model: 'test-model' },
      });
    }, endpoint);
    await page.reload();
    await page.getByRole('button', { name: '学习助手', exact: true }).click();
    await expect(page.getByRole('heading', { name: '和拾知一起想明白' })).toBeVisible();
    await page.getByRole('textbox', { name: '输入学习问题' }).fill('解释闭包');
    await page.getByRole('button', { name: '发送问题', exact: true }).click();
    await expect(page.getByTestId('chat-answer').last()).toHaveText('中文回答第一段');
    await expect(page.getByTestId('chat-answer').last()).toHaveText('中文回答第一段，现在完成。');
    await expect(page.getByText('回答完成', { exact: true })).toBeVisible();
    const completed = await page.evaluate(async () => {
      const [latest] = await window.studyCompanion!.listConversations();
      return (await window.studyCompanion!.getConversation(latest.id)).turns[0];
    });
    await app!.evaluate(({ BrowserWindow }, turn) => {
      BrowserWindow.getAllWindows()[0].webContents.send('study:chat-update', {
        ...turn,
        status: 'streaming',
        revision: 0,
      });
    }, completed);
    await expect(page.getByRole('button', { name: '停止生成', exact: true })).toHaveCount(0);
    expect(received[0].auth).toBeUndefined();
    await page.getByRole('textbox', { name: '输入学习问题' }).fill('停止测试');
    await page.getByRole('button', { name: '发送问题', exact: true }).click();
    await expect(page.getByTestId('chat-answer').last()).toHaveText('正在逐步解释');
    const composer = await page.getByRole('textbox', { name: '输入学习问题' }).elementHandle();
    await page.getByRole('button', { name: '学习首页', exact: true }).click();
    await page.getByRole('button', { name: '资料库', exact: true }).click();
    await page.getByRole('button', { name: '学习助手', exact: true }).click();
    expect(
      await composer!.evaluate((element) => element === document.getElementById('chat-question')),
    ).toBe(true);
    await expect(page.getByTestId('chat-answer').last()).toHaveText('正在逐步解释');
    await page.getByRole('button', { name: '停止生成', exact: true }).click();
    await expect(page.getByText('已停止生成，保留已收到的内容。')).toBeVisible();
    await expect.poll(() => stoppedConnection).toBe(true);
    expect(received[1].body.messages.slice(-3).map((message) => message.role)).toEqual([
      'user',
      'assistant',
      'user',
    ]);
    await page.getByRole('textbox', { name: '输入学习问题' }).fill('断流测试');
    await page.getByRole('button', { name: '发送问题', exact: true }).click();
    await expect(
      page.getByText('回答中途断开，以下内容尚未完成。请检查连接后重新提问。'),
    ).toBeVisible();
    expect(received[2].body.messages.some((message) => message.content === '正在逐步解释')).toBe(
      false,
    );
    await page.getByRole('button', { name: '新会话', exact: true }).click();
    await expect(page.getByText('从一个具体的问题开始')).toBeVisible();
    await page.getByRole('textbox', { name: '输入学习问题' }).fill('退出测试');
    await page.getByRole('button', { name: '发送问题', exact: true }).click();
    await expect(page.getByTestId('chat-answer').last()).toHaveText('中文回答第一段');
    await app!.close();
    page = await launch();
    await page.getByRole('button', { name: '学习助手', exact: true }).click();
    await expect(page.getByText('上次生成已中断', { exact: true })).toBeVisible();
    await expect(page.getByTestId('chat-answer').last()).toHaveText('中文回答第一段');
    await page.getByRole('button', { name: '会话：解释闭包', exact: true }).click();
    await expect(page.getByText('正在逐步解释', { exact: true })).toBeVisible();
    await expect(page.getByText('已停止生成，保留已收到的内容。')).toBeVisible();
    const fakeKey = 'fake-chat-e2e-key';
    await page.evaluate(
      async ({ baseUrl, key }) => {
        const { settings } = await window.studyCompanion!.bootstrap();
        await window.studyCompanion!.saveSettings({
          ...settings,
          provider: 'openai',
          openai: { baseUrl, model: 'compatible-test' },
        });
        await window.studyCompanion!.storeApiKey(baseUrl, key);
      },
      { baseUrl: `${endpoint}/v1`, key: fakeKey },
    );
    await page.reload();
    await page.getByRole('button', { name: '学习助手', exact: true }).click();
    await page.getByRole('button', { name: '新会话', exact: true }).click();
    await page.getByRole('textbox', { name: '输入学习问题' }).fill('测试兼容接口');
    await page.getByRole('button', { name: '发送问题', exact: true }).click();
    await expect(page.getByTestId('chat-answer').last()).toHaveText('兼容接口回答');
    expect(received.at(-1)?.path).toBe('/v1/chat/completions');
    expect(received.at(-1)?.auth).toBe(`Bearer ${fakeKey}`);
    expect(
      readFileSync(join(dataDir, 'study-companion.sqlite3')).includes(Buffer.from(fakeKey)),
    ).toBe(false);
    await page.setViewportSize({ width: 900, height: 640 });
    await expect(page.getByRole('textbox', { name: '输入学习问题' })).toBeInViewport();
    await page.screenshot({ path: 'artifacts/chat-desktop.png', fullPage: true });
    const requestCount = received.length;
    await page.getByRole('button', { name: '模型设置', exact: true }).click();
    await page.getByRole('textbox', { name: '服务基础地址' }).fill('https://first.example/v1');
    await page.getByRole('button', { name: '保存设置', exact: true }).click();
    await expect(page.getByText('已保存。下次打开应用时会恢复这些设置。')).toBeVisible();
    await page.getByRole('button', { name: '学习助手', exact: true }).click();
    await page.getByRole('textbox', { name: '输入学习问题' }).fill('远程确认测试');
    await expect(page.getByRole('button', { name: '发送问题', exact: true })).toBeDisabled();
    await page.getByRole('checkbox', { name: /允许将问题/ }).check();
    await expect(page.getByRole('button', { name: '发送问题', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: '模型设置', exact: true }).click();
    await page.getByRole('textbox', { name: '服务基础地址' }).fill('https://second.example/v1');
    await page.getByRole('button', { name: '保存设置', exact: true }).click();
    await expect(page.getByText('已保存。下次打开应用时会恢复这些设置。')).toBeVisible();
    await page.getByRole('button', { name: '学习助手', exact: true }).click();
    await expect(page.getByRole('checkbox', { name: /允许将问题/ })).not.toBeChecked();
    await expect(page.getByRole('button', { name: '发送问题', exact: true })).toBeDisabled();
    expect(received).toHaveLength(requestCount);
  } finally {
    await app?.close();
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    rmSync(dataDir, { recursive: true, force: true });
  }
});
