import { test, expect, _electron as electron } from '@playwright/test';
import { createHash } from 'node:crypto';
import { cpSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { Storage } from '../electron/core/storage';
import { parseMarkdown } from '../electron/core/document-parser';
import { embeddingPath, verifyEmbeddingFiles } from '../electron/core/embedding-files';
import { embeddingModel } from '../electron/core/embedding-model';
import { citationNumbers } from '../electron/core/chat';
import { defaultSettings, type ChatTurn } from '../src/lib/types';

const endpoint = 'http://127.0.0.1:11434';
const model = 'qwen3.5:9b';
const signature = `ollama|${endpoint}|${model}`;
mkdirSync('artifacts', { recursive: true });
const output = mkdtempSync(resolve('artifacts/quality-independent-'));
const cases = [
  {
    id: 'learning-observation',
    title: '复习方式观察记录',
    text: [
      '# 复习方式观察：方法',
      '这是合成的个人学习观察，不是临床试验。小林学习同一组十张术语卡，第一轮在当天连续重读二十分钟；第二轮把二十分钟分成当天十分钟和次日十分钟，并在次日复习前先闭卷回忆。两轮材料相同，复习总时长均为二十分钟。',
      '## 复习方式观察：结果与限制',
      '在各轮最后一次复习后的第二天，连续重读轮答对五题，分散并闭卷回忆轮答对八题。这里只能描述这次观察的三题差异；两轮同时改变了间隔与回忆方式，不能据此把差异完全归因于间隔，也不能推出所有学习者都会提高三题。',
    ].join('\n\n'),
    question:
      '综合复习方式观察的方法和结果：两轮各如何安排二十分钟，第二天正确题数相差多少？为什么不能把差异完全归因于间隔或推广给所有人？请分别引用方法段与结果限制段。',
    expectedAnchors: ['md-line-1', 'md-line-5'],
    humanCriteria: [
      '方法段支持连续二十分钟与跨两天各十分钟且闭卷回忆；总时长相同。',
      '结果段支持八题与五题相差三题，并明确两个因素同时改变，不能单独归因或推广。',
      '至少两处事实引用须逐句对照实际证据；不得编造因果效果或掌握程度。',
    ],
  },
  {
    id: 'condensation-and-evaporation',
    title: '水汽与液态水实验说明',
    text: [
      '# 水汽实验：露点与凝结',
      '本实验中室内空气温度为二十五摄氏度，露点为十六摄氏度。杯外表面降到十二摄氏度时，表面附近空气被冷却到露点以下，水汽凝结成杯外水滴；杯外水滴来自空气中的水汽，不是杯内液态水穿过杯壁。',
      '## 水汽实验：蒸发与沸腾',
      '液态水的蒸发可在表面发生，不要求整杯水达到沸点。在本实验的正常气压下，二十摄氏度的浅盘水能够缓慢蒸发，尽管尚未达到一百摄氏度的沸点。凝结是气态变液态，蒸发是液态变气态。',
    ].join('\n\n'),
    question:
      '综合水汽实验两段：十二摄氏度杯外为何有水滴，二十摄氏度浅盘水为何仍能减少？分别说明水的来源与相变方向，并解释是否都需要达到一百摄氏度。请分别引用露点凝结段和蒸发沸腾段。',
    expectedAnchors: ['md-line-1', 'md-line-5'],
    humanCriteria: [
      '露点段支持十二低于十六，杯外水来自空气水汽，凝结方向为气态到液态。',
      '蒸发段支持二十摄氏度可在表面蒸发，液态到气态，无须达到一百摄氏度。',
      '至少两处事实引用须逐句对照实际证据；不得写成杯壁渗漏或把蒸发等同沸腾。',
    ],
  },
  {
    id: 'revolution-timeline',
    title: '法国革命两个节点',
    text: [
      '# 法国革命节点：群众行动',
      '一七八九年七月十四日，巴黎民众攻占巴士底狱。这段摘要记录一次群众行动及其日期，并未记录人权宣言的公布；不能把这项行动的日期直接当作宣言公布日期。',
      '## 法国革命节点：制度文本',
      '一七八九年八月二十六日，制宪议会通过《人权和公民权宣言》。这段摘要记录制度文本的通过及其日期。两个节点先后发生，但仅凭这两份摘要不能证明攻占巴士底狱是宣言通过的唯一原因，也不能说两个节点在同一天。',
    ].join('\n\n'),
    question:
      '综合法国革命两个节点：按时间顺序写出日期、主体和事件，区分群众行动与制度文本。两段摘要能否证明它们同日发生或前者是后者唯一原因？请分别引用两个节点段。',
    expectedAnchors: ['md-line-1', 'md-line-5'],
    humanCriteria: [
      '群众行动段支持七月十四日、巴黎民众、攻占巴士底狱。',
      '制度文本段支持八月二十六日、制宪议会、通过宣言，并明确非同日与唯一因果不足。',
      '至少两处事实引用须逐句对照实际证据；不得混淆日期主体或额外补出未经证实的唯一因果。',
    ],
  },
];

test.beforeAll(async () => {
  expect(new URL(endpoint).hostname).toBe('127.0.0.1');
  const response = await fetch(`${endpoint}/api/tags`, {
    redirect: 'error',
    signal: AbortSignal.timeout(5000),
  });
  expect(response.ok).toBe(true);
  expect(
    ((await response.json()) as { models: { name: string }[] }).models.some(
      (entry) => entry.name === model,
    ),
  ).toBe(true);
  expect(
    await verifyEmbeddingFiles(embeddingPath(resolve('artifacts/embedding-model'))),
    'Require existing pinned development weights; never download automatically.',
  ).toBe(true);
  console.log(`真实独立跨学科质量样本：${output}`);
});

for (const fixture of cases) {
  test(`${fixture.id}: preserve one independent real hybrid answer for human grounding review`, async () => {
    const root = mkdtempSync(join(tmpdir(), 'study-quality-independent-'));
    const sourceId = createHash('sha256').update(fixture.text).digest('hex');
    mkdirSync(join(root, 'sources'));
    writeFileSync(join(root, 'sources', `${sourceId}.md`), fixture.text);
    const copiedModel = embeddingPath(join(root, 'embedding-models'));
    cpSync(embeddingPath(resolve('artifacts/embedding-model')), copiedModel, { recursive: true });
    expect(await verifyEmbeddingFiles(copiedModel)).toBe(true);
    const store = new Storage(join(root, 'study-companion.sqlite3'));
    try {
      store.saveSettings({ ...defaultSettings, ollama: { baseUrl: endpoint, model } });
      store.addSource({
        id: sourceId,
        name: fixture.title,
        kind: 'markdown',
        bytes: Buffer.byteLength(fixture.text),
        ...parseMarkdown(Buffer.from(fixture.text)),
      });
    } finally {
      store.close();
    }
    const result: Record<string, unknown> = {
      fixture,
      model,
      endpoint,
      dataRoot: root,
      sourceId,
      embedding: { repository: embeddingModel.repository, revision: embeddingModel.revision },
      startedAt: new Date().toISOString(),
      semanticAcceptance: 'pending-human-review',
      fixturePurpose:
        'Fixed synthetic fixtures; first-use or regression status is recorded in the dated human-review report.',
    };
    const persist = () =>
      writeFileSync(join(output, `${fixture.id}.json`), JSON.stringify(result, null, 2));
    persist();
    const {
      ELECTRON_RUN_AS_NODE: _node,
      STUDY_COMPANION_DEV_URL: _dev,
      STUDY_COMPANION_DATA_DIR: _data,
      ...env
    } = process.env;
    const app = await electron.launch({
      args: ['.'],
      env: { ...env, STUDY_COMPANION_DATA_DIR: root },
    });
    try {
      expect(await app.evaluate(({ app }) => app.isPackaged)).toBe(false);
      expect(await app.evaluate(({ app }) => app.getPath('userData'))).toBe(root);
      const page = await app.firstWindow();
      await expect(page.getByRole('heading', { name: '开始今天的小进步' })).toBeVisible();
      const prepared = await page.evaluate(
        async ({ question, sourceId, signature }) => {
          const api = window.studyCompanion!;
          const preview = await api.prepareQuestion(question, sourceId);
          if (!preview.hits.length)
            throw new Error('Independent fixture requires non-empty real model evidence.');
          const conversation = await api.createConversation();
          return {
            preview,
            turn: await api.sendChat({
              conversationId: conversation.id,
              question,
              retrievalId: preview.id,
              expectedProfile: signature,
            }),
          };
        },
        { question: fixture.question, sourceId, signature },
      );
      result.preview = prepared.preview;
      result.turn = prepared.turn;
      persist();
      let turn: ChatTurn = prepared.turn;
      await expect
        .poll(
          async () => {
            turn = await page.evaluate(
              async ({ id, conversationId }) =>
                (await window.studyCompanion!.getConversation(conversationId)).turns.find(
                  (entry) => entry.id === id,
                )!,
              { id: turn.id, conversationId: turn.conversationId },
            );
            result.turn = turn;
            result.updatedAt = new Date().toISOString();
            persist();
            return turn.status;
          },
          { timeout: 180_000, intervals: [500] },
        )
        .not.toBe('streaming');
      result.finishedAt = new Date().toISOString();
      result.citedNumbers = citationNumbers(turn.answer);
      result.retrievedAnchors = prepared.preview.hits.map((hit) => hit.anchor);
      result.citationLocations = [];
      persist();
      expect(turn.status).toBe('completed');
      expect(turn.answer.trim()).not.toBe('');
      expect(turn.evidence).toEqual(prepared.preview.hits);
      expect(prepared.preview.notice).toContain('混合检索');
      expect(prepared.preview.notice).not.toMatch(/已使用关键词检索|未完成|进程退出|超时/);
      for (const hit of turn.evidence) {
        (result.citationLocations as unknown[]).push(
          await page.evaluate(
            ({ id, number }) => window.studyCompanion!.resolveCitation(id, number),
            { id: turn.id, number: hit.number },
          ),
        );
        persist();
      }
      expect(
        fixture.expectedAnchors.every((anchor) =>
          turn.evidence.some((hit) => hit.anchor === anchor),
        ),
      ).toBe(true);
      const numbers = citationNumbers(turn.answer);
      expect(
        numbers.every((number) => turn.evidence.some((hit) => hit.number === number)),
        'Unknown references remain a quality failure even when the app warns.',
      ).toBe(true);
      for (const anchor of fixture.expectedAnchors)
        expect(numbers, `The answer must actually cite the retrieved section ${anchor}.`).toContain(
          turn.evidence.find((hit) => hit.anchor === anchor)!.number,
        );
      result.processContract =
        'real hybrid generation completed; references resolved; semantics pending human review';
      persist();
    } catch (error) {
      result.executionError = error instanceof Error ? error.message : String(error);
      persist();
      throw error;
    } finally {
      await app.close();
      const database = new DatabaseSync(join(root, 'study-companion.sqlite3'), { readOnly: true });
      try {
        const counts = Object.fromEntries(
          ['daily_tasks', 'study_projects', 'memories', 'notes'].map((table) => [
            table,
            database.prepare(`SELECT COUNT(*) AS total FROM ${table}`).get()!.total,
          ]),
        );
        result.persistedCounts = counts;
        persist();
        expect(counts).toEqual({ daily_tasks: 0, study_projects: 0, memories: 0, notes: 0 });
      } finally {
        database.close();
      }
    }
  });
}
