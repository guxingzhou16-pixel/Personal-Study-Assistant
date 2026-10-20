import { DatabaseSync } from 'node:sqlite';
import { AppError } from './errors';

// Derived data only. Primary keys use immutable source/anchor/offset identities,
// never FTS rowids, so a keyword rebuild cannot point a vector at another excerpt.
export function openVectorIndex(path: string): DatabaseSync {
  const db = new DatabaseSync(path);
  try {
    db.exec('PRAGMA busy_timeout = 5000');
    const version = Number(db.prepare('PRAGMA user_version').get()?.user_version);
    if (version > 2) throw new AppError('indexVersion', '检索索引来自更新的版本，请升级应用。');
    if (version < 2) {
      db.exec('BEGIN IMMEDIATE');
      try {
        db.exec(`
          CREATE TABLE chunk_vectors (
            model_id TEXT NOT NULL, source_id TEXT NOT NULL, anchor TEXT NOT NULL,
            start INTEGER NOT NULL, end INTEGER NOT NULL, embedding BLOB NOT NULL,
            PRIMARY KEY (model_id, source_id, anchor, start, end)
          );
          CREATE TABLE embedded_sources (
            model_id TEXT NOT NULL, source_id TEXT NOT NULL,
            PRIMARY KEY (model_id, source_id)
          );
          PRAGMA user_version = 2;
          COMMIT;
        `);
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    }
    return db;
  } catch (error) {
    db.close();
    throw error;
  }
}
