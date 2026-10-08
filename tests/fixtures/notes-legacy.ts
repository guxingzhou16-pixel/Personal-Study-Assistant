import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { defaultSettings, type Evidence } from '../../src/lib/types';

export const legacyText = '# 事务学习\n\n事务要么全部提交，要么全部回滚。\n';
export const legacySourceId = createHash('sha256').update(legacyText).digest('hex');
export const legacyConversationId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
export const legacyTurnId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
export const legacyEvidence: Evidence[] = [
  {
    number: 1,
    sourceId: legacySourceId,
    sourceName: '事务学习.md',
    kind: 'markdown',
    anchor: 'md-line-1',
    title: '事务学习',
    line: 1,
    start: 0,
    end: '事务要么全部提交，要么全部回滚。'.length,
    text: '事务要么全部提交，要么全部回滚。',
  },
];

// Independent SQL fixture: never create a current database and just change its version.
export function createLegacyNotesDatabase(path: string, version = 4) {
  const db = new DatabaseSync(path);
  try {
    db.exec(`CREATE TABLE app_settings (id INTEGER PRIMARY KEY, value TEXT NOT NULL);`);
    db.prepare('INSERT INTO app_settings VALUES (1, ?)').run(
      JSON.stringify({
        ...defaultSettings,
        displayName: '迁移验收',
        dailyGoalMinutes: 65,
      }),
    );
    if (version >= 2) {
      db.exec(`
        CREATE TABLE sources (
          id TEXT PRIMARY KEY, name TEXT NOT NULL, kind TEXT NOT NULL,
          bytes INTEGER NOT NULL, page_count INTEGER NOT NULL, text_status TEXT NOT NULL,
          imported_at TEXT NOT NULL, opened_at TEXT, outline TEXT NOT NULL, position TEXT NOT NULL
        );
        CREATE TABLE source_segments (
          source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
          anchor TEXT NOT NULL, title TEXT NOT NULL, depth INTEGER NOT NULL,
          page INTEGER, line INTEGER, text TEXT NOT NULL, PRIMARY KEY(source_id, anchor)
        );
      `);
      db.prepare('INSERT INTO sources VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
        legacySourceId,
        '事务学习.md',
        'markdown',
        Buffer.byteLength(legacyText),
        1,
        'ready',
        '2026-10-01T00:00:00.000Z',
        '2026-10-02T00:00:00.000Z',
        JSON.stringify([{ anchor: 'md-line-1', title: '事务学习', depth: 1, line: 1 }]),
        JSON.stringify({ page: 1, anchor: 'md-line-1', offset: 18, zoom: 1.25, tone: 'warm' }),
      );
      db.prepare('INSERT INTO source_segments VALUES (?, ?, ?, ?, ?, ?, ?)').run(
        legacySourceId,
        'md-line-1',
        '事务学习',
        1,
        null,
        1,
        legacyEvidence[0].text,
      );
    }
    if (version >= 3) {
      db.exec(`
        CREATE TABLE conversations (id TEXT PRIMARY KEY, title TEXT NOT NULL, updated_at TEXT NOT NULL);
        CREATE TABLE chat_turns (
          id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
          question TEXT NOT NULL, answer TEXT NOT NULL, status TEXT NOT NULL, notice TEXT NOT NULL,
          provider TEXT NOT NULL, base_url TEXT NOT NULL, model TEXT NOT NULL, created_at TEXT NOT NULL,
          revision INTEGER NOT NULL
        );
        CREATE INDEX chat_turns_conversation ON chat_turns(conversation_id);
      `);
      db.prepare('INSERT INTO conversations VALUES (?, ?, ?)').run(
        legacyConversationId,
        '旧事务问答',
        '2026-10-01T00:00:00.000Z',
      );
      db.prepare('INSERT INTO chat_turns VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
        legacyTurnId,
        legacyConversationId,
        '事务是什么？',
        '全部提交或者回滚。[1]',
        'completed',
        '',
        'ollama',
        'http://127.0.0.1:11434',
        'fixture',
        '2026-10-01T00:00:00.000Z',
        3,
      );
      if (version === 4) {
        db.exec(`
          ALTER TABLE chat_turns ADD COLUMN mode TEXT NOT NULL DEFAULT 'chat';
          ALTER TABLE chat_turns ADD COLUMN evidence TEXT NOT NULL DEFAULT '[]';
        `);
        db.prepare('UPDATE chat_turns SET mode = ?, evidence = ?').run(
          'sources',
          JSON.stringify(legacyEvidence),
        );
      }
    }
    db.exec(`PRAGMA user_version = ${version};`);
  } finally {
    db.close();
  }
}
