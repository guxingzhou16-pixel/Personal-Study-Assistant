import { test, expect, _electron as electron } from '@playwright/test';
import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { Storage } from '../electron/core/storage';
import { parseMarkdown } from '../electron/core/document-parser';
import { embeddingPath, verifyEmbeddingFiles } from '../electron/core/embedding-files';
import { defaultSettings, type ChatTurn } from '../src/lib/types';
import { parseLearningPlan } from '../src/lib/learning-plan';

test('one real local structured route keeps exact evidence and original output for manual support review', async () => {
  const endpoint = 'http://127.0.0.1:11434';
  const model = 'qwen3.5:9b';
  const text =
    '# 项目自有事务复现资料\n\n事务的原子性要求全部操作成功才提交；任一步骤失败则回滚全部操作，不能只提交一半。\n\n## 依据边界\n\n这份资料只给出行为规则，没有描述锁、日志、隔离级别或任何实测结果。这些具体机制和观测结论需要另找原文或自行记录实验，不能从本段推出。';
  const root = mkdtempSync(join(tmpdir(), 'study-real-structured-route-'));
  mkdirSync('artifacts', { recursive: true });
  const output = mkdtempSync(resolve('artifacts/learning-plan-real-'));
  const receipt: Record<string, unknown> = {
    root,
    endpoint,
    model,
    generationAttempts: 1,
    text,
    manualReview: 'PENDING; shape and source location checks are not factuality checks',
  };
  const persist = () => writeFileSync(join(output, 'route.json'), JSON.stringify(receipt, null, 2));
  const tags = await fetch(`${endpoint}/api/tags`, {
    redirect: 'error',
    signal: AbortSignal.timeout(5000),
  });
  expect(tags.ok).toBe(true);
  expect(
    ((await tags.json()) as { models: { name: string }[] }).models.some(
      (item) => item.name === model,
    ),
  ).toBe(true);
  const cached = embeddingPath(resolve('artifacts/embedding-model'));
  expect(await verifyEmbeddingFiles(cached)).toBe(true);
  cpSync(cached, embeddingPath(join(root, 'embedding-models')), { recursive: true });
  const sourceId = createHash('sha256').update(text).digest('hex');
  mkdirSync(join(root, 'sources'));
  writeFileSync(join(root, 'sources', `${sourceId}.md`), text);
  const store = new Storage(join(root, 'study-companion.sqlite3'));
  store.saveSettings({ ...defaultSettings, ollama: { baseUrl: endpoint, model } });
  store.addSource({
    id: sourceId,
    name: '项目自有事务复现资料',
    kind: 'markdown',
    bytes: Buffer.byteLength(text),
    ...parseMarkdown(Buffer.from(text)),
  });
  store.close();
  const { ELECTRON_RUN_AS_NODE: _ignored, ...env } = process.env;
  const app = await electron.launch({
    args: ['.'],
    env: { ...env, STUDY_COMPANION_DATA_DIR: root },
  });
  try {
    const page = await app.firstWindow();
    await expect(page.getByRole('heading', { name: /今天，也长出\s*一点新想法/ })).toBeVisible();
    const preview = await page.evaluate(
      (sourceId) =>
        window.studyCompanion!.prepareLearningDraft({
          goal: '依据原文核对事务原子性规则，用自己的话写一份理解与待求证笔记；不要声称已验证实现机制。',
          query: '事务原子性',
          sourceId,
          minutes: 30,
        }),
      sourceId,
    );
    receipt.preview = preview;
    persist();
    const initial = await page.evaluate(
      ({ id, signature }) =>
        window.studyCompanion!.sendLearningDraft({ retrievalId: id, expectedProfile: signature }),
      { id: preview.evidence.id, signature: `ollama|${endpoint}|${model}` },
    );
    await expect
      .poll(
        async () => {
          const turn = (
            await page.evaluate(() => window.studyCompanion!.listLearningDrafts())
          ).find((item) => item.id === initial.id)!;
          receipt.turn = turn;
          persist();
          return turn.status;
        },
        { timeout: 550_000, intervals: [1000] },
      )
      .not.toBe('streaming');
    const turn = receipt.turn as ChatTurn;
    expect(turn.status).toBe('completed');
    receipt.checkedPlan = parseLearningPlan(turn.answer, turn.evidence, 30);
    const citations = [
      ...new Set(
        (receipt.checkedPlan as ReturnType<typeof parseLearningPlan>).steps.flatMap(
          (step) => step.citations,
        ),
      ),
    ];
    receipt.locations = await page.evaluate(
      async ({ id, citations }) =>
        Promise.all(citations.map((number) => window.studyCompanion!.resolveCitation(id, number))),
      { id: turn.id, citations },
    );
    await page.getByRole('button', { name: '学习路线', exact: true }).click();
    await expect(page.getByRole('region', { name: '结构化学习路线', exact: true })).toBeVisible();
    await page.screenshot({ path: join(output, 'route.png') });
  } finally {
    const page = await app.firstWindow();
    receipt.after = await page.evaluate(async () => ({
      tasks: (await window.studyCompanion!.planningOverview(new Date().toLocaleDateString('sv-SE')))
        .tasks,
      memories: await window.studyCompanion!.listMemories(),
      notes: await window.studyCompanion!.listNotes(),
    }));
    persist();
    expect(receipt.after).toEqual({ tasks: [], memories: [], notes: [] });
    await app.close();
    console.log(`一次真实结构化路线记录：${output}`);
  }
});
