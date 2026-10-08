import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, expect, it } from 'vitest';
import { Storage } from './storage';
import { copyIntoLegacy } from '../../tests/fixtures/legacy-databases';
import { retrieve, chunks } from './retrieval';
import { defaultSettings } from '../../src/lib/types';

const directories: string[] = [];
afterEach(() =>
  directories.splice(0).forEach((path) => rmSync(path, { recursive: true, force: true })),
);
function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'study-retrieval-'));
  directories.push(directory);
  const mainPath = join(directory, 'main.sqlite3');
  const indexPath = join(directory, 'search.sqlite3');
  const store = new Storage(mainPath);
  store.addSource({
    id: 'a'.repeat(64),
    name: 'SQLite 学习.md',
    kind: 'markdown',
    bytes: 100,
    pageCount: 1,
    textStatus: 'ready',
    outline: [],
    segments: [
      {
        anchor: 'md-line-1',
        title: '事务隔离',
        depth: 1,
        line: 1,
        text: '事务隔离可以避免脏读。SQLite 的事务使用 BEGIN 和 COMMIT。',
      },
      {
        anchor: 'md-line-8',
        title: '索引',
        depth: 2,
        line: 8,
        text: '数据库索引可以加快查找，但需要额外的存储空间。',
      },
    ],
  });
  store.addSource({
    id: 'b'.repeat(64),
    name: 'JavaScript.pdf',
    kind: 'pdf',
    bytes: 100,
    pageCount: 2,
    textStatus: 'ready',
    outline: [],
    segments: [
      {
        anchor: 'page-1',
        title: '第 1 页',
        depth: 1,
        page: 1,
        text: 'JavaScript promises represent asynchronous results.',
      },
      {
        anchor: 'page-2',
        title: '第 2 页',
        depth: 1,
        page: 2,
        text: 'A closure captures variables from its lexical scope. Closures preserve access to outer variables.',
      },
    ],
  });
  store.close();
  return { mainPath, indexPath, directory };
}
it('retrieves Chinese and English evidence with exact page/heading anchors and stable excerpts', () => {
  const { mainPath, indexPath } = fixture();
  const chinese = retrieve(mainPath, indexPath, '什么是事务隔离？');
  expect(chinese.hits[0]).toMatchObject({ sourceId: 'a'.repeat(64), anchor: 'md-line-1', line: 1 });
  expect(chinese.hits[0].text).toContain('脏读');
  const english = retrieve(mainPath, indexPath, 'Explain a closure');
  expect(english.hits[0]).toMatchObject({ sourceId: 'b'.repeat(64), anchor: 'page-2', page: 2 });
  expect(english.hits[0].text).toContain('lexical scope');
});
it('enforces the selected source scope and returns no evidence for unsupported topics', () => {
  const { mainPath, indexPath } = fixture();
  expect(retrieve(mainPath, indexPath, 'closure', 'a'.repeat(64)).hits).toEqual([]);
  expect(retrieve(mainPath, indexPath, '黑洞的霍金辐射是什么？').hits).toEqual([]);
  expect(retrieve(mainPath, indexPath, '什么是？').hits).toEqual([]);
  expect(() => retrieve(mainPath, indexPath, '" OR * - NEAR(closure)')).not.toThrow();
});
it('chunks long text without losing Unicode characters, offsets, or the end of a section', () => {
  const text = '事务🙂隔离。'.repeat(1000);
  const parts = [...chunks(text)];
  expect(parts.length).toBeGreaterThan(1);
  for (const part of parts) {
    expect(part.text).toBe(text.slice(part.start, part.end));
    expect(part.text.length).toBeLessThanOrEqual(800);
    expect(part.text).not.toMatch(/^[\uDC00-\uDFFF]|[\uD800-\uDBFF]$/);
  }
  expect(parts.at(-1)?.end).toBe(text.length);
});
it('indexes newly imported sources and preserves the old index when a rebuild fails', () => {
  const { mainPath, indexPath } = fixture();
  retrieve(mainPath, indexPath, 'closure');
  const store = new Storage(mainPath);
  store.addSource({
    id: 'c'.repeat(64),
    name: '网络.md',
    kind: 'markdown',
    bytes: 50,
    pageCount: 1,
    textStatus: 'ready',
    outline: [],
    segments: [
      {
        anchor: 'md-line-1',
        title: '路由',
        depth: 1,
        line: 1,
        text: '路由器使用路由表选择下一跳。',
      },
    ],
  });
  store.close();
  expect(retrieve(mainPath, indexPath, '路由器').hits[0]?.sourceId).toBe('c'.repeat(64));
  expect(() =>
    retrieve(mainPath, indexPath, '', null, true, () => {
      throw new Error('cancel');
    }),
  ).toThrow('cancel');
  expect(retrieve(mainPath, indexPath, 'closure').hits[0]?.page).toBe(2);
});
it('upgrades v3 with a recoverable backup, preserving existing conversations and reading evidence', () => {
  const { mainPath, directory } = fixture();
  let store = new Storage(mainPath);
  store.saveSettings({ ...defaultSettings, displayName: '保留我' });
  const conversation = store.chat.create();
  store.chat.addTurn({
    id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    conversationId: conversation.id,
    question: '旧问题',
    answer: '旧回答',
    status: 'completed',
    notice: '',
    provider: 'ollama',
    baseUrl: 'http://127.0.0.1:11434',
    model: 'test',
    createdAt: new Date().toISOString(),
    revision: 2,
    mode: 'chat',
    evidence: [],
  });
  store.close();
  const legacyPath = mainPath + '.v3';
  copyIntoLegacy(mainPath, legacyPath, 3);
  store = new Storage(legacyPath);
  expect(store.schemaVersion).toBe(12);
  expect(store.loadSettings().displayName).toBe('保留我');
  expect(store.chat.get(conversation.id).turns).toEqual([
    expect.objectContaining({
      question: '旧问题',
      answer: '旧回答',
      status: 'completed',
      revision: 2,
      mode: 'chat',
      evidence: [],
    }),
  ]);
  expect(store.getSegment('a'.repeat(64), 'md-line-1')?.text).toContain('事务隔离');
  store.close();
  const backupName = readdirSync(directory).find((name) => name.includes('before-v4'))!;
  const backup = new DatabaseSync(join(directory, backupName), { readOnly: true });
  expect(backup.prepare('PRAGMA user_version').get()?.user_version).toBe(3);
  backup.close();
});
it('rolls back index schema creation if initialization fails halfway', () => {
  const { mainPath, indexPath } = fixture();
  let index = new DatabaseSync(indexPath);
  index.exec('CREATE VIEW chunks_fts AS SELECT 1 AS terms');
  index.close();
  expect(() => retrieve(mainPath, indexPath, '事务')).toThrow();
  index = new DatabaseSync(indexPath);
  try {
    expect(
      index.prepare("SELECT name FROM sqlite_master WHERE name = 'indexed_sources'").get(),
    ).toBeUndefined();
    expect(index.prepare('PRAGMA user_version').get()?.user_version).toBe(0);
  } finally {
    index.close();
  }
});
