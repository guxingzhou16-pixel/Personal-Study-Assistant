import { DatabaseSync } from 'node:sqlite';
import { defaultSettings, type Settings } from '../../src/lib/types';
import { AppError } from './errors';
import { validateSettings } from './settings';

const INITIAL_MIGRATION = `
  CREATE TABLE app_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    value TEXT NOT NULL CHECK (json_valid(value))
  );
  PRAGMA user_version = 1;
`;

export class Storage {
  private readonly db: DatabaseSync;

  constructor(path: string) {
    this.db = new DatabaseSync(path);
    try {
      this.db.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
      if (this.schemaVersion > 1)
        throw new AppError('databaseVersion', '数据来自更新的软件版本，请升级应用后再打开。');
      if (this.schemaVersion === 0) {
        this.db.exec('BEGIN IMMEDIATE;');
        try {
          this.db.exec(INITIAL_MIGRATION);
          this.db.exec('COMMIT;');
        } catch (error) {
          this.db.exec('ROLLBACK;');
          throw error;
        }
      }
      this.db.exec(
        'CREATE VIRTUAL TABLE temp.fts_probe USING fts5(content); DROP TABLE temp.fts_probe;',
      );
    } catch (error) {
      this.db.close();
      throw error;
    }
  }

  get schemaVersion(): number {
    return Number(this.db.prepare('PRAGMA user_version').get()?.user_version);
  }

  loadSettings(): Settings {
    const row = this.db.prepare('SELECT value FROM app_settings WHERE id = 1').get();
    if (!row) return structuredClone(defaultSettings);
    try {
      return validateSettings(JSON.parse(String(row.value)));
    } catch {
      throw new AppError('settingsCorrupt', '本地设置格式损坏。请保留数据目录并检查备份。');
    }
  }

  saveSettings(input: unknown): Settings {
    const settings = validateSettings(input);
    this.db
      .prepare(
        'INSERT INTO app_settings (id, value) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET value = excluded.value',
      )
      .run(JSON.stringify(settings));
    return settings;
  }

  close(): void {
    this.db.close();
  }
}
