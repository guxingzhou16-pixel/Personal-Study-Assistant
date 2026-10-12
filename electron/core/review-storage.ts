import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import type { Evidence, StudyReview } from '../../src/lib/types';
import { parsePractice, practiceLimits } from '../../src/lib/practice';
import { validPlanningDay } from '../../src/lib/planning';
import { AppError } from './errors';
import { record, string } from './settings';
import { ChatStorage, chatId } from './chat-storage';
import { readPracticeRequest } from './practice';

export const REVIEW_MIGRATION = `
  CREATE TABLE practice_reviews (
    id TEXT PRIMARY KEY, turn_id TEXT NOT NULL, item_index INTEGER NOT NULL CHECK(item_index BETWEEN 0 AND 2),
    snapshot TEXT NOT NULL CHECK(json_valid(snapshot)), response TEXT NOT NULL,
    has_question INTEGER NOT NULL CHECK(has_question IN (0,1)), review_day TEXT,
    revision INTEGER NOT NULL CHECK(revision > 0), created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
    UNIQUE(turn_id,item_index)
  );
  PRAGMA user_version = 13;
`;
function revision(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0)
    throw new AppError('reviewInput', '作答版本不正确。');
  return value;
}
function reviewDay(value: unknown): string | null {
  if (value !== null && !validPlanningDay(value))
    throw new AppError('reviewInput', '请选择有效复习日期，或清空日期。');
  return value as string | null;
}
export class ReviewStorage {
  constructor(
    private readonly db: DatabaseSync,
    private readonly chat: ChatStorage,
  ) {}
  get(input: unknown): StudyReview {
    const id = chatId(input);
    const row = this.db.prepare('SELECT * FROM practice_reviews WHERE id = ?').get(id);
    if (!row) throw new AppError('reviewMissing', '这份作答记录不存在，请刷新复习列表。');
    try {
      const snapshot = record(JSON.parse(String(row.snapshot)));
      if (Object.keys(snapshot).sort().join(',') !== 'answer,evidence,request,revision')
        throw new Error();
      const request = readPracticeRequest(snapshot.request);
      if (
        request.kind !== 'quiz' ||
        !Array.isArray(snapshot.evidence) ||
        snapshot.evidence.length > 4
      )
        throw new Error();
      const evidence = snapshot.evidence as Evidence[];
      const items = parsePractice(
        string(snapshot.answer, '参考答案', practiceLimits.output),
        evidence,
      );
      const itemIndex = Number(row.item_index);
      if (
        !Number.isInteger(itemIndex) ||
        !items[itemIndex] ||
        ![0, 1].includes(Number(row.has_question))
      )
        throw new Error();
      const item = items[itemIndex];
      const savedRevision = revision(Number(row.revision));
      const turnRevision = revision(snapshot.revision);
      if (
        !savedRevision ||
        !turnRevision ||
        !Number.isFinite(Date.parse(String(row.created_at))) ||
        !Number.isFinite(Date.parse(String(row.updated_at)))
      )
        throw new Error();
      return {
        id,
        turnId: chatId(row.turn_id),
        itemIndex,
        revision: savedRevision,
        turnRevision,
        topic: request.topic,
        question: item.question,
        referenceAnswer: item.answer,
        citations: item.citations,
        evidence,
        response: string(row.response, '我的作答', practiceLimits.answer),
        hasQuestion: row.has_question === 1,
        reviewDay: reviewDay(row.review_day),
        createdAt: String(row.created_at),
        updatedAt: String(row.updated_at),
      };
    } catch {
      throw new AppError('reviewCorrupt', '作答记录格式损坏，请保留数据并检查备份。');
    }
  }
  list(turnInput: unknown): StudyReview[] {
    const rows =
      turnInput === null
        ? this.db.prepare('SELECT id FROM practice_reviews ORDER BY updated_at DESC, id').all()
        : this.db
            .prepare('SELECT id FROM practice_reviews WHERE turn_id = ? ORDER BY item_index')
            .all(chatId(turnInput));
    return rows.map((row) => this.get(row.id));
  }
  save(input: unknown): StudyReview {
    const value = record(input);
    if (
      Object.keys(value).sort().join(',') !==
        'hasQuestion,itemIndex,response,reviewDay,revision,turnId' ||
      typeof value.itemIndex !== 'number' ||
      !Number.isInteger(value.itemIndex) ||
      value.itemIndex < 0 ||
      value.itemIndex > 2 ||
      typeof value.hasQuestion !== 'boolean'
    )
      throw new AppError('reviewInput', '作答或复习安排格式不正确。');
    const turnId = chatId(value.turnId),
      expected = revision(value.revision);
    const response = string(value.response, '我的作答', practiceLimits.answer),
      day = reviewDay(value.reviewDay);
    const old = this.db
      .prepare('SELECT id, revision FROM practice_reviews WHERE turn_id = ? AND item_index = ?')
      .get(turnId, value.itemIndex);
    if ((old ? Number(old.revision) : 0) !== expected)
      throw new AppError('reviewConflict', '作答已更新，请先重新读取；当前输入仍保留。');
    const now = new Date().toISOString();
    const id = old ? String(old.id) : randomUUID();
    if (old) {
      this.get(id);
      const updated = this.db
        .prepare(
          'UPDATE practice_reviews SET response=?,has_question=?,review_day=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?',
        )
        .run(response, value.hasQuestion ? 1 : 0, day, now, id, expected);
      if (updated.changes !== 1)
        throw new AppError('reviewConflict', '作答已更新，请重新读取，当前输入仍保留。');
    } else {
      if (
        Number(this.db.prepare('SELECT count(*) AS total FROM practice_reviews').get()!.total) >=
        1000
      )
        throw new AppError('reviewLimit', '作答记录达到1000份上限；仍可编辑和导出已有作答。');
      const turn = this.chat.getTurn(turnId);
      if (turn.status !== 'completed' || turn.practiceRequest?.kind !== 'quiz')
        throw new AppError('reviewInput', '只能保存完整短测验的作答，不把未完成输出当题目。');
      parsePractice(turn.answer, turn.evidence);
      const snapshot = {
        request: turn.practiceRequest,
        answer: turn.answer,
        evidence: turn.evidence,
        revision: turn.revision,
      };
      this.db
        .prepare('INSERT INTO practice_reviews VALUES (?,?,?,?,?,?,?,1,?,?)')
        .run(
          id,
          turnId,
          value.itemIndex,
          JSON.stringify(snapshot),
          response,
          value.hasQuestion ? 1 : 0,
          day,
          now,
          now,
        );
    }
    return this.get(id);
  }
}
