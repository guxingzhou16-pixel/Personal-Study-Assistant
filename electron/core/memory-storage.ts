import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import type { MemoryDraft, StudyMemory } from '../../src/lib/types';
import { memoryAllowed, memoryLimits } from '../../src/lib/memories';
import { AppError } from './errors';
import { record, string } from './settings';

export const MEMORIES_MIGRATION = `
  CREATE TABLE memories (
    id TEXT PRIMARY KEY, title TEXT NOT NULL, content TEXT NOT NULL,
    kind TEXT NOT NULL CHECK(kind IN ('preference', 'learning')),
    scope TEXT NOT NULL CHECK(scope IN ('disabled', 'local', 'remote')),
    origin TEXT NOT NULL CHECK(origin IN ('manual', 'learning-route')),
    origin_turn_id TEXT,
    revision INTEGER NOT NULL CHECK(revision > 0),
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
    CHECK((origin = 'manual' AND origin_turn_id IS NULL) OR
      (origin = 'learning-route' AND origin_turn_id IS NOT NULL))
  );
  CREATE INDEX memories_updated ON memories(updated_at DESC);
  ALTER TABLE chat_turns ADD COLUMN learning_memories TEXT
    CHECK(learning_memories IS NULL OR
      (json_valid(learning_memories) AND learning_request IS NOT NULL));
  PRAGMA user_version = 8;
`;

export function memoryId(input: unknown): string {
  if (typeof input !== 'string' || !/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(input))
    throw new AppError('memoryId', '记忆标识无效，请重新加载。');
  return input;
}
function revision(input: unknown, minimum = 1): number {
  if (
    typeof input !== 'number' ||
    !Number.isSafeInteger(input) ||
    input < minimum ||
    input >= Number.MAX_SAFE_INTEGER
  )
    throw new AppError('memoryRevision', '记忆版本无效，请重新加载。');
  return input;
}
export function readMemoryDraft(input: unknown): MemoryDraft {
  const data = record(input);
  const title = string(data.title, '记忆标题', memoryLimits.title);
  const content = string(data.content, '记忆内容', memoryLimits.content);
  if (!title || !content || /[\r\n\0]/.test(title) || content.includes('\0'))
    throw new AppError('memoryContent', '请填写一行标题和记忆内容，不能包含空字符。');
  if (data.kind !== 'preference' && data.kind !== 'learning')
    throw new AppError('memoryKind', '请选择个人偏好或学习记录。');
  if (typeof data.scope !== 'string' || !['disabled', 'local', 'remote'].includes(data.scope))
    throw new AppError('memoryScope', '请选择记忆的使用范围。');
  return { title, content, kind: data.kind, scope: data.scope as MemoryDraft['scope'] };
}
export function readStudyMemory(input: unknown): StudyMemory {
  const data = record(input);
  const draft = readMemoryDraft(data);
  if (
    (data.origin !== 'manual' && data.origin !== 'learning-route') ||
    (data.origin === 'manual' && data.originTurnId !== null) ||
    typeof data.createdAt !== 'string' ||
    !Number.isFinite(Date.parse(data.createdAt)) ||
    typeof data.updatedAt !== 'string' ||
    !Number.isFinite(Date.parse(data.updatedAt))
  )
    throw new AppError('memoryCorrupt', '记忆来源或时间格式损坏，请保留数据并检查备份。');
  return {
    ...draft,
    id: memoryId(data.id),
    revision: revision(data.revision),
    origin: data.origin,
    originTurnId: data.origin === 'manual' ? null : memoryId(data.originTurnId),
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}
export function readLearningMemories(input: unknown): StudyMemory[] {
  if (!Array.isArray(input) || input.length > memoryLimits.selection)
    throw new AppError('memorySelection', '每次路线最多选择 5 条记忆。');
  const memories = input.map(readStudyMemory);
  if (new Set(memories.map((memory) => memory.id)).size !== memories.length)
    throw new AppError('memorySelection', '本次记忆不能重复。');
  return memories;
}
function decode(row: Record<string, unknown>): StudyMemory {
  try {
    return readStudyMemory({
      ...row,
      originTurnId: row.origin_turn_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  } catch {
    throw new AppError('memoryCorrupt', '记忆数据格式损坏，请保留数据并检查备份。');
  }
}

export class MemoryStorage {
  constructor(private readonly db: DatabaseSync) {}

  list(): StudyMemory[] {
    return this.db.prepare('SELECT * FROM memories ORDER BY updated_at DESC, id').all().map(decode);
  }
  get(input: unknown): StudyMemory {
    const row = this.db.prepare('SELECT * FROM memories WHERE id = ?').get(memoryId(input));
    if (!row) throw new AppError('memoryMissing', '记忆已删除或不存在，请重新加载并准备路线。');
    return decode(row);
  }
  save(input: unknown): StudyMemory {
    const data = record(input);
    if (
      Object.keys(data).some(
        (key) => !['id', 'revision', 'title', 'content', 'kind', 'scope'].includes(key),
      )
    )
      throw new AppError('validation', '记忆请求包含不支持的字段，来源不可手动指定。');
    const draft = readMemoryDraft(data);
    const version = revision(data.revision, data.id === null ? 0 : 1);
    if (data.id === null) {
      if (version !== 0) throw new AppError('memoryRevision', '新记忆的初始版本须为 0。');
      return this.create(draft, null);
    }
    const id = memoryId(data.id);
    const row = this.db
      .prepare(
        `UPDATE memories SET title = ?, content = ?, kind = ?, scope = ?,
      revision = revision + 1, updated_at = ? WHERE id = ? AND revision = ? RETURNING *`,
      )
      .get(
        draft.title,
        draft.content,
        draft.kind,
        draft.scope,
        new Date().toISOString(),
        id,
        version,
      );
    if (!row) {
      this.get(id);
      throw new AppError(
        'memoryConflict',
        '记忆已更新，未覆盖新版本。请保留草稿或另存，再加载新版本。',
      );
    }
    return decode(row);
  }
  // Only the main-process proposal confirmation can supply route provenance.
  create(draftInput: MemoryDraft, originTurnId: string | null): StudyMemory {
    const draft = readMemoryDraft(draftInput);
    if (originTurnId !== null) memoryId(originTurnId);
    if (
      Number(this.db.prepare('SELECT count(*) AS count FROM memories').get()?.count) >=
      memoryLimits.count
    )
      throw new AppError('memoryLimit', '记忆达到当前上限（500）。请整理并删除不再需要的记录。');
    const now = new Date().toISOString();
    return decode(
      this.db
        .prepare(
          `INSERT INTO memories
      (id, title, content, kind, scope, origin, origin_turn_id, revision, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?) RETURNING *`,
        )
        .get(
          randomUUID(),
          draft.title,
          draft.content,
          draft.kind,
          draft.scope,
          originTurnId === null ? 'manual' : 'learning-route',
          originTurnId,
          now,
          now,
        )!,
    );
  }
  delete(input: unknown, revisionInput: unknown): void {
    const id = memoryId(input);
    const result = this.db
      .prepare('DELETE FROM memories WHERE id = ? AND revision = ?')
      .run(id, revision(revisionInput));
    if (!result.changes) {
      this.get(id);
      throw new AppError('memoryConflict', '记忆已更新，未删除。请重新加载并确认。');
    }
  }
  select(input: unknown, baseUrl: string): StudyMemory[] {
    if (!Array.isArray(input) || input.length > memoryLimits.selection)
      throw new AppError('memorySelection', '每次路线最多选择 5 条记忆。');
    const ids = input.map(memoryId);
    if (new Set(ids).size !== ids.length)
      throw new AppError('memorySelection', '本次记忆不能重复。');
    const memories = ids.map((id) => this.get(id));
    this.verify(memories, baseUrl);
    return memories;
  }
  verify(memories: StudyMemory[], baseUrl: string): void {
    for (const snapshot of memories) {
      const current = this.get(snapshot.id);
      if (
        current.revision !== snapshot.revision ||
        JSON.stringify(current) !== JSON.stringify(snapshot)
      )
        throw new AppError('memoryChanged', '所选记忆已变化，请重新准备并核对路线预览。');
      if (!memoryAllowed(current.scope, baseUrl))
        throw new AppError('memoryScope', '所选记忆不允许用于当前模型地址，请调整选择或使用范围。');
    }
  }
}
