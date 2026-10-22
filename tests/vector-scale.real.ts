import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { cpus, tmpdir, totalmem } from 'node:os';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test, expect, _electron as electron, type Page } from '@playwright/test';
import { Storage } from '../electron/core/storage';
import { parseMarkdown } from '../electron/core/document-parser';
import { embeddingPath, verifyEmbeddingFiles } from '../electron/core/embedding-files';
import { embeddingModel } from '../electron/core/embedding-model';
import type { EvidencePreview, SourceSegment } from '../src/lib/types';

const sourceCount = 300;
const day = '2026-10-11';
const targets = [
  {
    question: '怎样把复习分散在多个日期，随着记忆稳定延长间隔？',
    sections: [
      ['间隔复习', '间隔重复把复习分散到不同日期，随着记忆稳定逐步延长复习间隔。'],
      ['自我检验', '主动回忆是先合上资料独立回答问题，再对照原文纠正遗漏。'],
      ['记录进展', '复盘应记录实际完成的练习和仍待解决的疑问。'],
    ],
  },
  {
    question: '原子性要求事务怎样提交或回滚？',
    sections: [
      ['原子性', '事务原子性要求操作要么全部提交，要么全部回滚。'],
      ['隔离性', '隔离性让并发事务不能观察彼此尚未提交的中间状态。'],
      ['持久性', '持久性意味着成功提交的数据在崩溃后仍可恢复。'],
    ],
  },
  {
    question: '同一个请求被重复发送时，幂等操作应怎样处理？',
    sections: [
      ['幂等处理', '幂等操作在同一个请求被重复发送时，保持与执行一次相同的结果。'],
      ['确认回执', '请求的回执丢失时，应先查询实际状态再决定是否重试。'],
      ['单次确认', '确认标识成功使用后失效，重复提交不能新增第二条记录。'],
    ],
  },
];
const filler = [
  ['折纸', '先沿纸张对角线折叠，再展开检查折痕，两角需要准确重合。'],
  ['烘焙', '黄油软化后与砂糖搅拌，烤箱温度应以食谱说明为依据。'],
  ['园艺', '盆栽浇水前检查土壤湿度，避免根部长时间积水。'],
  ['绘画', '观察明暗交界线的位置，使用不同浓度的铅笔表现体积。'],
  ['观星', '夜间观测需要远离强光，使用星图识别星座的位置。'],
  ['音乐', '节拍器提供稳定拍点，练习音阶时注意每个音的力度。'],
];

function digest(bytes: Uint8Array | string): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function indexSnapshot(path: string) {
  const db = new DatabaseSync(path, { readOnly: true });
  try {
    const vectors = db
      .prepare('SELECT * FROM chunk_vectors ORDER BY model_id, source_id, anchor, start, end')
      .all();
    const hash = createHash('sha256');
    for (const row of vectors) {
      hash.update(JSON.stringify([row.model_id, row.source_id, row.anchor, row.start, row.end]));
      hash.update(row.embedding as Uint8Array);
    }
    return {
      version: Number(db.prepare('PRAGMA user_version').get()!.user_version),
      ftsChunks: Number(db.prepare('SELECT count(*) AS n FROM chunks_fts').get()!.n),
      vectors: vectors.length,
      embeddedSources: Number(db.prepare('SELECT count(*) AS n FROM embedded_sources').get()!.n),
      modelIds: [...new Set(vectors.map((row) => String(row.model_id)))],
      vectorByteLengths: [
        ...new Set(vectors.map((row) => (row.embedding as Uint8Array).byteLength)),
      ],
      vectorContentSha256: hash.digest('hex'),
      bytes: statSync(path).size,
      fileSha256: digest(readFileSync(path)),
    };
  } finally {
    db.close();
  }
}

async function query(page: Page, question: string, cancelRebuild = false) {
  return page.evaluate(
    async ({ question, day, cancelRebuild }) => {
      const api = window.studyCompanion!;
      const started = performance.now();
      const progress: { current: number; total: number; message: string; elapsedMs: number }[] = [];
      let settled = false;
      let probe:
        | Promise<{
            samples: {
              bootstrapMs: number;
              planningMs: number;
              completedDuringRetrieval: boolean;
              planning: Awaited<ReturnType<typeof api.planningOverview>>;
            }[];
            error: string | null;
          }>
        | undefined;
      let cancellation: Promise<{ error: string | null }> | undefined;
      const failureMessage = (error: unknown) =>
        error instanceof Error
          ? error.message
          : typeof error === 'object' && error !== null && 'message' in error
            ? String(error.message)
            : String(error);
      const unsubscribe = api.onRetrievalProgress((value) => {
        progress.push({ ...value, elapsedMs: performance.now() - started });
        // Wait for real vector indexing rather than merely launching its process.
        if (!probe && value.current > 0 && value.message.startsWith('准备向量索引')) {
          probe = (async () => {
            const samples = [];
            for (let i = 0; i < 3; i++) {
              const bootstrapStarted = performance.now();
              await api.bootstrap();
              const bootstrapMs = performance.now() - bootstrapStarted;
              const planningStarted = performance.now();
              const planning = await api.planningOverview(day);
              samples.push({
                bootstrapMs,
                planningMs: performance.now() - planningStarted,
                completedDuringRetrieval: !settled,
                planning,
              });
            }
            return samples;
          })().then(
            (samples) => ({ samples, error: null }),
            (error: unknown) => ({ samples: [], error: failureMessage(error) }),
          );
          if (cancelRebuild)
            cancellation = probe
              .then((outcome) => {
                if (outcome.error) throw new Error(outcome.error);
                return api.cancelRetrieval();
              })
              .then(
                () => ({ error: null }),
                (error: unknown) => ({ error: failureMessage(error) }),
              );
        }
      });
      try {
        const outcome = await (
          cancelRebuild ? api.rebuildIndex() : api.prepareQuestion(question, null)
        ).then(
          (value) => ({ value, error: null }),
          (error: { code: string; message: string }) => ({ value: null, error }),
        );
        settled = true;
        const elapsedMs = performance.now() - started;
        const probeOutcome = probe ? await probe : { samples: [], error: null };
        const cancelOutcome = cancellation ? await cancellation : { error: null };
        return {
          ...outcome,
          elapsedMs,
          progress,
          ipc: probeOutcome.samples,
          ipcError: probeOutcome.error,
          cancellationError: cancelOutcome.error,
        };
      } finally {
        unsubscribe();
      }
    },
    { question, day, cancelRebuild },
  );
}

function assertProbe(result: Awaited<ReturnType<typeof query>>) {
  expect(result.ipcError).toBeNull();
  expect(result.cancellationError).toBeNull();
}

function assertTarget(preview: EvidencePreview, id: string, segment: SourceSegment, quote: string) {
  expect(preview.sourceCount).toBe(sourceCount);
  expect(preview.notice).toContain('本地语义与关键词混合检索');
  expect(preview.notice).not.toContain('已使用关键词检索');
  const hit = preview.hits.find(
    (entry) => entry.sourceId === id && entry.anchor === segment.anchor,
  );
  expect(hit, `目标原文未命中：${quote}`).toBeDefined();
  expect(hit!.text).toContain(quote);
  expect(hit!.text).toBe(segment.text.slice(hit!.start, hit!.end));
}

test('real CPU vectors scale to 300 synthetic sources with persistent reuse and cancellable rebuild', async () => {
  const artifacts = process.env.STUDY_VECTOR_SCALE_ARTIFACTS!;
  mkdirSync(artifacts, { recursive: true });
  const root = mkdtempSync(join(tmpdir(), 'study-vector-scale-'));
  const report: Record<string, unknown> = {
    status: 'running',
    root,
    startedAt: new Date().toISOString(),
    gitHead: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    gitStatus: execFileSync('git', ['status', '--short'], { encoding: 'utf8' }),
    compiledFiles: ['dist-electron/main.cjs', 'dist-electron/search-worker.mjs'].map((path) => ({
      path,
      sha256: digest(readFileSync(path)),
    })),
    cpu: cpus()[0].model,
    logicalCpus: cpus().length,
    ramBytes: totalmem(),
    node: process.version,
    scope:
      'Synthetic preseeded Markdown; source Electron, offline real BGE CPU; no chat model, native import throughput, real PDF or maximum-capacity claim.',
    phases: {},
  };
  const phases = report.phases as Record<string, unknown>;
  let application: Awaited<ReturnType<typeof electron.launch>> | undefined;
  const persist = () =>
    writeFileSync(join(artifacts, 'vector-scale.json'), JSON.stringify(report, null, 2));
  try {
    const cached = embeddingPath(resolve('artifacts/embedding-model'));
    expect(
      await verifyEmbeddingFiles(cached),
      '固定五份权重必须事先存在并通过校验，不下载模型',
    ).toBe(true);
    const installed = embeddingPath(join(root, 'embedding-models'));
    cpSync(cached, installed, { recursive: true });
    expect(await verifyEmbeddingFiles(installed)).toBe(true);
    report.model = {
      ...embeddingModel,
      installed,
      verifiedFiles: embeddingModel.files.map((file) => ({
        ...file,
        actualSha256: digest(readFileSync(join(installed, file.path))),
      })),
    };
    mkdirSync(join(root, 'sources'));
    const store = new Storage(join(root, 'study-companion.sqlite3'));
    const expected: { id: string; segment: SourceSegment; quote: string }[] = [];
    let bytes = 0;
    let segments = 0;
    const seedStarted = performance.now();
    try {
      for (let n = 0; n < sourceCount; n++) {
        const sections =
          targets[n]?.sections ??
          Array.from({ length: 3 }, (_, i) => {
            const topic = filler[(n + i) % filler.length];
            return [
              `${topic[0]}练习${n}步骤${i}`,
              `${topic[1]} 本节是第${n}份合成材料的第${i}步。`,
            ];
          });
        const text = sections.map(([title, content]) => `## ${title}\n\n${content}\n`).join('\n');
        const id = digest(text);
        const parsed = parseMarkdown(Buffer.from(text));
        expect(parsed.segments).toHaveLength(3);
        expect(parsed.segments.every((segment) => segment.text.length < 384)).toBe(true);
        writeFileSync(join(root, 'sources', `${id}.md`), text);
        store.addSource({
          id,
          name: `向量规模合成资料${n}`,
          kind: 'markdown',
          bytes: Buffer.byteLength(text),
          ...parsed,
        });
        bytes += Buffer.byteLength(text);
        segments += parsed.segments.length;
        if (n < targets.length)
          expected.push({ id, segment: parsed.segments[0], quote: sections[0][1] });
      }
      const project = store.planning.saveProject({
        id: null,
        revision: 0,
        title: '只读响应验收',
        goal: '索引不能改变计划',
        archived: false,
      });
      store.planning.saveTask({
        id: null,
        revision: 0,
        title: '仍待手动完成',
        details: '',
        day,
        projectId: project.id,
        minutes: 25,
      });
    } finally {
      store.close();
    }
    report.fixture = {
      sourceCount,
      segments,
      bytes,
      seedMs: performance.now() - seedStarted,
      expected,
    };
    persist();
    const {
      ELECTRON_RUN_AS_NODE: _ignored,
      STUDY_COMPANION_DEV_URL: _dev,
      STUDY_COMPANION_DATA_DIR: _data,
      ...env
    } = process.env;
    const launch = async () => {
      const app = await electron.launch({
        args: ['.'],
        env: { ...env, STUDY_COMPANION_DATA_DIR: root },
      });
      application = app;
      await app.evaluate(({ app, net }) => {
        if (app.isPackaged) throw new Error('Only source Electron is allowed for this gate.');
        net.fetch = async () => {
          throw new Error('Offline vector scale gate: network requests prohibited.');
        };
      });
      const page = await app.firstWindow();
      await expect(page.getByRole('heading', { name: /今天，也长出\s*一点新想法/ })).toBeVisible();
      return { app, page };
    };
    let running = await launch();
    application = running.app;
    let page = running.page;
    const before = await page.evaluate(
      async (day) => ({
        bootstrap: await window.studyCompanion!.bootstrap(),
        planning: await window.studyCompanion!.planningOverview(day),
        focus: await window.studyCompanion!.focusOverview(),
        study: await window.studyCompanion!.studyOverview(2026, 10),
      }),
      day,
    );
    expect(resolve(before.bootstrap.dataDir)).toBe(resolve(root));
    report.initialState = before;
    const cold = await query(page, targets[0].question);
    phases.cold = cold;
    persist();
    assertProbe(cold);
    expect(cold.error).toBeNull();
    assertTarget(
      cold.value as EvidencePreview,
      expected[0].id,
      expected[0].segment,
      expected[0].quote,
    );
    expect(cold.ipc).toHaveLength(3);
    for (const sample of cold.ipc) {
      expect(sample.completedDuringRetrieval).toBe(true);
      expect(sample.bootstrapMs).toBeLessThan(5000);
      expect(sample.planningMs).toBeLessThan(5000);
      expect(sample.planning).toEqual(before.planning);
    }
    const index = join(root, 'search-index.sqlite3');
    const complete = indexSnapshot(index);
    report.completeIndex = complete;
    expect(complete).toMatchObject({
      version: 2,
      ftsChunks: 900,
      vectors: 900,
      embeddedSources: 300,
      vectorByteLengths: [2048],
    });
    expect(complete.modelIds).toHaveLength(1);
    const warm = [];
    for (const [i, target] of targets.entries()) {
      const result = await query(page, target.question);
      warm.push(result);
      phases.warm = warm;
      persist();
      assertProbe(result);
      expect(result.error).toBeNull();
      assertTarget(
        result.value as EvidencePreview,
        expected[i].id,
        expected[i].segment,
        expected[i].quote,
      );
    }
    expect(indexSnapshot(index)).toEqual(complete);
    const cancelled = await query(page, '', true);
    phases.cancelledRebuild = cancelled;
    report.afterCancelledRebuild = indexSnapshot(index);
    persist();
    assertProbe(cancelled);
    expect(cancelled.error?.code).toBe('cancelled');
    expect(cancelled.ipc).toHaveLength(3);
    for (const sample of cancelled.ipc) {
      expect(sample.completedDuringRetrieval).toBe(true);
      expect(sample.bootstrapMs).toBeLessThan(5000);
      expect(sample.planningMs).toBeLessThan(5000);
      expect(sample.planning).toEqual(before.planning);
    }
    expect(report.afterCancelledRebuild).toEqual(complete);
    const preserved = await query(page, targets[1].question);
    phases.afterCancellation = preserved;
    assertProbe(preserved);
    expect(preserved.error).toBeNull();
    assertTarget(
      preserved.value as EvidencePreview,
      expected[1].id,
      expected[1].segment,
      expected[1].quote,
    );
    report.metrics = await application.evaluate(({ app }) => app.getAppMetrics());
    await page.screenshot({ path: join(artifacts, 'after-vector-index.png'), fullPage: true });
    await application.close();
    application = undefined;
    report.afterExitIndex = indexSnapshot(index);
    expect(report.afterExitIndex).toEqual(complete);
    running = await launch();
    application = running.app;
    page = running.page;
    const restart = await query(page, targets[2].question);
    phases.restart = restart;
    report.afterRestartIndex = indexSnapshot(index);
    const after = await page.evaluate(
      async (day) => ({
        planning: await window.studyCompanion!.planningOverview(day),
        focus: await window.studyCompanion!.focusOverview(),
        study: await window.studyCompanion!.studyOverview(2026, 10),
      }),
      day,
    );
    report.finalState = after;
    persist();
    assertProbe(restart);
    expect(restart.error).toBeNull();
    assertTarget(
      restart.value as EvidencePreview,
      expected[2].id,
      expected[2].segment,
      expected[2].quote,
    );
    expect(report.afterRestartIndex).toEqual(complete);
    expect(after.planning).toEqual(before.planning);
    expect(after.focus).toEqual(before.focus);
    expect(after.study).toEqual(before.study);
    expect(await verifyEmbeddingFiles(installed)).toBe(true);
    report.status = 'PASS';
  } catch (error) {
    report.status = 'FAIL';
    report.error =
      error instanceof Error
        ? { name: error.name, message: error.message, stack: error.stack }
        : String(error);
    throw error;
  } finally {
    try {
      await application?.close();
    } catch (error) {
      report.status = 'FAIL';
      report.cleanupError = error instanceof Error ? error.message : String(error);
      throw error;
    } finally {
      report.finishedAt = new Date().toISOString();
      report.retainedSyntheticDataRoot = root;
      persist();
    }
  }
});
