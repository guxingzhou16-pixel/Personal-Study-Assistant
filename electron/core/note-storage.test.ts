import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, expect, it, vi } from 'vitest';
import { emptyNoteDraft, noteDraft, noteLimits } from '../../src/lib/notes';
import {
  createLegacyNotesDatabase,
  legacyConversationId,
  legacyEvidence,
  legacySourceId,
} from '../../tests/fixtures/notes-legacy';
import { Storage } from './storage';

const directories: string[] = [];
const stores: Storage[] = [];
function pathFixture() {
  const directory = mkdtempSync(join(tmpdir(), 'study-notes-'));
  directories.push(directory);
  return { directory, path: join(directory, 'main.sqlite3') };
}
function open(path: string) {
  const store = new Storage(path);
  stores.push(store);
  return store;
}
function close(store: Storage) {
  store.close();
  stores.splice(stores.indexOf(store), 1);
}
function request(sourceId: string | null = null) {
  return {
    ...emptyNoteDraft(sourceId),
    id: null,
    revision: 0,
    title: '事务笔记',
    understanding: '中文🙂\n```ts\ncommit();\n```',
    evidence: '原文依据 [1]',
    questions: '失败怎么办？',
    nextStep: '练习回滚',
  };
}
afterEach(() => {
  vi.restoreAllMocks();
  stores.splice(0).forEach((store) => store.close());
  directories.splice(0).forEach((directory) => rmSync(directory, { recursive: true, force: true }));
});

it.each([1, 2, 3, 4])(
  'upgrades v%i, preserving legacy rows and a readable pre-migration backup',
  (version) => {
    const { directory, path } = pathFixture();
    createLegacyNotesDatabase(path, version);
    const before = new DatabaseSync(path, { readOnly: true });
    const tables = [
      'app_settings',
      ...(version >= 2 ? ['sources', 'source_segments'] : []),
      ...(version >= 3 ? ['conversations', 'chat_turns'] : []),
    ];
    const rows = tables.map((table) => before.prepare(`SELECT * FROM ${table}`).all());
    before.close();
    const store = open(path);
    expect(store.schemaVersion).toBe(5);
    expect(store.loadSettings()).toMatchObject({ displayName: '迁移验收', dailyGoalMinutes: 65 });
    expect(store.notes.list()).toEqual([]);
    if (version >= 2)
      expect(store.getSource(legacySourceId)?.position).toMatchObject({
        offset: 18,
        tone: 'warm',
        zoom: 1.25,
      });
    if (version >= 3)
      expect(store.chat.get(legacyConversationId).turns[0]).toMatchObject({
        answer: '全部提交或者回滚。[1]',
        revision: 3,
        status: 'completed',
        mode: version === 4 ? 'sources' : 'chat',
        evidence: version === 4 ? legacyEvidence : [],
      });
    const backups = readdirSync(directory).filter((name) => name.includes('before-v'));
    expect(backups).toHaveLength(1);
    expect(backups[0]).toContain(`before-v${version + 1}-`);
    const backup = new DatabaseSync(join(directory, backups[0]), { readOnly: true });
    const migrated = new DatabaseSync(path, { readOnly: true });
    try {
      expect(backup.prepare('PRAGMA user_version').get()?.user_version).toBe(version);
      expect(
        backup.prepare("SELECT name FROM sqlite_master WHERE name = 'notes'").get(),
      ).toBeUndefined();
      tables.forEach((table, index) => {
        expect(backup.prepare(`SELECT * FROM ${table}`).all()).toEqual(rows[index]);
        const columns = Object.keys(rows[index][0]).join(', ');
        expect(migrated.prepare(`SELECT ${columns} FROM ${table}`).all()).toEqual(rows[index]);
      });
      expect(migrated.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
    } finally {
      backup.close();
      migrated.close();
    }
    const saved = store.notes.save(request(version >= 2 ? legacySourceId : null));
    close(store);
    const reopened = open(path);
    expect(reopened.notes.get(saved.id)).toEqual(saved);
    expect(readdirSync(directory).filter((name) => name.includes('before-v'))).toEqual(backups);
  },
);

it('rolls back the whole migration when v5 DDL fails after earlier migration steps', () => {
  const { directory, path } = pathFixture();
  createLegacyNotesDatabase(path, 3);
  const db = new DatabaseSync(path);
  db.exec('CREATE INDEX notes_updated_at ON sources(imported_at);');
  db.close();
  expect(() => new Storage(path)).toThrow('already exists');
  const unchanged = new DatabaseSync(path, { readOnly: true });
  try {
    expect(unchanged.prepare('PRAGMA user_version').get()?.user_version).toBe(3);
    expect(
      unchanged
        .prepare('PRAGMA table_info(chat_turns)')
        .all()
        .map((row) => row.name),
    ).not.toContain('mode');
    expect(
      unchanged.prepare("SELECT name FROM sqlite_master WHERE name = 'notes'").get(),
    ).toBeUndefined();
    expect(unchanged.prepare('SELECT answer FROM chat_turns').get()?.answer).toBe(
      '全部提交或者回滚。[1]',
    );
    expect(readdirSync(directory).filter((name) => name.includes('before-v4-'))).toHaveLength(1);
  } finally {
    unchanged.close();
  }
});

it('does not migrate if the mandatory backup fails, and rejects v6 without writes', () => {
  const { path } = pathFixture();
  createLegacyNotesDatabase(path);
  const prepare = DatabaseSync.prototype.prepare;
  const spy = vi.spyOn(DatabaseSync.prototype, 'prepare').mockImplementation(function (
    this: DatabaseSync,
    sql: string,
  ) {
    if (sql === 'VACUUM INTO ?') throw new Error('simulated backup failure');
    return prepare.call(this, sql);
  });
  expect(() => new Storage(path)).toThrow('backup failure');
  spy.mockRestore();
  const db = new DatabaseSync(path);
  try {
    expect(db.prepare('PRAGMA user_version').get()?.user_version).toBe(4);
    expect(db.prepare("SELECT name FROM sqlite_master WHERE name = 'notes'").get()).toBeUndefined();
    db.exec('PRAGMA user_version = 6;');
    expect(() => new Storage(path)).toThrow('更新');
    expect(db.prepare('PRAGMA user_version').get()?.user_version).toBe(6);
    expect(db.prepare('SELECT answer FROM chat_turns').get()?.answer).toBe('全部提交或者回滚。[1]');
  } finally {
    db.close();
  }
});

it('saves all sections, detaches sources, rejects stale writes/deletes, and restores the final snapshot', () => {
  const { path } = pathFixture();
  createLegacyNotesDatabase(path);
  const store = open(path);
  const first = store.notes.save(request(legacySourceId));
  const second = store.notes.save({
    ...noteDraft(first),
    id: first.id,
    revision: first.revision,
    title: '更新笔记',
    sourceId: null,
  });
  expect(second).toMatchObject({ revision: 2, createdAt: first.createdAt, sourceId: null });
  expect(() => store.notes.save({ ...request(), id: first.id, revision: 1 })).toThrow('新版本');
  expect(() => store.notes.delete(first.id, 1)).toThrow('未执行删除');
  expect(store.notes.get(first.id)).toEqual(second);
  const copy = store.notes.save({ ...request(legacySourceId), title: '关联笔记' });
  expect(store.notes.list().find((note) => note.id === copy.id)?.sourceName).toBe('事务学习.md');
  close(store);
  const reopened = open(path);
  expect(reopened.notes.get(first.id)).toEqual(second);
  expect(reopened.notes.get(copy.id)).toEqual(copy);
  reopened.notes.delete(first.id, second.revision);
  expect(() => reopened.notes.get(first.id)).toThrow('找不到');
  expect(reopened.notes.list().map((note) => note.id)).toEqual([copy.id]);
  expect(reopened.getSegment(legacySourceId, 'md-line-1')?.text).toBe(legacyEvidence[0].text);
});

it('rejects malformed IPC drafts without modifying the saved note', () => {
  const { path } = pathFixture();
  const store = open(path);
  const saved = store.notes.save(request());
  const invalid = [
    null,
    [],
    { ...request(), title: ' ' },
    { ...request(), title: 'a\nb' },
    { ...request(), title: 'a'.repeat(noteLimits.title + 1) },
    { ...request(), understanding: 5 },
    { ...request(), evidence: 'a'.repeat(noteLimits.section + 1) },
    { ...request(), questions: '\0' },
    { ...request(), sourceId: 'c'.repeat(64) },
    { ...request(), sourceId: '../file' },
    { ...request(), id: saved.id, revision: 0 },
    { ...request(), revision: 1 },
    { ...request(), revision: 0.5 },
    { ...request(), id: '../file', revision: 1 },
    { ...request(), apiKey: 'fake-marker' },
  ];
  for (const input of invalid) expect(() => store.notes.save(input)).toThrow();
  expect(store.notes.get(saved.id)).toEqual(saved);
  expect(store.notes.list()).toHaveLength(1);
  expect(() => store.notes.delete(saved.id, Number.MAX_SAFE_INTEGER)).toThrow('版本无效');
});

it('enforces the note count while allowing edits at the limit, and reports corrupted content', () => {
  const { path } = pathFixture();
  const store = open(path);
  const saved = store.notes.save(request());
  const db = new DatabaseSync(path);
  try {
    const insert = db.prepare(
      'INSERT INTO notes SELECT ?, source_id, title, understanding, evidence, questions, next_step, revision, created_at, updated_at FROM notes WHERE id = ?',
    );
    db.exec('BEGIN');
    for (let i = 1; i < noteLimits.count; i++)
      insert.run(`00000000-0000-0000-0000-${String(i).padStart(12, '0')}`, saved.id);
    db.exec('COMMIT');
    expect(() => store.notes.save(request())).toThrow('上限');
    expect(
      store.notes.save({
        ...noteDraft(saved),
        id: saved.id,
        revision: saved.revision,
        title: '仍可编辑',
      }).revision,
    ).toBe(2);
    db.prepare('UPDATE notes SET understanding = ? WHERE id = ?').run('\0', saved.id);
    expect(() => store.notes.get(saved.id)).toThrow('损坏');
    db.prepare('UPDATE notes SET title = ? WHERE id = ?').run('', saved.id);
    expect(() => store.notes.list()).toThrow('损坏');
  } finally {
    db.close();
  }
});
