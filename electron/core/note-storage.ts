import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import type { NoteDraft, NoteSummary, StudyNote } from '../../src/lib/types';
import { emptyNoteDraft, noteLimits, noteSections } from '../../src/lib/notes';
import { AppError } from './errors';
import { record, string } from './settings';
import { sourceId } from './documents';

export const NOTES_MIGRATION = `
  CREATE TABLE notes (
    id TEXT PRIMARY KEY, source_id TEXT REFERENCES sources(id), title TEXT NOT NULL,
    understanding TEXT NOT NULL, evidence TEXT NOT NULL,
    questions TEXT NOT NULL, next_step TEXT NOT NULL,
    revision INTEGER NOT NULL CHECK(revision > 0),
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  );
  CREATE INDEX notes_updated_at ON notes(updated_at DESC);
  PRAGMA user_version = 5;
`;

function noteId(input: unknown): string {
  if (typeof input !== 'string' || !/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(input))
    throw new AppError('noteId', '笔记标识无效，请重新打开笔记。');
  return input;
}

export function noteRevision(input: unknown, minimum = 1): number {
  if (
    typeof input !== 'number' ||
    !Number.isSafeInteger(input) ||
    input < minimum ||
    input >= Number.MAX_SAFE_INTEGER
  )
    throw new AppError('noteRevision', '笔记版本无效，请重新打开笔记。');
  return input;
}

function noteTitle(input: unknown): string {
  const title = string(input, '笔记标题', noteLimits.title);
  if (!title || /[\r\n\0]/.test(title)) throw new AppError('noteTitle', '请填写一行笔记标题。');
  return title;
}

function validateDraft(input: Record<string, unknown>): NoteDraft {
  const draft = emptyNoteDraft(input.sourceId === null ? null : sourceId(input.sourceId));
  draft.title = noteTitle(input.title);
  for (const { key, label } of noteSections) {
    const value = input[key];
    if (typeof value !== 'string' || value.length > noteLimits.section || value.includes('\0'))
      throw new AppError(
        'noteContent',
        label + '格式不正确或超过 ' + noteLimits.section + ' 字符。',
      );
    draft[key] = value;
  }
  return draft;
}

function decode(row: Record<string, unknown>): StudyNote {
  try {
    return readNoteSnapshot({
      ...row,
      sourceId: row.source_id,
      nextStep: row.next_step,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  } catch {
    throw new AppError('noteCorrupt', '笔记数据格式损坏。请保留数据目录并检查备份。');
  }
}

export function readNoteSnapshot(input: unknown): StudyNote {
  const data = record(input);
  const draft = validateDraft(data);
  if (
    typeof data.createdAt !== 'string' ||
    typeof data.updatedAt !== 'string' ||
    !Number.isFinite(Date.parse(data.createdAt)) ||
    !Number.isFinite(Date.parse(data.updatedAt))
  )
    throw new AppError('noteCorrupt', '笔记时间格式损坏。请保留数据目录并检查备份。');
  return {
    ...draft,
    id: noteId(data.id),
    revision: noteRevision(data.revision),
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

export class NoteStorage {
  constructor(private readonly db: DatabaseSync) {}

  list(): NoteSummary[] {
    return this.db
      .prepare(
        `
      SELECT notes.id, notes.title, notes.source_id AS sourceId,
        sources.name AS sourceName, notes.updated_at AS updatedAt
      FROM notes LEFT JOIN sources ON sources.id = notes.source_id
      ORDER BY notes.updated_at DESC, notes.id
    `,
      )
      .all()
      .map((row) => {
        try {
          const updatedAt = String(row.updatedAt);
          if (
            !Number.isFinite(Date.parse(updatedAt)) ||
            (row.sourceName !== null && typeof row.sourceName !== 'string')
          )
            throw new Error('invalid metadata');
          return {
            id: noteId(row.id),
            title: noteTitle(row.title),
            updatedAt,
            sourceId: row.sourceId === null ? null : sourceId(row.sourceId),
            sourceName: row.sourceName as string | null,
          };
        } catch {
          throw new AppError('noteCorrupt', '笔记列表数据格式损坏。请保留数据目录并检查备份。');
        }
      });
  }

  get(input: unknown): StudyNote {
    const row = this.db.prepare('SELECT * FROM notes WHERE id = ?').get(noteId(input));
    if (!row) throw new AppError('noteMissing', '找不到这份笔记，请重新加载笔记列表。');
    return decode(row);
  }

  save(input: unknown): StudyNote {
    const data = record(input);
    if (
      Object.keys(data).some(
        (key) =>
          ![
            'id',
            'revision',
            'title',
            'sourceId',
            ...noteSections.map((section) => section.key),
          ].includes(key),
      )
    )
      throw new AppError('validation', '笔记请求包含不支持的字段。');
    const draft = validateDraft(data);
    const revision = noteRevision(data.revision, data.id === null ? 0 : 1);
    if (
      draft.sourceId &&
      !this.db.prepare('SELECT id FROM sources WHERE id = ?').get(draft.sourceId)
    )
      throw new AppError('sourceMissing', '关联资料不存在，请重新选择资料或取消关联。');
    const values = [
      draft.sourceId,
      draft.title,
      draft.understanding,
      draft.evidence,
      draft.questions,
      draft.nextStep,
    ];
    const now = new Date().toISOString();
    if (data.id === null) {
      if (revision !== 0) throw new AppError('noteRevision', '新笔记的初始版本无效。');
      if (
        Number(this.db.prepare('SELECT count(*) AS count FROM notes').get()?.count) >=
        noteLimits.count
      )
        throw new AppError(
          'noteLimit',
          '笔记达到当前上限（' + noteLimits.count + '）。请导出并删除不再需要的笔记。',
        );
      return decode(
        this.db
          .prepare(
            `
        INSERT INTO notes (id, source_id, title, understanding, evidence, questions, next_step, revision, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?) RETURNING *
      `,
          )
          .get(randomUUID(), ...values, now, now)!,
      );
    }
    const id = noteId(data.id);
    const row = this.db
      .prepare(
        `
      UPDATE notes SET source_id = ?, title = ?, understanding = ?, evidence = ?, questions = ?,
        next_step = ?, revision = revision + 1, updated_at = ?
      WHERE id = ? AND revision = ? RETURNING *
    `,
      )
      .get(...values, now, id, revision);
    if (!row) {
      this.get(id);
      throw new AppError(
        'noteConflict',
        '笔记已在其他操作中更新，尚未覆盖新版本。请保留当前内容，重新加载后再编辑。',
      );
    }
    return decode(row);
  }

  delete(input: unknown, revisionInput: unknown): void {
    const id = noteId(input);
    const revision = noteRevision(revisionInput);
    const result = this.db
      .prepare('DELETE FROM notes WHERE id = ? AND revision = ?')
      .run(id, revision);
    if (!result.changes) {
      this.get(id);
      throw new AppError('noteConflict', '笔记已更新，未执行删除。请重新加载后再确认。');
    }
  }
}
