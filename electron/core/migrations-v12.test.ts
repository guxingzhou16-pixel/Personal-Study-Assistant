import { afterEach, expect, it, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Storage } from './storage';
import {
  createLegacyDatabase,
  fixtureIds,
  fixtureNote,
  snapshotDatabase,
} from '../../tests/fixtures/legacy-databases';

// Real SQLite migrations can exceed the default 5s budget on hosted Windows runners.
vi.setConfig({ testTimeout: 30_000 });
afterEach(() => vi.restoreAllMocks());
function path() {
  return join(mkdtempSync(join(tmpdir(), 'study-v12-migration-')), 'study-companion.sqlite3');
}
it.each(Array.from({ length: 11 }, (_, i) => i + 1))(
  'migrates authentic v%i to current v13 without changing old values or rowids, and keeps a readable original backup',
  (version) => {
    const location = path();
    createLegacyDatabase(location, version);
    const before = snapshotDatabase(location);
    const store = new Storage(location);
    try {
      expect(store.schemaVersion).toBe(13);
      expect(store.loadSettings()).toMatchObject({
        displayName: '独立迁移样本',
        dailyGoalMinutes: 65,
        theme: 'modern',
      });
      const after = snapshotDatabase(location);
      for (const [table, rows] of Object.entries(before)) {
        expect(after[table]).toHaveLength(rows.length);
        for (let i = 0; i < rows.length; i++) expect(after[table][i]).toMatchObject(rows[i]);
      }
      if (version >= 5) expect(store.notes.get(fixtureIds.note)).toEqual(fixtureNote);
      if (version >= 6) expect(store.chat.listNoteFeedback(fixtureIds.note)).toHaveLength(1);
      if (version >= 7) expect(store.chat.findLearningConversation()!.turns).toHaveLength(1);
      const db = new DatabaseSync(location, { readOnly: true });
      try {
        expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
        expect(
          db
            .prepare('SELECT practice_request FROM chat_turns WHERE practice_request IS NOT NULL')
            .all(),
        ).toEqual([]);
        if (version >= 3)
          expect(
            db
              .prepare('SELECT note_id, purpose FROM conversations WHERE id = ?')
              .get(fixtureIds.chat),
          ).toMatchObject({ note_id: null, purpose: 'chat' });
        if (version === 9)
          expect(
            db
              .prepare('SELECT origin, origin_turn_id, origin_turn_revision FROM daily_tasks')
              .get(),
          ).toEqual({ origin: 'manual', origin_turn_id: null, origin_turn_revision: null });
      } finally {
        db.close();
      }
    } finally {
      store.close();
    }
    const directory = join(location, '..');
    const backups = readdirSync(directory).filter((name) => name.includes('.before-v'));
    expect(backups).toHaveLength(1);
    expect(backups[0]).toContain(`before-v${version + 1}-`);
    const backupPath = join(directory, backups[0]);
    expect(snapshotDatabase(backupPath, false)).toEqual(snapshotDatabaseFromRows(before));
    const db = new DatabaseSync(backupPath, { readOnly: true });
    try {
      expect(db.prepare('PRAGMA user_version').get()?.user_version).toBe(version);
    } finally {
      db.close();
    }
    const again = new Storage(location);
    again.close();
    expect(readdirSync(directory).filter((name) => name.includes('.before-v'))).toEqual(backups);
  },
);
function snapshotDatabaseFromRows(input: ReturnType<typeof snapshotDatabase>) {
  return Object.fromEntries(
    Object.entries(input).map(([table, rows]) => [
      table,
      rows.map(({ original_rowid: _rowid, ...rest }) => rest),
    ]),
  );
}
it.each([5, 6, 7, 8, 9, 10, 11])(
  'rolls back the entire v%i upgrade when a later DDL fails',
  (version) => {
    const location = path();
    createLegacyDatabase(location, version);
    if (version < 11) {
      const db = new DatabaseSync(location);
      db.exec('CREATE INDEX focus_recent ON app_settings(id)');
      db.close();
    }
    const before = snapshotDatabase(location);
    const exec = DatabaseSync.prototype.exec;
    vi.spyOn(DatabaseSync.prototype, 'exec').mockImplementation(function (this: DatabaseSync, sql) {
      if (version === 11 && String(sql).includes('practice_request'))
        throw new Error('injected migration failure');
      return exec.call(this, sql);
    });
    expect(() => new Storage(location)).toThrow();
    expect(snapshotDatabase(location)).toEqual(before);
    const old = new DatabaseSync(location, { readOnly: true });
    try {
      expect(old.prepare('PRAGMA user_version').get()?.user_version).toBe(version);
    } finally {
      old.close();
    }
  },
);
it('refuses backup failure before any migration and rejects future v14 without changing saved data', () => {
  const location = path();
  createLegacyDatabase(location, 11);
  const before = snapshotDatabase(location);
  const prepare = DatabaseSync.prototype.prepare;
  vi.spyOn(DatabaseSync.prototype, 'prepare').mockImplementation(function (
    this: DatabaseSync,
    sql,
  ) {
    if (String(sql).includes('VACUUM INTO')) throw new Error('injected backup disk failure');
    return prepare.call(this, sql);
  });
  expect(() => new Storage(location)).toThrow('backup disk failure');
  expect(snapshotDatabase(location)).toEqual(before);
  vi.restoreAllMocks();
  const db = new DatabaseSync(location);
  db.exec('PRAGMA user_version=14');
  db.close();
  expect(() => new Storage(location)).toThrow('更新的软件版本');
  expect(snapshotDatabase(location)).toEqual(before);
});
