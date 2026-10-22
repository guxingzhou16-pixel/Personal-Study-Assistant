import { openPage } from './helpers/navigation';
import { test, expect, _electron as electron } from '@playwright/test';
import { randomUUID, createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { Storage } from '../electron/core/storage';
import { parseMarkdown } from '../electron/core/document-parser';
import { fixtureTurn } from './fixtures/legacy-databases';

function fixture(corrupt = false, legacy = false) {
  const root = mkdtempSync(join(tmpdir(), 'study-review-fixes-'));
  const text =
    '# 版式验收\n\n事务要么全部提交，要么全部回滚。\n\n含有**强调**和[链接文字](https://example.com)。\n第二行继续。\n\n| 方法 | 行动 |\n|---|---|\n| 主动回忆 | 独立回答 |\n\n- 先阅读\n- 再复述\n\n## 另一节\n\n另一个位置。';
  const id = createHash('sha256').update(text).digest('hex');
  mkdirSync(join(root, 'sources'));
  writeFileSync(join(root, 'sources', `${id}.md`), text);
  const path = join(root, 'study-companion.sqlite3');
  const store = new Storage(path);
  const parsed = parseMarkdown(Buffer.from(text));
  if (legacy)
    parsed.segments[0].text =
      '版式验收\n事务要么全部提交，要么全部回滚。\n含有强调和链接文字。\n第二行继续。\n| 方法 | 行动 |\n|---|---|\n| 主动回忆 | 独立回答 |\n先阅读再复述\n';
  store.addSource({
    id,
    name: '版式验收',
    kind: 'markdown',
    bytes: Buffer.byteLength(text),
    ...parsed,
  });
  const fact = '事务要么全部提交，要么全部回滚。';
  const segment = parsed.segments[0];
  const start = segment.text.indexOf(fact);
  const evidence = [
    {
      number: 1,
      sourceId: id,
      sourceName: '版式验收',
      kind: 'markdown' as const,
      anchor: segment.anchor,
      title: segment.title,
      line: segment.line,
      start,
      end: start + fact.length,
      text: fact,
    },
  ];
  const secondText = '# 第二份资料\n\n事务要么全部提交，要么全部回滚。';
  const secondId = createHash('sha256').update(secondText).digest('hex');
  const secondParsed = parseMarkdown(Buffer.from(secondText));
  writeFileSync(join(root, 'sources', `${secondId}.md`), secondText);
  store.addSource({
    id: secondId,
    name: '第二份资料',
    kind: 'markdown',
    bytes: Buffer.byteLength(secondText),
    ...secondParsed,
  });
  const secondStart = secondParsed.segments[0].text.indexOf(fact);
  evidence.push({
    ...evidence[0],
    number: 2,
    sourceId: secondId,
    sourceName: '第二份资料',
    title: '第二份资料',
    start: secondStart,
    end: secondStart + fact.length,
  });
  const conversation = store.chat.create();
  const turn = fixtureTurn(conversation.id, {
    id: randomUUID(),
    question: '引用延迟验收',
    answer: '全部提交或回滚。[1] 另一份资料也有相同表述。[2]',
    evidence,
  });
  store.chat.addTurn(turn);
  if (!corrupt) {
    const quiz = store.chat.create();
    store.chat.addTurn(
      fixtureTurn(quiz.id, {
        id: randomUUID(),
        question: '三题复习',
        evidence,
        practiceRequest: { kind: 'quiz', topic: '事务', sourceId: id },
        answer: JSON.stringify({
          items: [1, 2, 3].map((index) => ({
            question: `事务回忆问题 ${index}`,
            answer: fact,
            citations: [1],
          })),
        }),
      }),
    );
  }
  store.close();
  if (corrupt) {
    const db = new DatabaseSync(path);
    db.prepare("UPDATE chat_turns SET evidence = '{}'").run();
    db.close();
  }
  return { root, id };
}
async function launch(root: string) {
  const { ELECTRON_RUN_AS_NODE: _node, STUDY_COMPANION_DEV_URL: _dev, ...env } = process.env;
  const app = await electron.launch({
    args: ['.'],
    env: { ...env, STUDY_COMPANION_DATA_DIR: root },
  });
  return { app, page: await app.firstWindow() };
}

test('immediate real-worker cancellation waits for process exit and permits the next query', async () => {
  const { root } = fixture();
  const { app, page } = await launch(root);
  try {
    await app.evaluate(({ utilityProcess }) => {
      const state = globalThis as unknown as {
        searchExitEvents: { event: string; pid?: number; accepted?: boolean }[];
      };
      state.searchExitEvents = [];
      const fork = utilityProcess.fork.bind(utilityProcess);
      utilityProcess.fork = (...args) => {
        const worker = fork(...args);
        const kill = worker.kill.bind(worker);
        worker.kill = () => {
          const accepted = kill();
          state.searchExitEvents.push({ event: 'kill', pid: worker.pid, accepted });
          return accepted;
        };
        worker.on('spawn', () => state.searchExitEvents.push({ event: 'spawn', pid: worker.pid }));
        worker.on('exit', () => state.searchExitEvents.push({ event: 'exit', pid: worker.pid }));
        return worker;
      };
    });
    const result = await page.evaluate(async () => {
      const pending = window.studyCompanion!.prepareQuestion('事务', null).then(
        () => 'completed',
        (error: { code: string }) => error.code,
      );
      await window.studyCompanion!.cancelRetrieval();
      return pending;
    });
    const events = await app.evaluate(
      () => (globalThis as unknown as { searchExitEvents: unknown[] }).searchExitEvents,
    );
    expect({ result, events }).toMatchObject({ result: 'cancelled' });
    expect(events).toEqual(expect.arrayContaining([expect.objectContaining({ event: 'exit' })]));
    expect(
      (await page.evaluate(() => window.studyCompanion!.prepareQuestion('事务', null))).hits.length,
    ).toBeGreaterThan(0);
  } finally {
    await app.close();
  }
});

test('the latest citation wins out of order and closing a reading sidebar cancels its pending jump', async () => {
  const { root } = fixture();
  const { app, page } = await launch(root);
  try {
    await page.getByRole('button', { name: '学习助手', exact: true }).click();
    const chat = page.getByRole('region', { name: '学习助手', exact: true });
    await chat.getByRole('button', { name: '会话：引用延迟验收', exact: true }).click();
    await app.evaluate(({ ipcMain }) => {
      const handlers = (
        ipcMain as unknown as {
          _invokeHandlers: Map<string, (...args: unknown[]) => Promise<unknown>>;
        }
      )._invokeHandlers;
      const original = handlers.get('study:resolve-citation')!;
      const state = globalThis as unknown as { pendingCitations: (() => void)[] };
      state.pendingCitations = [];
      ipcMain.removeHandler('study:resolve-citation');
      ipcMain.handle('study:resolve-citation', async (...args) => {
        const result = await original(...args);
        await new Promise<void>((resolve) => {
          state.pendingCitations.push(resolve);
        });
        return result;
      });
    });
    const pendingCount = () =>
      app.evaluate(
        () => (globalThis as unknown as { pendingCitations: unknown[] }).pendingCitations.length,
      );
    const release = (index: number) =>
      app.evaluate(
        (_electron, position) =>
          (globalThis as unknown as { pendingCitations: (() => void)[] }).pendingCitations[
            position
          ](),
        index,
      );
    await chat.getByRole('button', { name: '引用 1', exact: true }).click();
    await expect.poll(pendingCount).toBe(1);
    await chat.getByRole('button', { name: '引用 2', exact: true }).click();
    await expect.poll(pendingCount).toBe(2);
    await release(1);
    await expect(page.getByRole('region', { name: '阅读 第二份资料', exact: true })).toBeVisible();
    await release(0);
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    await expect(page.getByRole('region', { name: '阅读 第二份资料', exact: true })).toBeVisible();
    await page.getByRole('button', { name: '资料库', exact: true }).click();
    await page.getByRole('button', { name: '阅读 版式验收', exact: true }).click();
    await page
      .locator('.markdown-reading p')
      .first()
      .evaluate((element) => {
        const range = document.createRange();
        range.selectNodeContents(element);
        const selection = window.getSelection()!;
        selection.removeAllRanges();
        selection.addRange(range);
      });
    await page.locator('.reader-scroll').dispatchEvent('mouseup');
    await page.getByRole('button', { name: '提问选中原文', exact: true }).click();
    await expect(chat.getByRole('textbox', { name: '输入学习问题' })).toHaveValue(/这段原文/);
    await chat.getByRole('button', { name: '引用 2', exact: true }).click();
    await expect.poll(pendingCount).toBe(3);
    await page.getByRole('button', { name: '收起侧栏', exact: true }).click();
    await release(2);
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    await expect(page.getByRole('region', { name: '阅读 版式验收', exact: true })).toBeVisible();
    await expect(page.locator('[aria-label="阅读侧栏"]')).toHaveCount(0);
  } finally {
    await app.close();
  }
});

test('a corrupt default conversation reports a data error while navigation and backup controls remain usable', async () => {
  const { root } = fixture(true);
  const { app, page } = await launch(root);
  try {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await expect(page.getByRole('navigation', { name: '主导航' })).toBeVisible();
    await page.getByRole('button', { name: '学习助手', exact: true }).click();
    await expect(page.getByRole('region', { name: '学习助手', exact: true })).toContainText(
      '快照格式损坏',
    );
    await page.getByRole('button', { name: '设置', exact: true }).click();
    await expect(page.getByRole('button', { name: '导出完整备份', exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    await app.close();
  }
});

test('a citation result arriving after explicit navigation cannot reopen the reader', async () => {
  const { root } = fixture();
  const { app, page } = await launch(root);
  try {
    await page.getByRole('button', { name: '学习助手', exact: true }).click();
    await page.getByRole('button', { name: '会话：引用延迟验收', exact: true }).click();
    await app.evaluate(({ ipcMain }) => {
      const handlers = (
        ipcMain as unknown as {
          _invokeHandlers: Map<string, (...args: unknown[]) => Promise<unknown>>;
        }
      )._invokeHandlers;
      const original = handlers.get('study:resolve-citation')!;
      const state = globalThis as unknown as { releaseCitation?: () => void };
      ipcMain.removeHandler('study:resolve-citation');
      ipcMain.handle('study:resolve-citation', async (...args) => {
        const result = await original(...args);
        await new Promise<void>((resolve) => {
          state.releaseCitation = resolve;
        });
        return result;
      });
    });
    await page.getByRole('button', { name: '引用 1', exact: true }).click();
    await expect
      .poll(() =>
        app.evaluate(
          () => typeof (globalThis as unknown as { releaseCitation?: () => void }).releaseCitation,
        ),
      )
      .toBe('function');
    await openPage(page, '学习计划');
    await expect(page.locator('.planning-page')).toBeVisible();
    await app.evaluate(() =>
      (globalThis as unknown as { releaseCitation: () => void }).releaseCitation(),
    );
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    await expect(page.locator('.planning-page')).toBeVisible();
    await expect(page.getByRole('region', { name: '阅读 版式验收', exact: true })).toHaveCount(0);
  } finally {
    await app.close();
  }
});

test('quiz review conflicts can reload the latest revision without losing or silently resubmitting the draft', async () => {
  const { root } = fixture();
  const { app, page } = await launch(root);
  try {
    await page.getByRole('button', { name: '学习助手', exact: true }).click();
    const chat = page.getByRole('region', { name: '学习助手', exact: true });
    await chat.getByRole('button', { name: '会话：短测验：事务', exact: true }).click();
    const answer = chat.getByRole('textbox', { name: '第 1 题 · 我的作答', exact: true });
    const save = chat.getByRole('button', { name: '保存第 1 题作答与安排', exact: true });
    await answer.fill('第一份作答');
    await save.click();
    await expect(
      chat.getByText('第 1 题的作答与安排已保存；没有评分或掌握判断。', { exact: true }),
    ).toBeVisible();
    await openPage(page, '轻量复习');
    await page.locator('.review-list-item').first().click();
    await page.getByRole('button', { name: '开始这次回忆', exact: true }).click();
    await page.getByRole('textbox', { name: '这次的回忆与作答', exact: true }).fill('第二份作答');
    await page.getByRole('button', { name: '保存作答与复习安排', exact: true }).click();
    await expect(
      page.getByText('这份作答和复习安排已保存，没有评分或掌握判断。', { exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: '学习助手', exact: true }).click();
    await answer.fill('第三份作答');
    await save.click();
    await expect(chat.getByText(/作答已更新/)).toBeVisible();
    await chat.getByRole('button', { name: '刷新会话', exact: true }).click();
    await expect(answer).toHaveValue('第三份作答');
    await chat.getByRole('button', { name: '读取最新作答（保留当前输入）', exact: true }).click();
    await expect(chat.getByRole('region', { name: '最新已保存作答' })).toContainText('第二份作答');
    await expect(answer).toHaveValue('第三份作答');
    expect((await page.evaluate(() => window.studyCompanion!.listReviews(null)))[0].revision).toBe(
      2,
    );
    await chat
      .getByRole('button', { name: '保留当前输入，使用最新版本继续编辑', exact: true })
      .click();
    expect((await page.evaluate(() => window.studyCompanion!.listReviews(null)))[0].response).toBe(
      '第二份作答',
    );
    await save.click();
    await expect(
      chat.getByText('第 1 题的作答与安排已保存；没有评分或掌握判断。', { exact: true }),
    ).toBeVisible();
    const saved = (await page.evaluate(() => window.studyCompanion!.listReviews(null)))[0];
    expect(saved).toMatchObject({ revision: 3, response: '第三份作答' });
  } finally {
    await app.close();
  }
});

for (const legacy of [false, true])
  test(`same-section table, list and link selections preserve exact text across restart (legacy=${legacy})`, async () => {
    const { root, id } = fixture(false, legacy);
    let { app, page } = await launch(root);
    try {
      await page.getByRole('button', { name: '资料库', exact: true }).click();
      await page.getByRole('button', { name: '阅读 版式验收', exact: true }).click();
      for (const selector of [
        '.markdown-reading table tbody tr',
        '.markdown-reading ul',
        '.markdown-reading p:has(.external-reference)',
      ]) {
        await page.locator(selector).evaluate((element) => {
          const range = document.createRange();
          range.selectNodeContents(element);
          const selection = window.getSelection()!;
          selection.removeAllRanges();
          selection.addRange(range);
        });
        await page.locator('.reader-scroll').dispatchEvent('mouseup');
        await page.getByRole('button', { name: '复制引用', exact: true }).click();
        await expect(page.locator('.reader-selection [role=status]')).toContainText('已复制');
      }
      const rejected = await page.evaluate(async (sourceId) => {
        try {
          await window.studyCompanion!.copyCitation(sourceId, 'md-line-1', '再复述 另一节');
          return false;
        } catch {
          return true;
        }
      }, id);
      expect(rejected).toBe(true);
      await app.close();
      ({ app, page } = await launch(root));
      await page.getByRole('button', { name: '资料库', exact: true }).click();
      await page.getByRole('button', { name: '阅读 版式验收', exact: true }).click();
      await page.locator('.markdown-reading ul').evaluate((element) => {
        const range = document.createRange();
        range.selectNodeContents(element);
        const selection = window.getSelection()!;
        selection.removeAllRanges();
        selection.addRange(range);
      });
      await page.locator('.reader-scroll').dispatchEvent('mouseup');
      await page.getByRole('button', { name: '复制引用', exact: true }).click();
      await expect(page.locator('.reader-selection [role=status]')).toContainText('已复制');
    } finally {
      await app.close();
    }
  });
