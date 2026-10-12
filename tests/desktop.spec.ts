import { test, expect, _electron as electron, type ElectronApplication } from '@playwright/test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { randomUUID } from 'node:crypto';

const packageVersion: string = JSON.parse(readFileSync('package.json', 'utf8')).version;

test('desktop navigation, persistent preferences, encrypted keys and model checks', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'study-desktop-'));
  const fakeKey = 'e2e-fake-key-never-a-real-secret';
  let receivedAuth: string | undefined;
  const server = createServer((request, response) => {
    if (request.url === '/api/tags')
      response.end(JSON.stringify({ models: [{ name: 'test-local-model' }] }));
    else if (request.url === '/v1/models') {
      receivedAuth = request.headers.authorization;
      if (receivedAuth !== `Bearer ${fakeKey}`) {
        response.statusCode = 401;
        response.end();
      } else response.end(JSON.stringify({ data: [{ id: 'test-cloud-model' }] }));
    } else {
      response.statusCode = 404;
      response.end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const endpoint = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  let application: ElectronApplication | undefined;
  async function launch() {
    const { ELECTRON_RUN_AS_NODE: _ignored, ...taskEnv } = process.env;
    application = await electron.launch({
      args: ['.'],
      env: { ...taskEnv, STUDY_COMPANION_DATA_DIR: dataDir },
    });
    return application.firstWindow();
  }
  try {
    let page = await launch();
    await expect(page.getByRole('heading', { name: '开始今天的小进步' })).toBeVisible();
    await expect(page.getByText(`v${packageVersion}`, { exact: true })).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: '跳到主要内容' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: '学习笔记', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: '打开我的资料库' }).click();
    await expect(page.getByRole('heading', { name: '我的资料库' })).toBeVisible();
    await expect(page.getByRole('button', { name: '导入资料', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: '设置', exact: true }).click();
    await page.getByRole('textbox', { name: '怎么称呼你' }).fill('小舟');
    await page.getByRole('spinbutton', { name: /每日学习目标/ }).fill('60');
    await page.getByRole('textbox', { name: '服务基础地址' }).fill(endpoint);
    await page.getByRole('button', { name: '检测连接' }).click();
    await expect(page.getByText('服务已连接，发现 1 个模型。请选择一个模型并保存。')).toBeVisible();
    await page
      .getByRole('combobox', { name: '可用模型', exact: true })
      .selectOption('test-local-model');
    await page.getByRole('button', { name: '保存设置' }).click();
    await expect(page.getByText('已保存。下次打开应用时会恢复这些设置。')).toBeVisible();
    await application!.close();
    page = await launch();
    await expect(page.getByRole('heading', { name: '小舟，开始今天的小进步' })).toBeVisible();
    await page.getByRole('button', { name: '设置', exact: true }).click();
    await expect(page.getByRole('spinbutton', { name: /每日学习目标/ })).toHaveValue('60');
    await expect(page.getByRole('combobox', { name: '模型名称', exact: true })).toHaveValue(
      'test-local-model',
    );
    await page.getByRole('button', { name: /兼容 OpenAI 的接口/ }).click();
    await page.getByRole('textbox', { name: '服务基础地址' }).fill(`${endpoint}/v1`);
    await page.getByRole('button', { name: '检测连接' }).click();
    await expect(page.getByRole('alert')).toContainText('鉴权失败');
    await page.locator('input[name="apiKey"]').fill(fakeKey);
    await page.getByRole('button', { name: '检测连接' }).click();
    await page
      .getByRole('combobox', { name: '可用模型', exact: true })
      .selectOption('test-cloud-model');
    await page.getByRole('button', { name: '保存设置' }).click();
    await expect(page.getByText('此地址已有保存的密钥', { exact: true })).toBeVisible();
    await expect(page.locator('input[name="apiKey"]')).toHaveValue('');
    await application!.close();
    expect(readFileSync(join(dataDir, 'credentials.enc.json'), 'utf8')).not.toContain(fakeKey);
    expect(
      readFileSync(join(dataDir, 'study-companion.sqlite3')).includes(Buffer.from(fakeKey)),
    ).toBe(false);
    page = await launch();
    await page.getByRole('button', { name: '设置', exact: true }).click();
    await expect(page.getByText('此地址已有保存的密钥', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: '检测连接' }).click();
    await expect(page.getByText('服务已连接，所选模型存在。可以前往学习助手提问。')).toBeVisible();
    expect(receivedAuth).toBe(`Bearer ${fakeKey}`);
    const isolation = await page.evaluate(() => ({
      node: typeof (window as unknown as Record<string, unknown>).require,
      bridge: Object.keys(window.studyCompanion ?? {}),
    }));
    expect(isolation.node).toBe('undefined');
    expect(isolation.bridge).toEqual([
      'bootstrap',
      'saveSettings',
      'storeApiKey',
      'removeApiKey',
      'hasApiKey',
      'studyOverview',
      'checkIn',
      'setStudyRunning',
      'checkConnection',
      'listSources',
      'importExample',
      'probeGeneration',
      'probeEmbedding',
      'listReviews',
      'getReview',
      'saveReview',
      'resolveReviewCitation',
      'exportReview',
      'importSources',
      'cancelImport',
      'onImportProgress',
      'openSource',
      'saveReadingPosition',
      'copyCitation',
      'readSelection',
      'prepareReadingQuestion',
      'listConversations',
      'createConversation',
      'getConversation',
      'previewHistory',
      'renameConversation',
      'deleteHistory',
      'exportHistory',
      'sendChat',
      'stopChat',
      'activeChat',
      'onChatUpdate',
      'prepareQuestion',
      'preparePractice',
      'sendPractice',
      'cancelRetrieval',
      'rebuildIndex',
      'onRetrievalProgress',
      'resolveCitation',
      'embeddingStatus',
      'downloadEmbedding',
      'cancelEmbeddingDownload',
      'onEmbeddingProgress',
      'listNotes',
      'getNote',
      'saveNote',
      'deleteNote',
      'exportNote',
      'setNoteDraftDirty',
      'onShowNotes',
      'listNoteFeedback',
      'prepareNoteFeedback',
      'sendNoteFeedback',
      'listLearningDrafts',
      'prepareLearningDraft',
      'sendLearningDraft',
      'listMemories',
      'saveMemory',
      'deleteMemory',
      'prepareMemoryProposal',
      'confirmMemoryProposal',
      'discardMemoryProposal',
      'planningOverview',
      'saveStudyProject',
      'saveDailyTask',
      'setDailyTaskCompleted',
      'deleteDailyTask',
      'prepareTaskProposal',
      'confirmTaskProposal',
      'discardTaskProposal',
      'prepareTaskBatch',
      'confirmTaskBatch',
      'focusOverview',
      'focusHistory',
      'getFocusSession',
      'startFocus',
      'controlFocus',
      'saveFocusReview',
      'backupState',
      'exportBackup',
      'inspectBackup',
      'confirmRestore',
      'discardRestore',
      'cancelBackup',
      'onBackupUpdate',
    ]);
    await page.getByRole('button', { name: '删除密钥' }).click();
    await expect(page.getByText('此地址未保存密钥', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: '学习首页', exact: true }).click();
    await expect(page.getByRole('heading', { name: '小舟，开始今天的小进步' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '小舟，开始今天的小进步' })).toBeInViewport();
    await page.screenshot({
      path: `artifacts/final-acceptance-20261010-${randomUUID()}/desktop-home.png`,
      fullPage: true,
    });
    await page.setViewportSize({ width: 900, height: 640 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.getByRole('button', { name: '设置', exact: true }).click();
    await page.getByRole('button', { name: '保存设置' }).focus();
    await expect(page.getByRole('button', { name: '保存设置' })).toBeInViewport();
  } finally {
    await application?.close();
    await new Promise<void>((resolve) => {
      server.closeAllConnections();
      server.close(() => resolve());
    });
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test('development window can call the same isolated desktop API', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'study-development-'));
  const { ELECTRON_RUN_AS_NODE: _ignored, ...taskEnv } = process.env;
  let application: ElectronApplication | undefined;
  try {
    application = await electron.launch({
      args: ['.'],
      env: {
        ...taskEnv,
        STUDY_COMPANION_DATA_DIR: dataDir,
        STUDY_COMPANION_DEV_URL: 'http://127.0.0.1:1420',
      },
    });
    const page = await application.firstWindow();
    await expect(page.getByRole('heading', { name: '开始今天的小进步' })).toBeVisible();
    await page.getByRole('button', { name: '设置', exact: true }).click();
    await page.getByRole('textbox', { name: '怎么称呼你' }).fill('开发模式');
    await page.getByRole('button', { name: '保存设置' }).click();
    await expect(page.getByText('已保存。下次打开应用时会恢复这些设置。')).toBeVisible();
    await page.getByRole('button', { name: '学习首页', exact: true }).click();
    await expect(page.getByRole('heading', { name: '开发模式，开始今天的小进步' })).toBeVisible();
  } finally {
    await application?.close();
    rmSync(dataDir, { recursive: true, force: true });
  }
});
