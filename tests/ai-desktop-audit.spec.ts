import { randomUUID } from 'node:crypto';
import { test, expect, _electron as electron } from '@playwright/test';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Storage } from '../electron/core/storage';
import { parseMarkdown } from '../electron/core/document-parser';
import { defaultSettings } from '../src/lib/types';
import { fixtureSourceId, fixtureText } from './fixtures/legacy-databases';

const artifacts = join('artifacts', 'final-acceptance-20261010-' + randomUUID());

test.beforeAll(() => {
  mkdirSync(artifacts, { recursive: true });
});

test('runs feedback, route, explicit memory/task proposals and route deletion through real UI with a fake local model', async () => {
  test.setTimeout(60_000);
  const root = mkdtempSync(join(tmpdir(), 'study-ai-ui-'));
  let output = '有依据的理解：事务全部提交或回滚。[1]\n待核对：错误日志。\n下一步：验证失败回滚。';
  const requests: unknown[] = [];
  const server = createServer(async (request, response) => {
    let body = '';
    for await (const part of request) body += part;
    requests.push(JSON.parse(body));
    response.end(JSON.stringify({ message: { content: output }, done: true }) + '\n');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const endpoint = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  mkdirSync(join(root, 'sources'));
  writeFileSync(join(root, 'sources', fixtureSourceId + '.md'), fixtureText);
  const storage = new Storage(join(root, 'study-companion.sqlite3'));
  storage.saveSettings({ ...defaultSettings, ollama: { baseUrl: endpoint, model: 'fake' } });
  storage.addSource({
    id: fixtureSourceId,
    name: '事务资料',
    kind: 'markdown',
    bytes: Buffer.byteLength(fixtureText),
    ...parseMarkdown(Buffer.from(fixtureText)),
  });
  const note = storage.notes.save({
    id: null,
    revision: 0,
    title: '事务笔记',
    sourceId: fixtureSourceId,
    understanding: '应该全部提交或回滚',
    evidence: '待核对',
    questions: '如何验证',
    nextStep: '实验',
  });
  storage.close();
  const { ELECTRON_RUN_AS_NODE: _ignored, ...env } = process.env;
  const app = await electron.launch({
    args: ['.'],
    env: { ...env, STUDY_COMPANION_DATA_DIR: root },
  });
  try {
    const page = await app.firstWindow();
    await expect(page.getByRole('heading', { name: '开始今天的小进步' })).toBeVisible();
    await page.getByRole('button', { name: '学习笔记', exact: true }).click();
    await page
      .getByRole('complementary', { name: '笔记列表' })
      .getByRole('button', { name: /事务笔记/ })
      .click();
    await page.getByRole('textbox', { name: '希望核对的概念或问题', exact: true }).fill('事务');
    await page.getByRole('button', { name: '准备反馈证据', exact: true }).click();
    await expect(page.getByRole('region', { name: '笔记反馈预览' })).toBeVisible();
    await page.getByRole('button', { name: '生成笔记反馈', exact: true }).click();
    await expect
      .poll(
        async () =>
          (await page.evaluate((id) => window.studyCompanion!.listNoteFeedback(id), note.id))[0]
            ?.status,
      )
      .toBe('completed');
    expect(await page.evaluate((id) => window.studyCompanion!.getNote(id), note.id)).toEqual(note);
    output = JSON.stringify({
      limitations: '底层机制需另找原文求证。',
      steps: [5, 10, 10, 5].map((minutes, index) => ({
        title: ['阅读与求证', '解释与练习', '学习作品', '复盘与下一步'][index],
        action: '对照事务全部提交或回滚的资料规则，写自己的例子。',
        artifact: '用户笔记及待求证问题',
        minutes,
        citations: [1],
      })),
    });
    await page.getByRole('button', { name: '学习路线', exact: true }).click();
    await page.getByRole('textbox', { name: '学习目标', exact: true }).fill('核对事务原子性');
    await page.getByRole('textbox', { name: '用来查找原文的概念或问题', exact: true }).fill('事务');
    await page.getByRole('spinbutton', { name: '可用时间（分钟）', exact: true }).fill('30');
    await page.getByRole('button', { name: '准备路线证据', exact: true }).click();
    await expect(page.getByRole('region', { name: '学习路线请求预览' })).toBeVisible();
    await page.getByRole('button', { name: '起草学习路线', exact: true }).click();
    await expect
      .poll(
        async () =>
          (await page.evaluate(() => window.studyCompanion!.listLearningDrafts()))[0]?.status,
      )
      .toBe('completed');
    const route = (await page.evaluate(() => window.studyCompanion!.listLearningDrafts()))[0];
    const day = new Date().toLocaleDateString('sv-SE');
    expect(
      (await page.evaluate((d) => window.studyCompanion!.planningOverview(d), day)).tasks,
    ).toEqual([]);
    expect(await page.evaluate(() => window.studyCompanion!.listMemories())).toEqual([]);
    await page.getByText('把整个目标安排为一项任务', { exact: true }).click();
    const tasks = page.getByRole('region', { name: '学习任务提议' });
    await tasks.getByRole('button', { name: '起草任务提议', exact: true }).click();
    await expect(page.getByRole('region', { name: '任务最终写入预览' })).toBeVisible();
    expect(
      (await page.evaluate((d) => window.studyCompanion!.planningOverview(d), day)).tasks,
    ).toEqual([]);
    await tasks.getByRole('button', { name: '拒绝提议', exact: true }).click();
    expect(
      (await page.evaluate((d) => window.studyCompanion!.planningOverview(d), day)).tasks,
    ).toEqual([]);
    await tasks.getByRole('button', { name: '起草任务提议', exact: true }).click();
    await tasks.getByRole('button', { name: '确认新增这项待完成任务', exact: true }).click();
    await expect(tasks.getByRole('heading', { name: '实际已保存' })).toBeVisible();
    const savedTask = (await page.evaluate((d) => window.studyCompanion!.planningOverview(d), day))
      .tasks[0];
    expect(savedTask.status).toBe('todo');
    expect(savedTask.originTurnId).toBe(route.id);
    const memories = page.getByRole('region', { name: '学习意向记忆提议' });
    await memories.getByRole('button', { name: '起草记忆提议', exact: true }).click();
    await memories.getByRole('button', { name: '拒绝提议', exact: true }).click();
    expect(await page.evaluate(() => window.studyCompanion!.listMemories())).toEqual([]);
    await memories.getByRole('button', { name: '起草记忆提议', exact: true }).click();
    await memories.getByRole('button', { name: '确认新增这条记忆', exact: true }).click();
    await expect(memories.getByRole('heading', { name: '实际已保存' })).toBeVisible();
    const savedMemory = (await page.evaluate(() => window.studyCompanion!.listMemories()))[0];
    expect(savedMemory.scope).toBe('local');
    const pending = await page.evaluate(
      (id) => window.studyCompanion!.prepareMemoryProposal(id),
      route.id,
    );
    const exportPath = join(mkdtempSync(join(tmpdir(), 'study-history-export-')), 'route.md');
    await app.evaluate(({ dialog }, filePath) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath });
    }, exportPath);
    await page.getByRole('button', { name: '导出 Markdown', exact: true }).click();
    await expect.poll(() => existsSync(exportPath)).toBe(true);
    expect(readFileSync(exportPath, 'utf8')).toContain('时间预算：30 分钟');
    expect(readFileSync(exportPath, 'utf8')).toContain('事务要么全部提交');
    await app.evaluate(({ dialog }) => {
      dialog.showMessageBox = async () => ({ response: 1, checkboxChecked: false });
    });
    await page.getByRole('button', { name: '删除这份路线', exact: true }).click();
    await expect
      .poll(() => page.evaluate(() => window.studyCompanion!.listLearningDrafts()))
      .toEqual([]);
    expect(
      (await page.evaluate((d) => window.studyCompanion!.planningOverview(d), day)).tasks[0],
    ).toEqual(savedTask);
    expect((await page.evaluate(() => window.studyCompanion!.listMemories()))[0]).toEqual(
      savedMemory,
    );
    const failed = await page.evaluate(async (id) => {
      try {
        await window.studyCompanion!.confirmMemoryProposal(id);
        return null;
      } catch (error) {
        return (error as { code: string }).code;
      }
    }, pending.id);
    expect(failed).toBeTruthy();
    expect(requests).toHaveLength(2);
    writeFileSync(
      join(artifacts, 'ai-desktop.json'),
      JSON.stringify(
        {
          root,
          requests,
          route,
          savedTask,
          savedMemory,
          pendingInvalidAfterDeletion: failed,
          exportPath,
        },
        null,
        2,
      ),
    );
  } finally {
    await app.close();
    await new Promise<void>((resolve) => {
      server.closeAllConnections();
      server.close(() => resolve());
    });
  }
});

test('renders strict three cards and quizzes, keeps personal answers out of storage, manages and exports the saved conversation', async () => {
  test.setTimeout(60_000);
  const root = mkdtempSync(join(tmpdir(), 'study-practice-ui-'));
  let output = JSON.stringify({
    items: [1, 2, 3].map((i) => ({
      question: `原子性复核问题${i}`,
      answer: '全部提交或回滚',
      citations: [1],
    })),
  });
  const server = createServer(async (request, response) => {
    for await (const _part of request) {
    }
    response.end(JSON.stringify({ message: { content: output }, done: true }) + '\n');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  mkdirSync(join(root, 'sources'));
  writeFileSync(join(root, 'sources', fixtureSourceId + '.md'), fixtureText);
  const storage = new Storage(join(root, 'study-companion.sqlite3'));
  storage.saveSettings({ ...defaultSettings, ollama: { baseUrl, model: 'fake' } });
  storage.addSource({
    id: fixtureSourceId,
    name: '事务资料',
    kind: 'markdown',
    bytes: Buffer.byteLength(fixtureText),
    ...parseMarkdown(Buffer.from(fixtureText)),
  });
  storage.close();
  const { ELECTRON_RUN_AS_NODE: _ignored, ...env } = process.env;
  const app = await electron.launch({
    args: ['.'],
    env: { ...env, STUDY_COMPANION_DATA_DIR: root },
  });
  try {
    const page = await app.firstWindow();
    await expect(page.getByRole('heading', { name: '开始今天的小进步' })).toBeVisible();
    const conversation = await page.evaluate(() => window.studyCompanion!.createConversation());
    for (const kind of ['cards', 'quiz'] as const) {
      await page.evaluate(
        async ({ kind, id, sourceId, baseUrl }) => {
          const preview = await window.studyCompanion!.preparePractice({
            kind,
            topic: '事务',
            sourceId,
          });
          await window.studyCompanion!.sendPractice({
            conversationId: id,
            retrievalId: preview.evidence.id,
            expectedProfile: `ollama|${baseUrl}|fake`,
          });
        },
        { kind, id: conversation.id, sourceId: fixtureSourceId, baseUrl },
      );
      await expect
        .poll(
          async () =>
            (
              await page.evaluate(
                (id) => window.studyCompanion!.getConversation(id),
                conversation.id,
              )
            ).turns.at(-1)?.status,
        )
        .toBe('completed');
    }
    await page.reload();
    await page.getByRole('button', { name: '学习助手', exact: true }).click();
    await page.getByRole('button', { name: /^会话：知识卡片/ }).click();
    expect(await page.locator('.practice-item').count()).toBe(6);
    await page.getByRole('button', { name: '翻面查看答案', exact: true }).first().focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: '收起参考答案', exact: true })).toHaveCount(1);
    await page
      .getByRole('textbox', { name: '第 1 题 · 我的作答', exact: true })
      .fill('这是一条绝不上传的本地作答');
    await page.getByRole('button', { name: '对照参考答案', exact: true }).first().click();
    const saved = await page.evaluate(
      (id) => window.studyCompanion!.getConversation(id),
      conversation.id,
    );
    expect(JSON.stringify(saved)).not.toContain('这是一条绝不上传');
    await page.getByRole('button', { name: '重命名', exact: true }).click();
    await page.getByRole('textbox', { name: '会话标题', exact: true }).fill('验收练习历史');
    await page.getByRole('button', { name: '保存标题', exact: true }).click();
    await expect(
      page.getByRole('button', { name: '会话：验收练习历史', exact: true }),
    ).toBeVisible();
    const exportPath = join(mkdtempSync(join(tmpdir(), 'study-practice-export-')), 'practice.md');
    await app.evaluate(({ dialog }, filePath) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath });
    }, exportPath);
    await page.getByRole('button', { name: '导出 Markdown', exact: true }).click();
    await expect.poll(() => existsSync(exportPath)).toBe(true);
    expect(readFileSync(exportPath, 'utf8')).toContain('短测验');
    expect(readFileSync(exportPath, 'utf8')).not.toContain('绝不上传');
    output = '{"items":[]}';
    await page.evaluate(
      async ({ id, sourceId, baseUrl }) => {
        const preview = await window.studyCompanion!.preparePractice({
          kind: 'cards',
          topic: '事务',
          sourceId,
        });
        await window.studyCompanion!.sendPractice({
          conversationId: id,
          retrievalId: preview.evidence.id,
          expectedProfile: `ollama|${baseUrl}|fake`,
        });
      },
      { id: conversation.id, sourceId: fixtureSourceId, baseUrl },
    );
    await expect
      .poll(
        async () =>
          (
            await page.evaluate((id) => window.studyCompanion!.getConversation(id), conversation.id)
          ).turns.at(-1)?.status,
      )
      .not.toBe('streaming');
    await page.reload();
    await page.getByRole('button', { name: '学习助手', exact: true }).click();
    await page.getByRole('button', { name: '会话：验收练习历史', exact: true }).click();
    await expect(page.getByText(/练习未完成，不能作为有效题目使用/)).toBeVisible();
    await app.evaluate(({ dialog }) => {
      dialog.showMessageBox = async () => ({ response: 0, checkboxChecked: false });
    });
    await page.getByRole('button', { name: '删除会话', exact: true }).click();
    expect(await page.evaluate(() => window.studyCompanion!.listConversations())).toHaveLength(1);
    await app.evaluate(({ dialog }) => {
      dialog.showMessageBox = async () => ({ response: 1, checkboxChecked: false });
    });
    await page.getByRole('button', { name: '删除会话', exact: true }).click();
    await expect
      .poll(() => page.evaluate(() => window.studyCompanion!.listConversations()))
      .toEqual([]);
    expect(await page.evaluate(() => window.studyCompanion!.listSources())).toHaveLength(1);
    writeFileSync(
      join(artifacts, 'practice-desktop.json'),
      JSON.stringify({ root, conversation: saved, exportPath, invalidOutput: output }, null, 2),
    );
  } finally {
    await app.close();
    await new Promise<void>((resolve) => {
      server.closeAllConnections();
      server.close(() => resolve());
    });
  }
});
