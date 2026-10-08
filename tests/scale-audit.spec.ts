import { test, expect, _electron as electron } from '@playwright/test';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir, cpus, totalmem } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { Storage } from '../electron/core/storage';
import { parseMarkdown } from '../electron/core/document-parser';

test.beforeAll(() => {
  mkdirSync('artifacts/acceptance-v12-20261008', { recursive: true });
});

test('measures a 500 source synthetic FTS library, responsive IPC, warm queries and cancelled rebuild preservation', async () => {
  test.setTimeout(120_000);
  const root = mkdtempSync(join(tmpdir(), 'study-retrieval-scale-'));
  mkdirSync(join(root, 'sources'));
  const store = new Storage(join(root, 'study-companion.sqlite3'));
  let bytes = 0,
    segments = 0;
  const seedStarted = Date.now();
  for (let n = 0; n < 500; n++) {
    const text = Array.from(
      { length: 10 },
      (_, i) =>
        `## 扩展专题${n}章节${i}\n\n数据库事务要么全部提交，要么全部回滚。隔离性防止并发事务相互干扰。${'中文规模验收段落只用于测试检索耗时。'.repeat(42)}\n`,
    ).join('\n');
    const id = createHash('sha256').update(text).digest('hex');
    writeFileSync(join(root, 'sources', id + '.md'), text);
    const parsed = parseMarkdown(Buffer.from(text));
    segments += parsed.segments.length;
    bytes += Buffer.byteLength(text);
    store.addSource({
      id,
      name: `合成资料${n}`,
      kind: 'markdown',
      bytes: Buffer.byteLength(text),
      ...parsed,
    });
  }
  store.close();
  const { ELECTRON_RUN_AS_NODE: _ignored, ...env } = process.env;
  const app = await electron.launch({
    args: ['.'],
    env: { ...env, STUDY_COMPANION_DATA_DIR: root },
  });
  try {
    const page = await app.firstWindow();
    await expect(page.getByRole('heading', { name: '开始今天的小进步' })).toBeVisible();
    const started = Date.now();
    const cold = page.evaluate(() =>
      window.studyCompanion!.prepareQuestion('数据库事务全部回滚', null),
    );
    const pingStart = Date.now();
    await page.evaluate(() => window.studyCompanion!.bootstrap());
    const concurrentBootstrapMs = Date.now() - pingStart;
    const preview = await cold;
    const coldMs = Date.now() - started;
    expect(preview.hits.length).toBeGreaterThan(0);
    const warmMs: number[] = [];
    for (let n = 0; n < 5; n++) {
      const start = Date.now();
      await page.evaluate(() => window.studyCompanion!.prepareQuestion('数据库事务全部回滚', null));
      warmMs.push(Date.now() - start);
    }
    const index = join(root, 'search-index.sqlite3');
    const before = createHash('sha256').update(readFileSync(index)).digest('hex');
    const cancellation = await page.evaluate(async () => {
      let cancel: Promise<void> | undefined;
      const unsubscribe = window.studyCompanion!.onRetrievalProgress((progress) => {
        if (!cancel && progress.current > 0) cancel = window.studyCompanion!.cancelRetrieval();
      });
      try {
        await window.studyCompanion!.rebuildIndex();
        return 'unexpected completion';
      } catch (error) {
        await cancel;
        return (error as { code: string }).code;
      } finally {
        unsubscribe();
      }
    });
    expect(cancellation).toBe('cancelled');
    const after = createHash('sha256').update(readFileSync(index)).digest('hex');
    expect(after).toBe(before);
    const metrics = await app.evaluate(({ app }) =>
      app.getAppMetrics().map((metric) => ({
        pid: metric.pid,
        type: metric.type,
        cpu: metric.cpu,
        memory: metric.memory,
      })),
    );
    await app.close();
    const db = new DatabaseSync(index, { readOnly: true });
    const chunkCount = Number(db.prepare('SELECT count(*) AS n FROM chunks_fts').get()!.n);
    db.close();
    writeFileSync(
      'artifacts/acceptance-v12-20261008/scale.json',
      JSON.stringify(
        {
          root,
          cpu: cpus()[0].model,
          logicalCpus: cpus().length,
          ramBytes: totalmem(),
          sourceCount: 500,
          bytes,
          segments,
          chunkCount,
          seedMs: started - seedStarted,
          coldMs,
          warmMs,
          concurrentBootstrapMs,
          cancellation,
          indexPreserved: before === after,
          metrics,
          preview,
          scope:
            'FTS5 only; synthetic preseeded main DB, not native import throughput or large BGE/real PDF performance',
        },
        null,
        2,
      ),
    );
  } finally {
    await app.close().catch(() => {});
  }
});
