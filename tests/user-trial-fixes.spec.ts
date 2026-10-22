import { openPage } from './helpers/navigation';
import {
  test,
  expect,
  _electron as electron,
  type ElectronApplication,
  type Page,
} from '@playwright/test';
import { createServer, type ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { Storage } from '../electron/core/storage';
import { TaskProposalService } from '../electron/core/task-proposals';
import { localDayKey } from '../src/lib/calendar';
import { defaultSettings } from '../src/lib/types';
import {
  createLegacyDatabase,
  fixtureTurn,
  fixtureSourceId,
  fixtureText,
} from './fixtures/legacy-databases';

const titles = ['先阅读原子性定义', '再准备解释案例'];
const routePlan = {
  limitations: '案例为自拟建议，仍需核对资料。',
  steps: titles.map((title) => ({
    title,
    action: '核对资料再写自己的解释',
    artifact: '学习笔记',
    minutes: 5,
    citations: [1],
  })),
};
function fixture({ empty = false, tasks = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'study-user-trial-fix-'));
  const path = join(root, 'study-companion.sqlite3');
  if (!empty) createLegacyDatabase(path, 11);
  mkdirSync(join(root, 'sources'));
  if (!empty) writeFileSync(join(root, 'sources', `${fixtureSourceId}.md`), fixtureText);
  const store = new Storage(path);
  if (!empty) {
    const quiz = store.chat.create();
    store.chat.addTurn(
      fixtureTurn(quiz.id, {
        id: randomUUID(),
        practiceRequest: { kind: 'quiz', topic: '事务', sourceId: fixtureSourceId },
        answer: JSON.stringify({
          items: [1, 2, 3].map((index) => ({
            question: `试用回忆问题 ${index}`,
            answer: '全部提交或回滚。',
            citations: [1],
          })),
        }),
      }),
    );
    const conversation = store.chat.findLearningConversation()!;
    const route = fixtureTurn(conversation.id, {
      id: randomUUID(),
      learningRequest: {
        goal: '试用路线',
        query: '事务',
        minutes: 10,
        sourceId: null,
        format: 'steps-v1',
      },
      answer: JSON.stringify(routePlan),
    });
    store.chat.addTurn(route);
    if (tasks) {
      const service = new TaskProposalService(store);
      const proposal = service.prepareBatch(route.id, {
        plan: routePlan,
        indices: [0, 1],
        day: localDayKey(new Date()),
        projectId: null,
      });
      const saved = service.confirmBatch(proposal.id);
      const db = new DatabaseSync(path);
      try {
        const change = db.prepare('UPDATE daily_tasks SET id=? WHERE id=?');
        change.run('ffffffff-ffff-ffff-ffff-ffffffffffff', saved[0].id);
        change.run('11111111-1111-1111-1111-111111111111', saved[1].id);
      } finally {
        db.close();
      }
    }
  }
  store.close();
  return { root, path };
}
async function launch(root: string) {
  const { ELECTRON_RUN_AS_NODE: _node, STUDY_COMPANION_DEV_URL: _dev, ...env } = process.env;
  const app = await electron.launch({
    args: ['.'],
    env: { ...env, STUDY_COMPANION_DATA_DIR: root },
  });
  const page = await app.firstWindow();
  await expect(page.locator('.home-page')).toBeVisible();
  return { app, page };
}

test('the first-use guide starts in the first screen and restores the imported example after settings', async () => {
  const { root } = fixture({ empty: true });
  const { app, page } = await launch(root);
  try {
    await expect(page.getByRole('button', { name: '导入学习示例', exact: true })).toBeInViewport();
    await page.getByRole('button', { name: '导入学习示例', exact: true }).click();
    await expect(
      page.getByRole('button', { name: '用示例准备第一次提问', exact: true }),
    ).toBeEnabled();
    await page.getByRole('button', { name: '前往模型配置与检查', exact: true }).click();
    await page.getByRole('button', { name: '学习首页', exact: true }).click();
    await expect(
      page.getByRole('button', { name: '用示例准备第一次提问', exact: true }),
    ).toBeEnabled();
    const source = (await page.evaluate(() => window.studyCompanion!.listSources()))[0];
    for (const question of ['请用 demo 解释主动回忆', '请帮我 review 一下主动回忆']) {
      const preview = await page.evaluate(
        ({ question, id }) => window.studyCompanion!.prepareQuestion(question, id),
        { question, id: source.id },
      );
      expect(preview.hits.length).toBeGreaterThan(0);
    }
    await page.screenshot({ path: test.info().outputPath('guide-first-screen.png') });
  } finally {
    await app.close();
  }
});

test('home scrolling stays in the content pane at normal and minimum window sizes while calendar announcements remain', async () => {
  const { root } = fixture({ empty: true });
  const { app, page } = await launch(root);
  try {
    for (const size of [
      [1280, 900],
      [900, 640],
    ]) {
      await app.evaluate(
        ({ BrowserWindow }, [width, height]) =>
          BrowserWindow.getAllWindows()[0].setSize(width, height),
        size,
      );
      await expect(page.locator('.daily-section .sr-only[role=status]')).toHaveCount(1);
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight))
        .toBeLessThanOrEqual(1);
      const before = await page.locator('.app-header').boundingBox();
      await page.locator('main').evaluate((element) => {
        element.scrollTop = 600;
      });
      expect(await page.locator('.app-header').boundingBox()).toEqual(before);
      expect(await page.evaluate(() => window.scrollY)).toBe(0);
      if (size[0] === 900)
        await page.screenshot({ path: test.info().outputPath('home-minimum-single-scroll.png') });
    }
  } finally {
    await app.close();
  }
});

test('review-page conflicts reload the newest saved response while preserving the recall draft until an explicit choice', async () => {
  const { root } = fixture();
  const { app, page } = await launch(root);
  try {
    await page.getByRole('button', { name: '学习助手', exact: true }).click();
    const chat = page.getByRole('region', { name: '学习助手', exact: true });
    await chat.getByRole('button', { name: '会话：短测验：事务', exact: true }).click();
    const answer = chat.getByRole('textbox', { name: '第 1 题 · 我的作答', exact: true });
    const saveQuiz = chat.getByRole('button', { name: '保存第 1 题作答与安排', exact: true });
    await answer.fill('第一份作答');
    await saveQuiz.click();
    await expect(
      chat.getByText('第 1 题的作答与安排已保存；没有评分或掌握判断。', { exact: true }),
    ).toBeVisible();
    await openPage(page, '轻量复习');
    await page.locator('.review-list-item').first().click();
    await page.getByRole('button', { name: '学习助手', exact: true }).click();
    await answer.fill('第二份作答');
    await saveQuiz.click();
    await expect(
      chat.getByText('第 1 题的作答与安排已保存；没有评分或掌握判断。', { exact: true }),
    ).toBeVisible();
    await openPage(page, '轻量复习');
    const review = page.getByRole('region', { name: '轻量复习', exact: true });
    await review.getByRole('button', { name: '开始这次回忆', exact: true }).click();
    const draft = review.getByRole('textbox', { name: '这次的回忆与作答', exact: true });
    await draft.fill('第三次回忆草稿');
    await review.getByRole('checkbox', { name: '仍有疑问', exact: true }).check();
    await review.getByLabel('安排复习日期', { exact: true }).fill('2026-10-20');
    const save = review.getByRole('button', { name: '保存作答与复习安排', exact: true });
    await save.click();
    await expect(review.getByText(/作答已更新/)).toBeVisible();
    const readLatest = review.getByRole('button', {
      name: '读取最新作答（保留当前输入）',
      exact: true,
    });
    await expect(readLatest).toBeVisible();
    await readLatest.click();
    await expect(review.getByRole('region', { name: '最新已保存作答', exact: true })).toContainText(
      '第二份作答',
    );
    await expect(draft).toHaveValue('第三次回忆草稿');
    await expect(review.getByLabel('安排复习日期', { exact: true })).toHaveValue('2026-10-20');
    expect((await page.evaluate(() => window.studyCompanion!.listReviews(null)))[0].revision).toBe(
      2,
    );
    await review
      .getByRole('button', { name: '保留当前输入，使用最新版本继续编辑', exact: true })
      .click();
    expect((await page.evaluate(() => window.studyCompanion!.listReviews(null)))[0].response).toBe(
      '第二份作答',
    );
    await save.click();
    await expect(
      review.getByText('这份作答和复习安排已保存，没有评分或掌握判断。', { exact: true }),
    ).toBeVisible();
    expect((await page.evaluate(() => window.studyCompanion!.listReviews(null)))[0]).toMatchObject({
      revision: 3,
      response: '第三次回忆草稿',
      hasQuestion: true,
      reviewDay: '2026-10-20',
    });
    await draft.fill('第四份尚未保存的输入');
    await review.getByRole('checkbox', { name: '仍有疑问', exact: true }).uncheck();
    await review.getByLabel('安排复习日期', { exact: true }).fill('2026-10-21');
    await readLatest.click();
    await expect(review.getByRole('region', { name: '最新已保存作答', exact: true })).toBeVisible();
    await expect(draft).toHaveValue('第四份尚未保存的输入');
    await review.getByRole('button', { name: '使用最新作答替换本页输入', exact: true }).click();
    await expect(draft).toHaveValue('第三次回忆草稿');
    await expect(review.getByRole('checkbox', { name: '仍有疑问', exact: true })).toBeChecked();
    await expect(review.getByLabel('安排复习日期', { exact: true })).toHaveValue('2026-10-20');
    expect((await page.evaluate(() => window.studyCompanion!.listReviews(null)))[0].revision).toBe(
      3,
    );
  } finally {
    await app.close();
  }
});

test('route task order is identical on home, planning, edit and restart', async () => {
  const { root } = fixture({ tasks: true });
  let { app, page } = await launch(root);
  const ordered = (page: Page) => page.locator('.planning-task-list .planning-list-item strong');
  try {
    await expect(page.locator('.today-task-list strong')).toHaveText(titles);
    await openPage(page, '学习计划');
    await expect(ordered(page)).toHaveText(titles);
    await page
      .locator('.planning-task-list .planning-list-item')
      .filter({ hasText: titles[1] })
      .click();
    await page.getByLabel('标题', { exact: true }).fill(`${titles[1]}（编辑）`);
    await page.getByRole('button', { name: '确认保存到本机', exact: true }).click();
    await expect(ordered(page)).toHaveText([titles[0], `${titles[1]}（编辑）`]);
    await app.close();
    ({ app, page } = await launch(root));
    await openPage(page, '学习计划');
    await expect(ordered(page)).toHaveText([titles[0], `${titles[1]}（编辑）`]);
  } finally {
    await app.close();
  }
});

test('a valid edited route needs one preview action and still requires an explicit final write confirmation', async () => {
  const { root } = fixture();
  const { app, page } = await launch(root);
  const day = localDayKey(new Date());
  try {
    await openPage(page, '学习路线');
    const route = page.getByRole('region', { name: '结构化学习路线', exact: true });
    await route.getByRole('checkbox', { name: '选择步骤 1 生成任务', exact: true }).check();
    await route.getByRole('checkbox', { name: '选择步骤 2 生成任务', exact: true }).check();
    const preview = route.getByRole('button', { name: '预览所选步骤任务', exact: true });
    await expect(preview).toBeEnabled();
    await expect(
      route.getByRole('button', { name: '核对并确认路线建议', exact: true }),
    ).toHaveCount(0);
    await preview.click();
    const final = route.getByRole('region', { name: '多步骤任务最终预览', exact: true });
    await expect(final).toBeVisible();
    expect(
      (await page.evaluate((day) => window.studyCompanion!.planningOverview(day), day)).tasks,
    ).toEqual([]);
    await route.getByRole('button', { name: '取消多步骤预览', exact: true }).click();
    await expect(final).toHaveCount(0);
    expect(
      (await page.evaluate((day) => window.studyCompanion!.planningOverview(day), day)).tasks,
    ).toEqual([]);
    await preview.click();
    await expect(final).toBeVisible();
    await route
      .getByRole('textbox', { name: '步骤 1 标题', exact: true })
      .fill('我核对后的阅读步骤');
    await expect(final).toHaveCount(0);
    await preview.click();
    await expect(final).toContainText('我核对后的阅读步骤');
    await route.getByRole('button', { name: '确认新增这 2 项待完成任务', exact: true }).click();
    await expect(
      route.getByRole('region', { name: '多步骤实际保存记录', exact: true }),
    ).toBeVisible();
    expect(
      (await page.evaluate((day) => window.studyCompanion!.planningOverview(day), day)).tasks.map(
        (task) => task.title,
      ),
    ).toEqual(['我核对后的阅读步骤', titles[1]]);
  } finally {
    await app.close();
  }
});

test('waiting shows elapsed time and observable status, hides reasoning and keeps stop available', async () => {
  const { root, path } = fixture({ empty: true });
  let active: ServerResponse | undefined;
  let calls = 0;
  const server = createServer(async (request, response) => {
    for await (const _part of request) {
      /* Consume the synthetic prompt. */
    }
    calls++;
    active = response;
    response.setHeader('Content-Type', 'application/x-ndjson');
    response.write(
      JSON.stringify({
        message: { thinking: 'PRIVATE_REASONING_FIXTURE', content: '' },
        done: false,
      }) + '\n',
    );
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as { port: number };
  const store = new Storage(path);
  store.saveSettings({
    ...defaultSettings,
    ollama: { baseUrl: `http://127.0.0.1:${address.port}`, model: 'trial-stream-fixture' },
  });
  store.close();
  let app: ElectronApplication | undefined;
  try {
    const launched = await launch(root);
    app = launched.app;
    const page = launched.page;
    await page.getByRole('button', { name: '学习助手', exact: true }).click();
    await page.clock.install();
    await page.getByRole('textbox', { name: '输入学习问题', exact: true }).fill('等待提示验证');
    await page.getByRole('button', { name: '发送问题', exact: true }).click();
    await expect.poll(() => calls).toBe(1);
    const status = page.getByRole('region', { name: '生成状态', exact: true });
    await expect(status).toContainText('尚未收到正文');
    const timer = status.locator('time');
    const initial = await timer.textContent();
    await page.clock.fastForward(31000);
    await expect(timer).not.toHaveText(initial!);
    await expect(status).toContainText('选择更小的模型');
    await expect(status).not.toContainText('%');
    await status.scrollIntoViewIfNeeded();
    await page.screenshot({ path: test.info().outputPath('generation-waiting.png') });
    await expect(page.getByText('PRIVATE_REASONING_FIXTURE', { exact: true })).toHaveCount(0);
    active!.write(
      JSON.stringify({ message: { content: '这是实际收到的正文。' }, done: false }) + '\n',
    );
    await expect(status).toContainText('正在接收正文');
    await expect(page.getByTestId('chat-answer')).toContainText('这是实际收到的正文。');
    await status.getByRole('button', { name: '停止本次生成', exact: true }).click();
    await expect(status).toHaveCount(0);
    const conversation = (await page.evaluate(() => window.studyCompanion!.listConversations()))[0];
    expect(
      (await page.evaluate((id) => window.studyCompanion!.getConversation(id), conversation.id))
        .turns[0],
    ).toMatchObject({ status: 'stopped', answer: '这是实际收到的正文。' });
  } finally {
    await app?.close();
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
