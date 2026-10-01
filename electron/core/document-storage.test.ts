import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { expect, it } from 'vitest';
import { defaultSettings } from '../../src/lib/types';
import { Storage } from './storage';

it('upgrades the existing v1 database, preserving settings and keeping a recoverable backup', () => {
  const directory = mkdtempSync(join(tmpdir(), 'study-migration-'));
  const path = join(directory, 'study.sqlite3');
  let storage: Storage | undefined;
  try {
    const old = new DatabaseSync(path);
    old.exec('CREATE TABLE app_settings (id INTEGER PRIMARY KEY, value TEXT NOT NULL); PRAGMA user_version = 1;');
    old.prepare('INSERT INTO app_settings VALUES (1, ?)').run(JSON.stringify({ ...defaultSettings, displayName: '保留旧设置', dailyGoalMinutes: 70 }));
    old.close();
    const oldBytes = readFileSync(path);
    storage = new Storage(path);
    expect(storage.schemaVersion).toBe(2);
    expect(storage.loadSettings()).toMatchObject({ displayName: '保留旧设置', dailyGoalMinutes: 70 });
    const backups = readdirSync(directory).filter(name => name.includes('before-v2'));
    expect(backups).toHaveLength(1);
    const backup = new DatabaseSync(join(directory, backups[0]), { readOnly: true });
    expect(backup.prepare('PRAGMA user_version').get()?.user_version).toBe(1);
    expect(JSON.parse(String(backup.prepare('SELECT value FROM app_settings').get()?.value)).displayName).toBe('保留旧设置');
    backup.close();
    expect(oldBytes.length).toBeGreaterThan(0);
  } finally {
    storage?.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
