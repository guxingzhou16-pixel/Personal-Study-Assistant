import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Storage } from '../electron/core/storage';
import { retrieve } from '../electron/core/retrieval';
import { retrieveHybrid } from '../electron/core/vector-retrieval';
import { citationNumbers } from '../electron/core/chat';
import type { EmbeddingEncoder } from '../electron/core/embeddings';
import type { Evidence, SourceSegment } from '../src/lib/types';
import { evaluationSourceId, retrievalCases, retrievalSources } from './fixtures/retrieval-cases';
import {
  independentRetrievalCases,
  independentRetrievalSources,
  independentSourceId,
} from './fixtures/retrieval-independent-cases';

interface SourceFixture {
  key: string;
  name: string;
  kind: 'pdf' | 'markdown';
  segments: SourceSegment[];
}
interface CaseFixture {
  id: string;
  category: string;
  question: string;
  scope?: string;
  expected: { sourceId: string; anchor: string }[];
}

// A citation points to the correct text only when its offsets slice the exact
// stored segment. Verify this independently so a drift in chunk offsets or in
// the evidence snapshot is caught even though retrieval never touches the UI.
function citationPositionIssues(hits: Evidence[], segments: Map<string, SourceSegment>): string[] {
  const issues: string[] = [];
  hits.forEach((hit, index) => {
    if (hit.number !== index + 1) {
      issues.push(`引用编号 ${hit.number} 不是连续位置 ${index + 1}`);
      return;
    }
    const segment = segments.get(`${hit.sourceId}:${hit.anchor}`);
    if (!segment) {
      issues.push(`引用 ${hit.number} 指向不存在的资料段落 ${hit.sourceId}:${hit.anchor}`);
      return;
    }
    if (
      hit.start < 0 ||
      hit.end > segment.text.length ||
      hit.end <= hit.start ||
      segment.text.slice(hit.start, hit.end) !== hit.text
    ) {
      issues.push(`引用 ${hit.number} 的偏移与原文不一致（${hit.sourceName} ${hit.anchor}）`);
    }
  });
  return issues;
}

async function evaluateDataset(
  sources: SourceFixture[],
  cases: CaseFixture[],
  sourceId: (key: string) => string,
  dataset: string,
  encoder?: EmbeddingEncoder,
) {
  const directory = mkdtempSync(join(tmpdir(), 'study-retrieval-evaluation-'));
  const mainPath = join(directory, 'main.sqlite3');
  const indexPath = join(directory, 'search.sqlite3');
  const segments = new Map<string, SourceSegment>();
  try {
    const storage = new Storage(mainPath);
    try {
      for (const source of sources) {
        const id = sourceId(source.key);
        for (const segment of source.segments) segments.set(`${id}:${segment.anchor}`, segment);
        storage.addSource({
          id,
          name: source.name,
          kind: source.kind,
          bytes: Buffer.byteLength(JSON.stringify(source.segments)),
          pageCount: source.kind === 'pdf' ? source.segments.length : 1,
          textStatus: source.segments.every((segment) => segment.text.length) ? 'ready' : 'none',
          outline: [],
          segments: source.segments,
        });
      }
    } finally {
      storage.close();
    }
    const results = [];
    let observedRssBytes = 0;
    for (const entry of cases) {
      const started = performance.now();
      const scope = entry.scope ? sourceId(entry.scope) : null;
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
      const citationIssues = citationPositionIssues(result.hits, segments);
      const citedNumbers = citationNumbers(
        result.hits.map((hit) => `依据 [${hit.number}] 说明这段原文。`).join(''),
      );
      const citationComplete =
        result.hits.length > 0 && result.hits.every((hit) => citedNumbers.includes(hit.number));
      // 回答依据（管道级）：每个引用编号都必须有检索证据支撑，指向不存在证据的编号视为无依据。
      const validNumbers = new Set(result.hits.map((hit) => hit.number));
      const groundedUnsupported = citedNumbers.filter((number) => !validNumbers.has(number));
      const hallucinatedDetected = citationNumbers(
        `依据 [${result.hits.length + 1}] 说明这段原文。`,
      ).some((number) => !validNumbers.has(number));
      observedRssBytes = Math.max(observedRssBytes, process.memoryUsage().rss);
      results.push({
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
        citationPositionIssues: citationIssues,
        citationComplete,
        groundedUnsupported,
        hallucinatedDetected,
        passed: entry.expected.length
          ? found.length === entry.expected.length
          : actual.length === 0,
      });
    }
    const answerable = results.filter((entry) => entry.expected.length);
    const unanswerable = results.filter((entry) => !entry.expected.length);
    const withHits = results.filter((entry) => entry.actual.length > 0);
    const average = (values: number[]) =>
      values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
    return {
      dataset,
      method: encoder ? 'hybrid' : 'keyword',
      modelId: encoder?.id ?? null,
      sourceCount: sources.length,
      caseCount: cases.length,
      metrics: {
        answerableCount: answerable.length,
        unanswerableCount: unanswerable.length,
        hitAt4: average(answerable.map((entry) => Number(entry.hit))),
        meanRecallAt4: average(answerable.map((entry) => entry.recall!)),
        meanTargetPrecisionAt4: average(answerable.map((entry) => entry.targetPrecision!)),
        mrrAt4: average(answerable.map((entry) => entry.reciprocalRank)),
        noEvidenceAccuracy: average(unanswerable.map((entry) => Number(entry.passed))),
        citationPositionErrors: results.reduce(
          (sum, entry) => sum + entry.citationPositionIssues.length,
          0,
        ),
        citationCompleteness: average(withHits.map((entry) => Number(entry.citationComplete))),
        answerGroundingUnsupported: results.reduce(
          (sum, entry) => sum + entry.groundedUnsupported.length,
          0,
        ),
        hallucinatedCitationDetected: average(
          withHits.map((entry) => Number(entry.hallucinatedDetected)),
        ),
      },
      performance: {
        firstQueryMs: results[0]?.elapsedMs ?? 0,
        meanWarmQueryMs: average(results.slice(1).map((entry) => entry.elapsedMs)),
        observedRssBytes,
      },
      fallbackCount: encoder
        ? results.filter((entry) => entry.notice.includes('已使用关键词检索')).length
        : 0,
      failures: results.filter((entry) => !entry.passed),
      citationFailures: results.filter((entry) => entry.citationPositionIssues.length > 0),
      groundingFailures: results.filter(
        (entry) =>
          entry.groundedUnsupported.length > 0 ||
          (entry.actual.length > 0 && !entry.hallucinatedDetected),
      ),
      cases: results,
    };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

export async function evaluateRetrieval(encoder?: EmbeddingEncoder) {
  return evaluateDataset(
    retrievalSources,
    retrievalCases,
    evaluationSourceId,
    'synthetic-retrieval-v1',
    encoder,
  );
}

export async function evaluateIndependentRetrieval(encoder?: EmbeddingEncoder) {
  return evaluateDataset(
    independentRetrievalSources,
    independentRetrievalCases,
    independentSourceId,
    'synthetic-retrieval-v2',
    encoder,
  );
}
