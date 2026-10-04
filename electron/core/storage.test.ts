import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { defaultSettings } from '../../src/lib/types';
import { Storage } from './storage';

const directories: string[] = [];
function databasePath() {
  const directory = mkdtempSync(join(tmpdir(), 'study-core-'));
  directories.push(directory);
  return join(directory, 'study.sqlite3');
}
afterEach(() => {
  for (const path of directories.splice(0)) rmSync(path, { recursive: true, force: true });
});

describe('local settings and database migrations', () => {
  it('creates a database and preserves settings when reopened and migrated again', () => {
    const path = databasePath();
    let storage = new Storage(path);
    expect(storage.schemaVersion).toBe(5);
    expect(storage.loadSettings()).toEqual(defaultSettings);
    const saved = storage.saveSettings({
      ...defaultSettings,
      displayName: '小舟',
      dailyGoalMinutes: 60,
    });
    storage.close();
    storage = new Storage(path);
    expect(storage.schemaVersion).toBe(5);
    expect(storage.loadSettings()).toEqual(saved);
    storage.close();
  });

  it('rejects invalid goals and secret fields before writing', () => {
    const path = databasePath();
    const storage = new Storage(path);
    expect(() => storage.saveSettings({ ...defaultSettings, dailyGoalMinutes: 0 })).toThrow(
      '每日目标',
    );
    expect(() => storage.saveSettings({ ...defaultSettings, dailyGoalMinutes: 20.5 })).toThrow(
      '整数',
    );
    expect(() =>
      storage.saveSettings({ ...defaultSettings, apiKey: 'fake-secret-marker' }),
    ).toThrow('密钥');
    expect(storage.loadSettings()).toEqual(defaultSettings);
    storage.close();
    expect(readFileSync(path).includes(Buffer.from('fake-secret-marker'))).toBe(false);
  });

  it('refuses a newer schema without altering it', () => {
    const path = databasePath();
    const database = new DatabaseSync(path);
    database.exec(
      "PRAGMA user_version = 99; CREATE TABLE future_data (value TEXT); INSERT INTO future_data VALUES ('keep');",
    );
    database.close();
    expect(() => new Storage(path)).toThrow('更新');
    const unchanged = new DatabaseSync(path);
    expect(unchanged.prepare('PRAGMA user_version').get()?.user_version).toBe(99);
    expect(unchanged.prepare('SELECT value FROM future_data').get()?.value).toBe('keep');
    unchanged.close();
  });

  it('reports corrupt stored settings without pretending they are defaults', () => {
    const path = databasePath();
    const storage = new Storage(path);
    storage.close();
    const database = new DatabaseSync(path);
    database.prepare('INSERT INTO app_settings VALUES (1, ?)').run('{"displayName":42}');
    database.close();
    const reopened = new Storage(path);
    expect(() => reopened.loadSettings()).toThrow('损坏');
    reopened.close();
  });
});
