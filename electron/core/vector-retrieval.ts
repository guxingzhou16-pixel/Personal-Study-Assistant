import { DatabaseSync } from 'node:sqlite';
import type { Evidence, EvidencePreview, RetrievalProgress } from '../../src/lib/types';
import type { EmbeddingEncoder } from './embeddings';
import { AppError } from './errors';
import { chunks, retrieve } from './retrieval';
import { openVectorIndex } from './vector-index';
import { vectorPolicy } from './embedding-model';

function normalized(vector: Float32Array, dimensions: number): Float32Array {
  if (vector.length !== dimensions || !vector.every(Number.isFinite))
    throw new AppError('embeddingVectors', '嵌入结果的维数或数值无效。');
  const norm = Math.hypot(...vector);
  if (!norm) throw new AppError('embeddingVectors', '嵌入结果为空向量。');
  return vector.map((value) => value / norm);
}
async function encode(encoder: EmbeddingEncoder, texts: string[], kind: 'query' | 'passage') {
  try {
    return await encoder.embed(texts, kind);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('embeddingInference', '本地嵌入推理失败，请重试或重新下载检索模型。');
  }
}
interface PendingChunk {
  sourceId: string;
  anchor: string;
  start: number;
  end: number;
  input: string;
}
async function indexVectors(
  main: DatabaseSync,
  index: DatabaseSync,
  encoder: EmbeddingEncoder,
  scope: string | null,
  progress: (value: RetrievalProgress) => void,
) {
  const sources = main
    .prepare(`SELECT id, name FROM sources ${scope ? 'WHERE id = ?' : ''} ORDER BY id`)
    .all(...(scope ? [scope] : []));
  const ready = index.prepare(
    'SELECT 1 FROM embedded_sources WHERE model_id = ? AND source_id = ?',
  );
  const exists = index.prepare(
    'SELECT 1 FROM chunk_vectors WHERE model_id = ? AND source_id = ? AND anchor = ? AND start = ? AND end = ?',
  );
  const insert = index.prepare('INSERT INTO chunk_vectors VALUES (?, ?, ?, ?, ?, ?)');
  let pending: PendingChunk[] = [];
  async function flush() {
    if (!pending.length) return;
    const vectors = await encode(
      encoder,
      pending.map((part) => part.input),
      'passage',
    );
    if (vectors.length !== pending.length)
      throw new AppError('embeddingVectors', '嵌入结果数量不符。');
    const checked = vectors.map((vector) => normalized(vector, encoder.dimensions));
    index.exec('BEGIN IMMEDIATE');
    try {
      for (const [position, part] of pending.entries())
        insert.run(
          encoder.id,
          part.sourceId,
          part.anchor,
          part.start,
          part.end,
          Buffer.from(checked[position].buffer),
        );
      index.exec('COMMIT');
    } catch (error) {
      index.exec('ROLLBACK');
      throw error;
    }
    pending = [];
  }
  for (const [position, source] of sources.entries()) {
    const id = String(source.id);
    if (!ready.get(encoder.id, id)) {
      const anchors = main
        .prepare('SELECT anchor FROM source_segments WHERE source_id = ? ORDER BY rowid')
        .all(id);
      let count = 0;
      for (const { anchor } of anchors) {
        const segment = main
          .prepare('SELECT title, text FROM source_segments WHERE source_id = ? AND anchor = ?')
          .get(id, String(anchor))!;
        for (const part of chunks(
          String(segment.text),
          vectorPolicy.windowCharacters,
          vectorPolicy.windowOverlap,
        )) {
          if (exists.get(encoder.id, id, anchor, part.start, part.end)) continue;
          pending.push({
            sourceId: id,
            anchor: String(anchor),
            start: part.start,
            end: part.end,
            input: `${String(segment.title).slice(0, vectorPolicy.titleCharacters)}\n${part.text}`,
          });
          if (pending.length === vectorPolicy.batchSize) {
            await flush();
            count += vectorPolicy.batchSize;
            progress({
              current: position,
              total: sources.length,
              message: `本地编码 ${source.name}：已处理 ${count} 个片段`,
            });
          }
        }
      }
      await flush();
      index.prepare('INSERT INTO embedded_sources VALUES (?, ?)').run(encoder.id, id);
    }
    progress({
      current: position + 1,
      total: sources.length,
      message: `准备向量索引：${position + 1} / ${sources.length}`,
    });
  }
}
async function vectorCandidates(
  main: DatabaseSync,
  index: DatabaseSync,
  encoder: EmbeddingEncoder,
  question: string,
  scope: string | null,
): Promise<Evidence[]> {
  if (!question.trim()) return [];
  // Long questions use all windows, then average normalized vectors. Nothing is
  // silently discarded at the model's 512-token boundary.
  const inputs = [
    ...chunks(question, vectorPolicy.windowCharacters, vectorPolicy.windowOverlap),
  ].map((part) => part.text);
  const vectors: Float32Array[] = [];
  for (let offset = 0; offset < inputs.length; offset += vectorPolicy.batchSize)
    vectors.push(
      ...(await encode(encoder, inputs.slice(offset, offset + vectorPolicy.batchSize), 'query')),
    );
  if (vectors.length !== inputs.length)
    throw new AppError('embeddingVectors', '问题嵌入结果数量不符。');
  const mean = new Float32Array(encoder.dimensions);
  for (const vector of vectors)
    normalized(vector, encoder.dimensions).forEach((value, i) => {
      mean[i] += value / vectors.length;
    });
  const query = normalized(mean, encoder.dimensions);
  const rows = index
    .prepare(
      `SELECT source_id, anchor, start, end, embedding FROM chunk_vectors
    WHERE model_id = ? ${scope ? 'AND source_id = ?' : ''} ORDER BY source_id, anchor, start`,
    )
    .iterate(...(scope ? [encoder.id, scope] : [encoder.id]));
  const ranked: { sourceId: string; anchor: string; start: number; end: number; score: number }[] =
    [];
  for (const row of rows) {
    const bytes = row.embedding as Uint8Array;
    if (bytes.byteLength !== encoder.dimensions * 4)
      throw new AppError('embeddingVectors', '向量缓存损坏，请重建检索索引。');
    const vector = normalized(new Float32Array(Uint8Array.from(bytes).buffer), encoder.dimensions);
    let score = 0;
    for (let i = 0; i < query.length; i++) score += query[i] * vector[i];
    if (score < vectorPolicy.minimumSimilarity) continue;
    ranked.push({
      sourceId: String(row.source_id),
      anchor: String(row.anchor),
      start: Number(row.start),
      end: Number(row.end),
      score,
    });
    ranked.sort((a, b) => b.score - a.score);
    if (ranked.length > vectorPolicy.candidateLimit) ranked.pop();
  }
  return ranked.map((entry) => {
    const source = main.prepare('SELECT name, kind FROM sources WHERE id = ?').get(entry.sourceId);
    const segment = main
      .prepare('SELECT * FROM source_segments WHERE source_id = ? AND anchor = ?')
      .get(entry.sourceId, entry.anchor);
    if (!source || !segment)
      throw new AppError('embeddingVectors', '向量缓存中的资料不存在，请重建检索索引。');
    const text = String(segment.text).slice(entry.start, entry.end);
    return {
      number: 0,
      sourceId: entry.sourceId,
      sourceName: String(source.name),
      kind: source.kind as Evidence['kind'],
      anchor: entry.anchor,
      title: String(segment.title),
      start: entry.start,
      end: entry.end,
      text,
      ...(segment.page === null ? {} : { page: Number(segment.page) }),
      ...(segment.line === null ? {} : { line: Number(segment.line) }),
    };
  });
}
function overlaps(left: Evidence, right: Evidence): boolean {
  if (left.sourceId !== right.sourceId || left.anchor !== right.anchor) return false;
  return (
    Math.min(left.end, right.end) - Math.max(left.start, right.start) >=
    Math.min(left.end - left.start, right.end - right.start) / 2
  );
}
function fuse(keyword: Evidence[], vector: Evidence[]): Evidence[] {
  const candidates: { evidence: Evidence; keyword: number; vector: number }[] = keyword.map(
    (evidence, position) => ({
      evidence,
      keyword: 1 / (vectorPolicy.reciprocalRankConstant + position + 1),
      vector: 0,
    }),
  );
  for (const [position, evidence] of vector.entries()) {
    const duplicate = candidates.find((entry) => overlaps(entry.evidence, evidence));
    const score = 1 / (vectorPolicy.reciprocalRankConstant + position + 1);
    if (duplicate) duplicate.vector ||= score;
    else candidates.push({ evidence, keyword: 0, vector: score });
  }
  candidates.sort((a, b) => b.keyword + b.vector - (a.keyword + a.vector));
  const hits: Evidence[] = [];
  for (const { evidence } of candidates) {
    if (hits.some((hit) => overlaps(hit, evidence))) continue;
    hits.push({ ...evidence, number: hits.length + 1 });
    if (hits.length === vectorPolicy.maximumHits) break;
  }
  return hits;
}
export async function retrieveHybrid(
  mainPath: string,
  indexPath: string,
  question: string,
  scope: string | null,
  rebuild: boolean,
  progress: (value: RetrievalProgress) => void,
  encoder: EmbeddingEncoder,
): Promise<Omit<EvidencePreview, 'id'>> {
  const keyword = retrieve(mainPath, indexPath, question, scope, rebuild, progress);
  const main = new DatabaseSync(mainPath, { readOnly: true });
  let index: DatabaseSync | undefined;
  try {
    index = openVectorIndex(indexPath);
    await indexVectors(main, index, encoder, scope, progress);
    const vector = await vectorCandidates(main, index, encoder, question, scope);
    return {
      ...keyword,
      hits: fuse(keyword.hits, vector),
      notice: `本地语义与关键词混合检索。${keyword.notice} 相似度仅用于排序，不代表已验证证据充分。`,
    };
  } catch (error) {
    // Database and I/O failures must remain errors; only embedding failures can
    // produce a clearly labelled, usable keyword result.
    if (!(error instanceof AppError) || !error.code.startsWith('embedding')) throw error;
    return {
      ...keyword,
      notice: `本地嵌入未完成，已使用关键词检索。${error.message} ${keyword.notice}`,
    };
  } finally {
    index?.close();
    main.close();
  }
}
