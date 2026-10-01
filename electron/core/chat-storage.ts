import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import type { ChatTurn, Conversation, ConversationSummary } from '../../src/lib/types';
import { AppError } from './errors';

export const CHAT_MIGRATION = `
  CREATE TABLE conversations (id TEXT PRIMARY KEY, title TEXT NOT NULL, updated_at TEXT NOT NULL);
  CREATE TABLE chat_turns (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    question TEXT NOT NULL, answer TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('streaming','completed','stopped','error','interrupted')),
    notice TEXT NOT NULL, provider TEXT NOT NULL, base_url TEXT NOT NULL,
    model TEXT NOT NULL, created_at TEXT NOT NULL, revision INTEGER NOT NULL
  );
  CREATE INDEX chat_turns_conversation ON chat_turns(conversation_id);
  PRAGMA user_version = 3;
`;
export function chatId(input: unknown): string {
  if (typeof input !== 'string' || !/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(input))
    throw new AppError('chatId', '会话标识无效，请重新打开会话。');
  return input;
}
export class ChatStorage {
  constructor(private readonly db: DatabaseSync) {}
  list(): ConversationSummary[] {
    return this.db
      .prepare(
        'SELECT id, title, updated_at AS updatedAt FROM conversations ORDER BY updated_at DESC, rowid DESC',
      )
      .all() as unknown as ConversationSummary[];
  }
  create(): Conversation {
    if (Number(this.db.prepare('SELECT count(*) AS count FROM conversations').get()?.count) >= 500)
      throw new AppError(
        'chatLimit',
        '会话数量已达到当前版本上限（500）。请保留数据并等待会话管理升级。',
      );
    const conversation = {
      id: randomUUID(),
      title: '新会话',
      updatedAt: new Date().toISOString(),
      turns: [],
    };
    this.db
      .prepare('INSERT INTO conversations VALUES (?, ?, ?)')
      .run(conversation.id, conversation.title, conversation.updatedAt);
    return conversation;
  }
  get(input: unknown): Conversation {
    const id = chatId(input);
    const row = this.db
      .prepare('SELECT id, title, updated_at AS updatedAt FROM conversations WHERE id = ?')
      .get(id);
    if (!row) throw new AppError('chatMissing', '找不到这个会话，请新建会话。');
    const turns = this.db
      .prepare(
        `SELECT id, conversation_id AS conversationId, question, answer, status,
      notice, provider, base_url AS baseUrl, model, created_at AS createdAt, revision
      FROM chat_turns WHERE conversation_id = ? ORDER BY rowid`,
      )
      .all(id) as unknown as ChatTurn[];
    return { ...(row as unknown as ConversationSummary), turns };
  }
  addTurn(turn: ChatTurn): void {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db
        .prepare('INSERT INTO chat_turns VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(
          turn.id,
          turn.conversationId,
          turn.question,
          turn.answer,
          turn.status,
          turn.notice,
          turn.provider,
          turn.baseUrl,
          turn.model,
          turn.createdAt,
          turn.revision,
        );
      this.db
        .prepare(
          `UPDATE conversations SET updated_at = ?, title = CASE
        WHEN (SELECT count(*) FROM chat_turns WHERE conversation_id = ?) = 1 THEN ? ELSE title END WHERE id = ?`,
        )
        .run(turn.createdAt, turn.conversationId, turn.question.slice(0, 40), turn.conversationId);
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
  saveTurn(turn: ChatTurn): void {
    this.db
      .prepare(
        'UPDATE chat_turns SET answer = ?, status = ?, notice = ?, revision = ? WHERE id = ?',
      )
      .run(turn.answer, turn.status, turn.notice, turn.revision, turn.id);
  }
  recover(): void {
    this.db
      .prepare(
        "UPDATE chat_turns SET status = 'interrupted', notice = ?, revision = revision + 1 WHERE status = 'streaming'",
      )
      .run('上次生成因应用退出或中断而停止，已保留保存的内容。');
  }
}
