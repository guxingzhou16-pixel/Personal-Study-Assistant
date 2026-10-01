import { DatabaseSync } from 'node:sqlite';
import type { StudyDay } from '../../src/lib/types';
import { AppError } from './errors';

// Learning activity owns a separate database so reading migrations can evolve independently.
export class StudyStorage {
  private readonly db: DatabaseSync;

  constructor(path: string) {
    this.db = new DatabaseSync(path);
    try {
      this.db.exec('PRAGMA busy_timeout = 5000;');
      const version = Number(this.db.prepare('PRAGMA user_version').get()?.user_version);
      if (version > 1)
        throw new AppError('databaseVersion', '学习记录来自更新的软件版本，请升级应用后再打开。');
      if (version === 0) {
        this.db.exec('BEGIN IMMEDIATE;');
        try {
          this.db.exec(`
            CREATE TABLE study_days (
              day TEXT PRIMARY KEY,
              checked_in INTEGER NOT NULL DEFAULT 0 CHECK (checked_in IN (0, 1)),
              study_ms INTEGER NOT NULL DEFAULT 0 CHECK (study_ms >= 0)
            );
            PRAGMA user_version = 1;
          `);
          this.db.exec('COMMIT;');
        } catch (error) {
          this.db.exec('ROLLBACK;');
          throw error;
        }
      }
    } catch (error) {
      this.db.close();
      throw error;
    }
  }

  studyDay(day: string): StudyDay {
    const row = this.db
      .prepare('SELECT checked_in, study_ms FROM study_days WHERE day = ?')
      .get(day);
    return {
      day,
      checkedIn: row?.checked_in === 1,
      studySeconds: Math.floor(Number(row?.study_ms ?? 0) / 1000),
    };
  }

  studyMonth(year: number, month: number): StudyDay[] {
    const prefix = `${year}-${String(month).padStart(2, '0')}`;
    return this.db
      .prepare('SELECT day, checked_in, study_ms FROM study_days WHERE day LIKE ? ORDER BY day')
      .all(`${prefix}-%`)
      .map((row) => ({
        day: String(row.day),
        checkedIn: row.checked_in === 1,
        studySeconds: Math.floor(Number(row.study_ms) / 1000),
      }));
  }

  checkIn(day: string): void {
    this.db
      .prepare(
        'INSERT INTO study_days (day, checked_in) VALUES (?, 1) ON CONFLICT(day) DO UPDATE SET checked_in = 1',
      )
      .run(day);
  }

  addStudyTime(parts: { day: string; milliseconds: number }[]): void {
    if (!parts.length) return;
    const statement = this.db.prepare(
      'INSERT INTO study_days (day, study_ms) VALUES (?, ?) ON CONFLICT(day) DO UPDATE SET study_ms = study_ms + excluded.study_ms',
    );
    this.db.exec('BEGIN IMMEDIATE;');
    try {
      for (const part of parts) statement.run(part.day, part.milliseconds);
      this.db.exec('COMMIT;');
    } catch (error) {
      this.db.exec('ROLLBACK;');
      throw error;
    }
  }

  close(): void {
    this.db.close();
  }
}
