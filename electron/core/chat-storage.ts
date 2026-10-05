import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import type { ChatTurn, Conversation, ConversationSummary } from '../../src/lib/types';
import { AppError } from './errors';
import { readNoteSnapshot } from './note-storage';
import { readLearningRequest } from './learning-input';
import { readLearningMemories } from './memory-storage';

type ConversationPurpose = 'chat' | 'note-feedback' | 'learning-agent';

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
export const NOTE_FEEDBACK_MIGRATION = `
  ALTER TABLE conversations ADD COLUMN note_id TEXT REFERENCES notes(id) ON DELETE CASCADE;
  CREATE UNIQUE INDEX conversations_note ON conversations(note_id);
  ALTER TABLE chat_turns ADD COLUMN note_snapshot TEXT
    CHECK(note_snapshot IS NULL OR json_valid(note_snapshot));
  PRAGMA user_version = 6;
`;
export const LEARNING_AGENT_MIGRATION = `
  ALTER TABLE conversations ADD COLUMN purpose TEXT NOT NULL DEFAULT 'chat'
    CHECK(purpose IN ('chat', 'note-feedback', 'learning-agent'));
  UPDATE conversations SET purpose = 'note-feedback' WHERE note_id IS NOT NULL;
  CREATE UNIQUE INDEX conversations_learning ON conversations(purpose) WHERE purpose = 'learning-agent';
  ALTER TABLE chat_turns ADD COLUMN learning_request TEXT
    CHECK(learning_request IS NULL OR (json_valid(learning_request) AND note_snapshot IS NULL AND mode = 'sources'));
  PRAGMA user_version = 7;
`;

function decodeTurn(row: Record<string, unknown>): ChatTurn {
  try {
    const { noteSnapshot, learningRequest, learningMemories, ...fields } = row;
    if (learningRequest !== null && (noteSnapshot !== null || row.mode !== 'sources'))
      throw new Error('Conflicting learning snapshots');
    if (learningMemories !== null && learningRequest === null)
      throw new Error('Memory snapshot outside learning route');
    return {
      ...fields,
      evidence: JSON.parse(String(row.evidence)),
      ...(noteSnapshot !== null
        ? { noteSnapshot: readNoteSnapshot(JSON.parse(String(noteSnapshot))) }
        : {}),
      ...(learningRequest !== null
        ? { learningRequest: readLearningRequest(JSON.parse(String(learningRequest))) }
        : {}),
      ...(learningMemories !== null
        ? { learningMemories: readLearningMemories(JSON.parse(String(learningMemories))) }
        : {}),
    } as unknown as ChatTurn;
  } catch {
    throw new AppError('chatCorrupt', '回答或学习内容快照格式损坏，请保留数据并检查备份。');
  }
}
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
        "SELECT id, title, updated_at AS updatedAt FROM conversations WHERE purpose = 'chat' ORDER BY updated_at DESC, rowid DESC",
      )
      .all() as unknown as ConversationSummary[];
  }
  create(): Conversation {
    return this.createConversation(null);
  }
  private createConversation(
    noteId: string | null,
    purpose: ConversationPurpose = 'chat',
  ): Conversation {
    if (Number(this.db.prepare('SELECT count(*) AS count FROM conversations').get()?.count) >= 500)
      throw new AppError(
        'chatLimit',
        '会话数量已达到当前版本上限（500，含笔记反馈和学习路线）。请保留数据并等待会话管理升级。',
      );
    const conversation = {
      id: randomUUID(),
      title: '新会话',
      updatedAt: new Date().toISOString(),
      turns: [],
    };
    this.db
      .prepare(
        'INSERT INTO conversations (id, title, updated_at, note_id, purpose) VALUES (?, ?, ?, ?, ?)',
      )
      .run(conversation.id, conversation.title, conversation.updatedAt, noteId, purpose);
    return conversation;
  }
  findNoteConversation(noteId: string): Conversation | undefined {
    const row = this.db
      .prepare("SELECT id FROM conversations WHERE note_id = ? AND purpose = 'note-feedback'")
      .get(chatId(noteId));
    return row ? this.get(row.id, 'note-feedback') : undefined;
  }
  createNoteConversation(noteId: string): Conversation {
    return this.createConversation(chatId(noteId), 'note-feedback');
  }
  listNoteFeedback(noteId: string): ChatTurn[] {
    return this.findNoteConversation(noteId)?.turns ?? [];
  }
  findLearningConversation(): Conversation | undefined {
    const row = this.db
      .prepare("SELECT id FROM conversations WHERE purpose = 'learning-agent'")
      .get();
    return row ? this.get(row.id, 'learning-agent') : undefined;
  }
  createLearningConversation(): Conversation {
    return this.createConversation(null, 'learning-agent');
  }
  get(input: unknown, purpose: ConversationPurpose = 'chat'): Conversation {
    const id = chatId(input);
    const row = this.db
      .prepare('SELECT id, title, updated_at AS updatedAt, purpose FROM conversations WHERE id = ?')
      .get(id);
    if (!row) throw new AppError('chatMissing', '找不到这个会话，请新建会话。');
    if (row.purpose !== purpose)
      throw new AppError('chatPurpose', '请从学习笔记或学习路线页面查看这份专用记录。');
    const turns = this.db
      .prepare(
        `SELECT id, conversation_id AS conversationId, question, answer, status,
      notice, provider, base_url AS baseUrl, model, created_at AS createdAt, revision, mode, evidence,
      note_snapshot AS noteSnapshot, learning_request AS learningRequest, learning_memories AS learningMemories
      FROM chat_turns WHERE conversation_id = ? ORDER BY rowid`,
      )
      .all(id)
      .map(decodeTurn);
    const { purpose: _purpose, ...summary } = row;
    return { ...(summary as unknown as ConversationSummary), turns };
  }
  addTurn(turn: ChatTurn): void {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db
        .prepare(
          `INSERT INTO chat_turns
          (id, conversation_id, question, answer, status, notice, provider, base_url, model,
           created_at, revision, mode, evidence, note_snapshot, learning_request, learning_memories)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
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
          turn.mode,
          JSON.stringify(turn.evidence),
          turn.noteSnapshot ? JSON.stringify(turn.noteSnapshot) : null,
          turn.learningRequest ? JSON.stringify(turn.learningRequest) : null,
          turn.learningMemories ? JSON.stringify(turn.learningMemories) : null,
        );
      this.db
        .prepare(
          `UPDATE conversations SET updated_at = ?, title = CASE
        WHEN (SELECT count(*) FROM chat_turns WHERE conversation_id = ?) = 1 THEN ? ELSE title END WHERE id = ?`,
        )
        .run(
          turn.createdAt,
          turn.conversationId,
          turn.noteSnapshot
            ? '笔记反馈：' + turn.noteSnapshot.title.slice(0, 34)
            : turn.learningRequest
              ? '学习路线：' + turn.learningRequest.goal.slice(0, 34)
              : turn.question.slice(0, 40),
          turn.conversationId,
        );
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
  getTurn(input: unknown): ChatTurn {
    const row = this.db
      .prepare(
        `SELECT id, conversation_id AS conversationId, question, answer, status,
      notice, provider, base_url AS baseUrl, model, created_at AS createdAt, revision, mode, evidence,
      note_snapshot AS noteSnapshot, learning_request AS learningRequest, learning_memories AS learningMemories
      FROM chat_turns WHERE id = ?`,
      )
      .get(chatId(input));
    if (!row) throw new AppError('chatMissing', '找不到这次回答，请重新打开会话。');
    return decodeTurn(row);
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
