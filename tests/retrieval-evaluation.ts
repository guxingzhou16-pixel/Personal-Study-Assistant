import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Storage } from '../electron/core/storage';
import { retrieve } from '../electron/core/retrieval';
import { retrieveHybrid } from '../electron/core/vector-retrieval';
import type { EmbeddingEncoder } from '../electron/core/embeddings';
import { evaluationSourceId, retrievalCases, retrievalSources } from './fixtures/retrieval-cases';

export async function evaluateRetrieval(encoder?: EmbeddingEncoder) {
  const directory = mkdtempSync(join(tmpdir(), 'study-retrieval-evaluation-'));
  const mainPath = join(directory, 'main.sqlite3');
  const indexPath = join(directory, 'search.sqlite3');
  try {
    const storage = new Storage(mainPath);
    try {
      for (const source of retrievalSources)
        storage.addSource({
          id: evaluationSourceId(source.key),
          name: source.name,
          kind: source.kind,
          bytes: Buffer.byteLength(JSON.stringify(source.segments)),
          pageCount: source.kind === 'pdf' ? source.segments.length : 1,
          textStatus: source.key === 'scan' ? 'none' : 'ready',
          outline: [],
          segments: source.segments,
        });
    } finally {
      storage.close();
    }
    const cases = [];
    let observedRssBytes = 0;
    for (const entry of retrievalCases) {
      const started = performance.now();
      const scope = entry.scope ? evaluationSourceId(entry.scope) : null;
      const result = encoder
        ? await retrieveHybrid(mainPath, indexPath, entry.question, scope, false, () => {}, encoder)
        : retrieve(mainPath, indexPath, entry.question, scope);
      const actual = result.hits.map((hit) => ({ sourceId: hit.sourceId, anchor: hit.anchor }));
      const ranks = entry.expected.map(
        (target) =>
          actual.findIndex(
            (hit) => hit.sourceId === target.sourceId && hit.anchor === target.anchor,
          ) + 1,
      );
      const found = ranks.filter((rank) => rank > 0);
      observedRssBytes = Math.max(observedRssBytes, process.memoryUsage().rss);
      cases.push({
        ...entry,
        actual,
        notice: result.notice,
        elapsedMs: performance.now() - started,
        hit: found.length > 0,
        recall: entry.expected.length ? found.length / entry.expected.length : null,
        targetPrecision: entry.expected.length
          ? actual.filter((hit) =>
              entry.expected.some(
                (target) => target.sourceId === hit.sourceId && target.anchor === hit.anchor,
              ),
            ).length / Math.max(1, actual.length)
          : null,
        reciprocalRank: found.length ? 1 / Math.min(...found) : 0,
        passed: entry.expected.length
          ? found.length === entry.expected.length
          : actual.length === 0,
      });
    }
    const answerable = cases.filter((entry) => entry.expected.length);
    const unanswerable = cases.filter((entry) => !entry.expected.length);
    const average = (values: number[]) =>
      values.reduce((sum, value) => sum + value, 0) / values.length;
    return {
      dataset: 'synthetic-retrieval-v1',
      method: encoder ? 'hybrid' : 'keyword',
      modelId: encoder?.id ?? null,
      sourceCount: retrievalSources.length,
      caseCount: cases.length,
      metrics: {
        answerableCount: answerable.length,
        unanswerableCount: unanswerable.length,
        hitAt4: average(answerable.map((entry) => Number(entry.hit))),
        meanRecallAt4: average(answerable.map((entry) => entry.recall!)),
        meanTargetPrecisionAt4: average(answerable.map((entry) => entry.targetPrecision!)),
        mrrAt4: average(answerable.map((entry) => entry.reciprocalRank)),
        noEvidenceAccuracy: average(unanswerable.map((entry) => Number(entry.passed))),
      },
      performance: {
        firstQueryMs: cases[0].elapsedMs,
        meanWarmQueryMs: average(cases.slice(1).map((entry) => entry.elapsedMs)),
        observedRssBytes,
      },
      fallbackCount: encoder
        ? cases.filter((entry) => entry.notice.includes('已使用关键词检索')).length
        : 0,
      failures: cases.filter((entry) => !entry.passed),
      cases,
    };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}
