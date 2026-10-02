import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, expect, it, vi } from 'vitest';
import { Storage } from './storage';
import { retrieve } from './retrieval';
import { retrieveHybrid } from './vector-retrieval';
import type { EmbeddingEncoder } from './embeddings';

const directories: string[] = [];
afterEach(() =>
  directories.splice(0).forEach((path) => rmSync(path, { recursive: true, force: true })),
);
function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'study-hybrid-'));
  directories.push(directory);
  const mainPath = join(directory, 'main.sqlite3');
  const indexPath = join(directory, 'index.sqlite3');
  const store = new Storage(mainPath);
  for (const [key, text] of [
    ['a', '数据库索引使查询更快。'],
    ['b', '番茄钟帮助安排休息。'],
  ])
    store.addSource({
      id: key.repeat(64),
      name: `${key}.md`,
      kind: 'markdown',
      bytes: 50,
      pageCount: 1,
      textStatus: 'ready',
      outline: [],
      segments: [{ anchor: 'md-line-1', title: '概念', depth: 1, line: 1, text }],
    });
  store.close();
  const embed = vi.fn(async (texts: string[]) =>
    texts.map((text) => {
      if (/查询|查找/.test(text)) return Float32Array.of(1, 0, 0);
      if (/番茄|休息/.test(text)) return Float32Array.of(0, 1, 0);
      return Float32Array.of(0, 0, 1);
    }),
  );
  const encoder: EmbeddingEncoder = {
    id: 'test-vector-v1',
    dimensions: 3,
    embed,
    dispose: async () => {},
  };
  return { mainPath, indexPath, encoder, embed };
}
it('retrieves a synonym with exact source offsets, preserves keyword ranking, and enforces scope', async () => {
  const { mainPath, indexPath, encoder } = fixture();
  expect(retrieve(mainPath, indexPath, '怎样让查找更迅速？').hits).toEqual([]);
  const result = await retrieveHybrid(
    mainPath,
    indexPath,
    '怎样让查找更迅速？',
    null,
    false,
    () => {},
    encoder,
  );
  expect(result.hits[0]).toMatchObject({
    sourceId: 'a'.repeat(64),
    start: 0,
    end: '数据库索引使查询更快。'.length,
    text: '数据库索引使查询更快。',
    line: 1,
  });
  expect(result.notice).toContain('混合检索');
  expect(
    (
      await retrieveHybrid(
        mainPath,
        indexPath,
        '怎样让查找更迅速？',
        'b'.repeat(64),
        false,
        () => {},
        encoder,
      )
    ).hits,
  ).toEqual([]);
  expect(
    (await retrieveHybrid(mainPath, indexPath, '黑洞是什么？', null, false, () => {}, encoder))
      .hits,
  ).toEqual([]);
  expect(retrieve(mainPath, indexPath, '数据库索引').hits[0].sourceId).toBe('a'.repeat(64));
});
it('reuses persisted vectors and never reuses embeddings belonging to a different model version', async () => {
  const { mainPath, indexPath, encoder, embed } = fixture();
  await retrieveHybrid(mainPath, indexPath, '查找', null, false, () => {}, encoder);
  embed.mockClear();
  await retrieveHybrid(mainPath, indexPath, '查找', null, false, () => {}, encoder);
  expect(embed.mock.calls.flatMap(([texts]) => texts)).toEqual(['查找']);
  embed.mockClear();
  await retrieveHybrid(mainPath, indexPath, '查找', null, false, () => {}, {
    ...encoder,
    id: 'test-vector-v2',
  });
  expect(embed.mock.calls.flatMap(([texts]) => texts)).toContain('概念\n数据库索引使查询更快。');
});
it('falls back visibly on model failure without losing keyword evidence or persisting malformed vectors', async () => {
  const { mainPath, indexPath, encoder } = fixture();
  for (const embed of [
    async () => {
      throw new Error('model unavailable');
    },
    async () => [Float32Array.of(NaN, 0, 0)],
  ]) {
    const result = await retrieveHybrid(mainPath, indexPath, '数据库索引', null, false, () => {}, {
      ...encoder,
      embed,
    });
    expect(result.hits[0].sourceId).toBe('a'.repeat(64));
    expect(result.notice).toContain('已使用关键词检索');
  }
  const index = new DatabaseSync(indexPath);
  try {
    expect(index.prepare('SELECT count(*) AS n FROM chunk_vectors').get()?.n).toBe(0);
  } finally {
    index.close();
  }
});
it('covers the end of long excerpts in bounded embedding windows, instead of silently truncating it', async () => {
  const { mainPath, indexPath, encoder, embed } = fixture();
  const store = new Storage(mainPath);
  const text = '普通内容。'.repeat(140) + '数据库索引使查询更快。';
  store.addSource({
    id: 'c'.repeat(64),
    name: 'long.md',
    kind: 'markdown',
    bytes: 2000,
    pageCount: 1,
    textStatus: 'ready',
    outline: [],
    segments: [{ anchor: 'md-line-1', title: '长章节', depth: 1, line: 1, text }],
  });
  store.close();
  const result = await retrieveHybrid(
    mainPath,
    indexPath,
    '查找',
    'c'.repeat(64),
    false,
    () => {},
    encoder,
  );
  expect(result.hits[0].text).toContain('数据库索引使查询更快。');
  const inputs = embed.mock.calls.flatMap(([texts]) => texts);
  expect(inputs.some((input) => input.endsWith('数据库索引使查询更快。'))).toBe(true);
  expect(inputs.every((input) => input.length <= 480)).toBe(true);
});

it('admits moderate semantic matches from a keyword-supported source without broadening unrelated sources', async () => {
  const { mainPath, indexPath, encoder } = fixture();
  const store = new Storage(mainPath);
  store.addSource({
    id: 'c'.repeat(64),
    name: '索引代价.md',
    kind: 'markdown',
    bytes: 100,
    pageCount: 1,
    textStatus: 'ready',
    outline: [],
    segments: [
      { anchor: 'md-line-1', title: '索引', depth: 1, line: 1, text: '数据库索引让查询更快。' },
      { anchor: 'md-line-8', title: '代价', depth: 1, line: 8, text: '额外的磁盘空间和写入开销。' },
    ],
  });
  store.close();
  const result = await retrieveHybrid(
    mainPath,
    indexPath,
    '数据库索引的代价',
    null,
    false,
    () => {},
    {
      ...encoder,
      embed: async (texts, kind) =>
        texts.map((text) =>
          kind === 'query' || text.includes('查询')
            ? Float32Array.of(1, 0, 0)
            : Float32Array.of(0.55, Math.sqrt(1 - 0.55 ** 2), 0),
        ),
    },
  );
  expect(result.hits).toContainEqual(
    expect.objectContaining({ sourceId: 'c'.repeat(64), anchor: 'md-line-8' }),
  );
  expect(result.hits.some((hit) => hit.sourceId === 'b'.repeat(64))).toBe(false);
});
