import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Storage } from '../electron/core/storage';
import { retrieve } from '../electron/core/retrieval';
import { evaluationSourceId, retrievalCases, retrievalSources } from './fixtures/retrieval-cases';

export function evaluateRetrieval() {
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
    const cases = retrievalCases.map((entry) => {
      const result = retrieve(
        mainPath,
        indexPath,
        entry.question,
        entry.scope ? evaluationSourceId(entry.scope) : null,
      );
      const actual = result.hits.map((hit) => ({ sourceId: hit.sourceId, anchor: hit.anchor }));
      const ranks = entry.expected.map(
        (target) =>
          actual.findIndex(
            (hit) => hit.sourceId === target.sourceId && hit.anchor === target.anchor,
          ) + 1,
      );
      const found = ranks.filter((rank) => rank > 0);
      return {
        ...entry,
        actual,
        hit: found.length > 0,
        recall: entry.expected.length ? found.length / entry.expected.length : null,
        reciprocalRank: found.length ? 1 / Math.min(...found) : 0,
        passed: entry.expected.length
          ? found.length === entry.expected.length
          : actual.length === 0,
      };
    });
    const answerable = cases.filter((entry) => entry.expected.length);
    const unanswerable = cases.filter((entry) => !entry.expected.length);
    const average = (values: number[]) =>
      values.reduce((sum, value) => sum + value, 0) / values.length;
    return {
      dataset: 'synthetic-retrieval-v1',
      sourceCount: retrievalSources.length,
      caseCount: cases.length,
      metrics: {
        answerableCount: answerable.length,
        unanswerableCount: unanswerable.length,
        hitAt4: average(answerable.map((entry) => Number(entry.hit))),
        meanRecallAt4: average(answerable.map((entry) => entry.recall!)),
        mrrAt4: average(answerable.map((entry) => entry.reciprocalRank)),
        noEvidenceAccuracy: average(unanswerable.map((entry) => Number(entry.passed))),
      },
      failures: cases.filter((entry) => !entry.passed),
      cases,
    };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}
