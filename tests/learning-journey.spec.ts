import { randomUUID } from 'node:crypto';
import {
  test,
  expect,
  _electron as electron,
  type ElectronApplication,
  type Page,
} from '@playwright/test';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const artifacts = join('artifacts', 'final-acceptance-20261010-' + randomUUID());

test('connects import, reading, cited question, note, feedback, route, confirmed writes, focus and backup restoration', async () => {
  test.setTimeout(90_000);
  const root = mkdtempSync(join(tmpdir(), 'study-journey-'));
  const data = join(root, 'data');
  const original = join(root, '事务练习.md');
  const text = '# 事务练习\n\n事务的原子性要求全部操作成功才提交，任一步骤失败就回滚全部操作。';
  writeFileSync(original, text);
  let output = '事务全部提交或回滚。[1]';
  let calls = 0;
  const server = createServer(async (request, response) => {
    for await (const _part of request) {
      /* Consume only the synthetic request. */
    }
    calls++;
    response.end(JSON.stringify({ message: { content: output }, done: true }) + '\n');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const endpoint = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  let app: ElectronApplication | undefined;
  const day = new Date().toLocaleDateString('sv-SE');
  async function launch() {
    const { ELECTRON_RUN_AS_NODE: _ignored, ...env } = process.env;
    app = await electron.launch({ args: ['.'], env: { ...env, STUDY_COMPANION_DATA_DIR: data } });
    const page = await app.firstWindow();
    await expect(page.getByRole('heading', { name: /开始今天的小进步/ })).toBeVisible();
    return page;
  }
  async function nav(page: Page, name: string) {
    await page.getByRole('button', { name, exact: true }).click();
  }
  async function choose(path: string) {
    await app!.evaluate(({ dialog }, path) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] });
    }, path);
  }
  async function snapshot(page: Page) {
    return page.evaluate(async (day) => {
      const api = window.studyCompanion!;
      const notes = await api.listNotes();
      const conversations = await api.listConversations();
      const date = new Date();
      const { current, recent } = await api.focusOverview();
      return {
        sources: await api.listSources(),
        note: await api.getNote(notes[0].id),
        feedback: await api.listNoteFeedback(notes[0].id),
        conversation: await api.getConversation(conversations[0].id),
        routes: await api.listLearningDrafts(),
        memories: await api.listMemories(),
        planning: await api.planningOverview(day),
        // Overview.version orders live events within a process; session revisions are persisted.
        focus: { current, recent },
        study: await api.studyOverview(date.getFullYear(), date.getMonth() + 1),
      };
    }, day);
  }
  try {
    let page = await launch();
    await page.evaluate(async (baseUrl) => {
      const { settings } = await window.studyCompanion!.bootstrap();
      await window.studyCompanion!.saveSettings({
        ...settings,
        ollama: { baseUrl, model: 'journey-fixture' },
      });
    }, endpoint);
    await page.reload();
    await choose(original);
    await nav(page, '资料库');
    await nav(page, '导入资料');
    await expect(page.getByRole('button', { name: '阅读 事务练习', exact: true })).toBeVisible();
    await nav(page, '阅读 事务练习');
    await expect(page.getByRole('heading', { name: '事务练习', exact: true })).toBeVisible();
    await nav(page, '问这份资料');
    await page.getByRole('textbox', { name: '输入学习问题' }).fill('事务原子性');
    await nav(page, '检索原文');
    await expect(page.locator('.evidence-preview summary')).toContainText('回滚全部操作');
    expect(calls).toBe(0);
    await nav(page, '发送问题');
    await expect(page.getByTestId('chat-answer')).toContainText('事务全部提交或回滚');
    await nav(page, '引用 1');
    await expect(page.locator('.markdown-reading #md-line-1')).toBeInViewport();
    await nav(page, '记笔记');
    await page.getByLabel('笔记标题', { exact: true }).fill('事务闭环笔记');
    await page.getByRole('textbox', { name: /我的理解/ }).fill('事务不能只提交一半。');
    await page.getByRole('textbox', { name: /原文依据/ }).fill('尚待核对');
    await page.getByRole('textbox', { name: /待解问题/ }).fill('如何验证失败回滚？');
    await page.getByRole('textbox', { name: /下一步练习/ }).fill('触发中途失败');
    await nav(page, '保存笔记');
    await expect(page.getByText('笔记已保存到本机。', { exact: true })).toBeVisible();
    const note = (await page.evaluate(() => window.studyCompanion!.listNotes()))[0];
    const source = (await page.evaluate(() => window.studyCompanion!.listSources()))[0];
    expect(
      (await page.evaluate((id) => window.studyCompanion!.getNote(id), note.id)).sourceId,
    ).toBe(source.id);
    output =
      '### 有依据的理解\n全部提交或回滚。[1]\n### 待核对与知识缺口\n尚待核对是已有文字。\n### 下一步练习\n尝试中途失败。';
    await page.getByRole('textbox', { name: '希望核对的概念或问题', exact: true }).fill('事务');
    await nav(page, '准备反馈证据');
    await expect(page.getByRole('region', { name: '笔记反馈预览' })).toBeVisible();
    await nav(page, '生成笔记反馈');
    await expect
      .poll(
        async () =>
          (await page.evaluate((id) => window.studyCompanion!.listNoteFeedback(id), note.id))[0]
            ?.status,
      )
      .toBe('completed');
    output =
      '### 阅读与求证\n8分钟：核对原文。[1]\n### 解释与练习\n8分钟：观察回滚。\n### 学习作品\n7分钟：写笔记。\n### 复盘与下一步\n7分钟：比较结果。\n总计8+8+7+7=30分钟。';
    await nav(page, '学习路线');
    await page.getByRole('textbox', { name: '学习目标', exact: true }).fill('验证事务原子性');
    await page.getByRole('textbox', { name: '用来查找原文的概念或问题', exact: true }).fill('事务');
    await page.getByRole('spinbutton', { name: '可用时间（分钟）', exact: true }).fill('30');
    await nav(page, '准备路线证据');
    await expect(page.getByRole('region', { name: '学习路线请求预览' })).toBeVisible();
    await nav(page, '起草学习路线');
    await expect
      .poll(
        async () =>
          (await page.evaluate(() => window.studyCompanion!.listLearningDrafts()))[0]?.status,
      )
      .toBe('completed');
    expect(
      (await page.evaluate((d) => window.studyCompanion!.planningOverview(d), day)).tasks,
    ).toEqual([]);
    expect(await page.evaluate(() => window.studyCompanion!.listMemories())).toEqual([]);
    const tasks = page.getByRole('region', { name: '学习任务提议' });
    await tasks.getByRole('button', { name: '起草任务提议', exact: true }).click();
    await tasks.getByRole('button', { name: '确认新增这项待完成任务', exact: true }).click();
    await expect(tasks.getByRole('heading', { name: '实际已保存' })).toBeVisible();
    const memories = page.getByRole('region', { name: '学习意向记忆提议' });
    await memories.getByRole('button', { name: '起草记忆提议', exact: true }).click();
    await memories.getByRole('button', { name: '确认新增这条记忆', exact: true }).click();
    await expect(memories.getByRole('heading', { name: '实际已保存' })).toBeVisible();
    await nav(page, '学习计划');
    await page.locator('.planning-task-list').getByRole('button').first().click();
    await nav(page, '为这项任务安排专注');
    await page.getByLabel('本轮专注分钟', { exact: true }).fill('5');
    await nav(page, '确认并开始本轮');
    // Allow bounded time for durable SQLite checkpoints on Windows CI.
    await expect
      .poll(
        async () =>
          (await page.evaluate(() => window.studyCompanion!.focusOverview())).current?.elapsedMs ??
          0,
        { timeout: 15_000 },
      )
      .toBeGreaterThanOrEqual(1000);
    expect(
      (await page.evaluate(() => window.studyCompanion!.focusOverview())).current?.status,
    ).toBe('running');
    await nav(page, '提前结束本轮');
    await page
      .getByRole('textbox', { name: '一句收获、一个疑问或下一步', exact: true })
      .fill('已核对定义，回滚实验尚未完成');
    await nav(page, '保存复盘');
    await expect(page.getByText('复盘已保存到本机。', { exact: true })).toBeVisible();
    expect(
      (await page.evaluate((d) => window.studyCompanion!.planningOverview(d), day)).tasks[0].status,
    ).toBe('todo');
    await nav(page, '签到今天');
    const baseline = await snapshot(page);
    expect(baseline.focus.recent[0].status).toBe('stopped');
    expect(calls).toBe(3);
    const backups = mkdtempSync(join(tmpdir(), 'study-journey-backup-'));
    await choose(backups);
    await nav(page, '设置');
    await nav(page, '导出完整备份');
    await expect(page.getByText('备份已导出', { exact: true })).toBeVisible({ timeout: 30_000 });
    const exported = (await page.evaluate(() => window.studyCompanion!.backupState())).lastExport!;
    await app!.close();
    app = undefined;
    page = await launch();
    expect(await snapshot(page)).toEqual(baseline);
    await choose(exported.directory);
    await nav(page, '设置');
    await nav(page, '选择备份并预览');
    await expect(page.getByRole('heading', { name: '恢复内容预览' })).toBeVisible({
      timeout: 30_000,
    });
    await page.getByRole('checkbox', { name: /我已保存需要保留的输入/ }).check();
    await app!.evaluate(({ dialog, app }) => {
      dialog.showMessageBox = async () => ({ response: 1, checkboxChecked: false });
      app.relaunch = () => {};
    });
    const closed = app!.waitForEvent('close');
    await nav(page, '恢复并重启');
    await closed;
    app = undefined;
    page = await launch();
    expect(await snapshot(page)).toEqual(baseline);
    const receipt = await page.evaluate(() => window.studyCompanion!.backupState());
    expect(receipt.learningDirectory).not.toBe(data);
    expect(
      readFileSync(join(receipt.learningDirectory, 'sources', source.id + '.md'), 'utf8'),
    ).toBe(text);
    mkdirSync(artifacts, { recursive: true });
    writeFileSync(
      join(artifacts, 'learning-journey.json'),
      JSON.stringify({ root, calls, baseline, exported, receipt }, null, 2),
    );
  } finally {
    await app?.close();
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
