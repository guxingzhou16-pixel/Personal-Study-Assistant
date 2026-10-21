import { DatabaseSync } from 'node:sqlite';
import type { Evidence, EvidencePreview, RetrievalProgress } from '../../src/lib/types';
import { AppError } from './errors';
import { sourceId as validateSourceId } from './documents';

const segmenter = new Intl.Segmenter('zh', { granularity: 'word' });
const stopWords = new Set(
  '的 了 吗 呢 是 和 与 或 一个 一下 这个 这些 什么 怎么 为什么 如何 请 解释 介绍 根据 资料 说明 区别 有什么 有哪些 用 帮 我 给 个 举例 例子 请用 帮我 a an the is are of to how what explain please in and or demo review example examples summarize summary illustrate walkthrough show step by eli5'.split(
    ' ',
  ),
);
function words(text: string, query = false): string[] {
  return [
    ...new Set(
      Array.from(segmenter.segment(text.normalize('NFKC').toLowerCase()))
        .filter((item) => item.isWordLike)
        .map((item) => item.segment)
        .filter((word) => !query || !stopWords.has(word)),
    ),
  ];
}
export function namedQueryTerms(question: string, context = ''): string[] {
  const technical = (word: string) => /^[A-Z][A-Z0-9_]+$|[a-z][A-Z]|[A-Za-z]\d|_/.test(word);
  const observed = new Set(
    (context.match(/[A-Za-z][A-Za-z0-9_]*/g) ?? [])
      .filter(technical)
      .map((word) => word.toLowerCase()),
  );
  return (question.normalize('NFKC').match(/[A-Za-z][A-Za-z0-9_]*/g) ?? []).filter(
    (word) =>
      word.length > 1 &&
      !stopWords.has(word.toLowerCase()) &&
      (technical(word) || observed.has(word.toLowerCase())),
  );
}
export function matchesNamedQuery(
  question: string,
  text: string,
  identifiers = namedQueryTerms(question),
): boolean {
  if (!identifiers.length) return true;
  const present = new Set(
    text
      .normalize('NFKC')
      .toLowerCase()
      .match(/[a-z][a-z0-9_]*/g) ?? [],
  );
  return identifiers.some((word) => present.has(word.toLowerCase()));
}
function indexTerms(text: string): string {
  const result = words(text);
  // unicode61 does not split Han text into Chinese words. Add overlapping bigrams
  // alongside Intl words so word-boundary changes do not erase short concepts.
  for (const run of text.normalize('NFKC').match(/[\p{Script=Han}]{3,}/gu) ?? []) {
    const characters = [...run];
    for (let i = 0; i + 1 < characters.length; i++) result.push(characters[i] + characters[i + 1]);
  }
  return [...new Set(result)].join(' ');
}
function comparisonTerms(question: string): string[][] {
  if (!/比较|对比|分别|区别|不同/.test(question) && /什么|怎么|为什么|如何|[？?]/.test(question))
    return [];
  const match = question
    .normalize('NFKC')
    .match(/^(.+?)(?:和|与|及|\band\b)(.+?)(?=分别|在|有(?:什么|哪些)|的?(?:区别|不同)|[？?]|$)/i);
  if (!match) return [];
  const groups = match
    .slice(1)
    .map((part) => words(part.replace(/^(?:请)?(?:比较|对比)/, ''), true));
  return groups.every((group) => group.length > 0 && group.length <= 6) ? groups : [];
}
export function* chunks(
  text: string,
  size = 800,
  overlap = 120,
): Generator<{ start: number; end: number; text: string }> {
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + size, text.length);
    if (end < text.length && /[\uD800-\uDBFF]/.test(text[end - 1])) end--;
    const excerpt = text.slice(start, end);
    if (excerpt.trim()) yield { start, end, text: excerpt };
    if (end === text.length) break;
    start = end - overlap;
    if (/[\uDC00-\uDFFF]/.test(text[start])) start++;
  }
}
const INDEX_SCHEMA = `
  CREATE TABLE indexed_sources(id TEXT PRIMARY KEY, name TEXT NOT NULL, kind TEXT NOT NULL);
  CREATE VIRTUAL TABLE chunks_fts USING fts5(
    source_id UNINDEXED, anchor UNINDEXED, title UNINDEXED, page UNINDEXED, line UNINDEXED,
    start UNINDEXED, end UNINDEXED, excerpt UNINDEXED, terms, tokenize = 'unicode61'
  );
  PRAGMA user_version = 1;
`;
export function retrieve(
  mainPath: string,
  indexPath: string,
  question: string,
  sourceId: string | null = null,
  rebuild = false,
  progress: (value: RetrievalProgress) => void = () => {},
): Omit<EvidencePreview, 'id'> {
  if (sourceId !== null) validateSourceId(sourceId);
  const main = new DatabaseSync(mainPath, { readOnly: true });
  let index: DatabaseSync | undefined;
  try {
    main.exec('PRAGMA busy_timeout = 5000');
    index = new DatabaseSync(indexPath);
    index.exec('PRAGMA busy_timeout = 5000');
    const version = Number(index.prepare('PRAGMA user_version').get()?.user_version);
    if (version > 2) throw new AppError('indexVersion', '检索索引来自更新的版本，请升级应用。');
    if (!version) {
      index.exec('BEGIN IMMEDIATE');
      try {
        index.exec(INDEX_SCHEMA);
        index.exec('COMMIT');
      } catch (error) {
        index.exec('ROLLBACK');
        throw error;
      }
    }
    const sources = main
      .prepare('SELECT id, name, kind, text_status FROM sources ORDER BY id')
      .all();
    if (sourceId && !sources.some((source) => source.id === sourceId))
      throw new AppError('sourceMissing', '选中的资料不存在，请刷新资料列表。');
    index.exec('BEGIN IMMEDIATE');
    try {
      if (rebuild) {
        index.exec('DELETE FROM chunks_fts; DELETE FROM indexed_sources;');
        if (version === 2) index.exec('DELETE FROM chunk_vectors; DELETE FROM embedded_sources;');
      }
      const indexed = new Set(
        index
          .prepare('SELECT id FROM indexed_sources')
          .all()
          .map((row) => String(row.id)),
      );
      const insert = index.prepare('INSERT INTO chunks_fts VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
      let current = 0;
      for (const source of sources) {
        if (!indexed.has(String(source.id))) {
          const anchors = main
            .prepare('SELECT anchor FROM source_segments WHERE source_id = ? ORDER BY rowid')
            .all(String(source.id));
          for (const { anchor } of anchors) {
            // Finish each read before CPU work: long main-db cursors would delay
            // chat checkpoints and learning records by holding a read lock.
            const segment = main
              .prepare('SELECT * FROM source_segments WHERE source_id = ? AND anchor = ?')
              .get(String(source.id), String(anchor))!;
            for (const part of chunks(String(segment.text)))
              insert.run(
                source.id,
                anchor,
                segment.title,
                segment.page,
                segment.line,
                part.start,
                part.end,
                part.text,
                indexTerms(`${segment.title}\n${part.text}`),
              );
          }
          index
            .prepare('INSERT INTO indexed_sources VALUES (?, ?, ?)')
            .run(source.id, source.name, source.kind);
        }
        current++;
        progress({
          current,
          total: sources.length,
          message: `准备资料索引：${current} / ${sources.length}`,
        });
      }
      index.exec('COMMIT');
    } catch (error) {
      index.exec('ROLLBACK');
      throw error;
    }
    const terms = words(question, true).slice(0, 24);
    const explanatory = /为什么|为何|原因|怎么会/.test(question);
    const topic = terms.find((term) => term.length > 1);
    const groups = comparisonTerms(question);
    const distinctTerms = groups.map((group, index) =>
      group.filter((term) => groups.every((other, i) => i === index || !other.includes(term))),
    );
    // A shared word alone must not stand in for a different comparison subject.
    const matchesGroup = (text: string, index: number) =>
      groups[index].filter((term) => text.includes(term)).length / groups[index].length >= 0.5 &&
      (distinctTerms[index].length === 0 ||
        distinctTerms[index].some((term) => text.includes(term)));
    const candidates: {
      evidence: Evidence;
      coverage: number;
      fullCoverage: number;
      rank: number;
      groups: number[];
      titleGroups: number[];
    }[] = [];
    if (terms.length) {
      const expression = terms.map((term) => `"${term.replaceAll('"', '""')}"`).join(' OR ');
      const rows = index
        .prepare(
          `SELECT chunks_fts.*, indexed_sources.name, indexed_sources.kind,
        bm25(chunks_fts) AS score FROM chunks_fts
        JOIN indexed_sources ON indexed_sources.id = chunks_fts.source_id
        WHERE chunks_fts MATCH ? ${sourceId ? 'AND source_id = ?' : ''}
        ORDER BY score, chunks_fts.rowid LIMIT 40`,
        )
        .all(...(sourceId ? [expression, sourceId] : [expression]));
      const identifiers = namedQueryTerms(
        question,
        rows.map((row) => `${row.name}\n${row.title}\n${row.excerpt}`).join('\n'),
      );
      for (const row of rows) {
        const text = String(row.excerpt);
        const normalized = `${row.title}\n${text}`.normalize('NFKC').toLowerCase();
        const normalizedTitle = String(row.title).normalize('NFKC').toLowerCase();
        if (!matchesNamedQuery(question, `${row.name}\n${normalized}`, identifiers)) continue;
        const matchedGroups = groups.flatMap((_, index) =>
          matchesGroup(normalized, index) ? [index] : [],
        );
        // Comparison evidence must name a subject, not just a shared word or question filler.
        if (groups.length > 0 && matchedGroups.length === 0) continue;
        const fullCoverage =
          terms.filter((term) => normalized.includes(term)).length / terms.length;
        const coverage = Math.max(
          fullCoverage,
          ...matchedGroups.map(
            (index) =>
              groups[index].filter((term) => normalized.includes(term)).length /
              groups[index].length,
          ),
        );
        if (
          coverage < 0.5 &&
          !(explanatory && row.page !== null && topic && normalized.includes(topic))
        )
          continue;
        candidates.push({
          coverage,
          fullCoverage,
          groups: matchedGroups,
          titleGroups: matchedGroups.filter((index) => matchesGroup(normalizedTitle, index)),
          rank: Number(row.score),
          evidence: {
            number: 0,
            sourceId: String(row.source_id),
            sourceName: String(row.name),
            kind: row.kind as Evidence['kind'],
            anchor: String(row.anchor),
            title: String(row.title),
            start: Number(row.start),
            end: Number(row.end),
            text,
            ...(row.page === null ? {} : { page: Number(row.page) }),
            ...(row.line === null ? {} : { line: Number(row.line) }),
          },
        });
      }
    }
    candidates.sort((left, right) => right.coverage - left.coverage || left.rank - right.rank);
    // Reserve one best candidate per comparison subject before filling the remaining slots.
    const reserved = groups.flatMap((_, index) => {
      const candidate =
        candidates.find((entry) => entry.titleGroups.includes(index)) ??
        candidates.find((entry) => entry.groups.includes(index));
      return candidate ? [candidate] : [];
    });
    const hits: Evidence[] = [];
    const coveredGroups = new Set<number>();
    const relevant = candidates.filter((entry) => entry.fullCoverage >= 0.5);
    const first = relevant[0]?.evidence;
    // A why-question may need the definition on a neighboring PDF page. Admit
    // at most one companion from the same source, sharing the primary concept.
    const companion =
      !groups.length &&
      explanatory &&
      topic &&
      first?.page &&
      first.text.normalize('NFKC').toLowerCase().includes(topic)
        ? candidates.find(
            ({ evidence, fullCoverage }) =>
              fullCoverage < 0.5 &&
              evidence.sourceId === first.sourceId &&
              evidence.page &&
              Math.abs(evidence.page - first.page!) === 1 &&
              evidence.text.normalize('NFKC').toLowerCase().includes(topic),
          )
        : undefined;
    for (const candidate of [
      ...reserved,
      ...relevant.slice(0, 1),
      ...(companion ? [companion] : []),
      ...relevant.slice(1),
    ]) {
      const { evidence } = candidate;
      if (
        hits.some(
          (hit) =>
            hit.sourceId === evidence.sourceId &&
            hit.anchor === evidence.anchor &&
            Math.abs(hit.start - evidence.start) < 800,
        ) &&
        !candidate.groups.some((group) => !coveredGroups.has(group))
      )
        continue;
      hits.push({ ...evidence, number: hits.length + 1 });
      candidate.groups.forEach((group) => coveredGroups.add(group));
      if (hits.length === 4) break;
    }
    const scanCount = sources.filter(
      (source) => (sourceId === null || source.id === sourceId) && source.text_status !== 'ready',
    ).length;
    return {
      question,
      sourceId,
      sourceCount: sourceId ? 1 : sources.length,
      hits,
      notice: [
        !terms.length ? '请在问题中写出具体概念或关键词。' : '',
        scanCount
          ? `范围内有 ${scanCount} 份资料文字不完整或无法提取；这些页不能参与完整检索。`
          : '',
        '关键词检索可能遗漏同义表达；检索到的片段不代表已验证回答正确。',
      ]
        .filter(Boolean)
        .join(' '),
    };
  } finally {
    index?.close();
    main.close();
  }
}
