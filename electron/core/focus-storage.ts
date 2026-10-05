import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import type { DailyTask, FocusEndReason, FocusSession } from '../../src/lib/types';
import { focusLimits } from '../../src/lib/focus';
import { planningLimits, validPlanningDay } from '../../src/lib/planning';
import { AppError } from './errors';

export const FOCUS_MIGRATION = `
  CREATE TABLE focus_sessions (
    id TEXT PRIMARY KEY, task_id TEXT NOT NULL, task_revision INTEGER NOT NULL
      CHECK(typeof(task_revision) = 'integer' AND task_revision BETWEEN 1 AND 9007199254740991),
    task_title TEXT NOT NULL, task_day TEXT NOT NULL,
    planned_minutes INTEGER NOT NULL CHECK(typeof(planned_minutes) = 'integer' AND planned_minutes BETWEEN 5 AND 120),
    elapsed_ms INTEGER NOT NULL CHECK(typeof(elapsed_ms) = 'integer' AND elapsed_ms BETWEEN 0 AND planned_minutes * 60000),
    status TEXT NOT NULL CHECK(status IN ('running', 'paused', 'completed', 'stopped', 'interrupted')),
    reason TEXT, review TEXT NOT NULL,
    started_at TEXT NOT NULL, ended_at TEXT, updated_at TEXT NOT NULL,
    revision INTEGER NOT NULL CHECK(typeof(revision) = 'integer' AND revision BETWEEN 1 AND 9007199254740991),
    CHECK((status IN ('running', 'paused') AND reason IS NULL AND ended_at IS NULL AND
      elapsed_ms < planned_minutes * 60000 AND review = '') OR
      (status = 'completed' AND reason IS NOT NULL AND reason = 'elapsed' AND ended_at IS NOT NULL AND
        elapsed_ms = planned_minutes * 60000) OR
      (status = 'stopped' AND reason IS NOT NULL AND reason = 'user-stop' AND ended_at IS NOT NULL AND
        elapsed_ms < planned_minutes * 60000) OR
      (status = 'interrupted' AND reason IS NOT NULL AND reason IN ('sleep', 'heartbeat-gap', 'app-exit', 'app-restart',
        'renderer-reload', 'storage-error') AND ended_at IS NOT NULL AND
        elapsed_ms < planned_minutes * 60000))
  );
  CREATE UNIQUE INDEX focus_one_active ON focus_sessions((1)) WHERE status IN ('running', 'paused');
  CREATE INDEX focus_recent ON focus_sessions(started_at DESC, id);
  PRAGMA user_version = 11;
`;

export function focusId(input: unknown): string {
  if (typeof input !== 'string' || !/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(input))
    throw new AppError('focusId', '专注或任务标识无效，请重新加载。');
  return input;
}

export function focusRevision(input: unknown): number {
  if (typeof input !== 'number' || !Number.isSafeInteger(input) || input < 1)
    throw new AppError('focusRevision', '专注或任务版本无效，请重新加载。');
  return input;
}

export function focusMinutes(input: unknown): number {
  if (
    typeof input !== 'number' ||
    !Number.isInteger(input) ||
    input < focusLimits.minMinutes ||
    input > focusLimits.maxMinutes
  )
    throw new AppError('focusMinutes', '本轮专注时长应为 5 到 120 之间的整数分钟。');
  return input;
}

export function focusReview(input: unknown): string {
  if (typeof input !== 'string' || input.length > focusLimits.review || input.includes('\0'))
    throw new AppError('focusReview', '复盘最多 1000 字符，不能包含空字符。');
  return input.trim();
}

function timestamp(input: unknown): string {
  if (typeof input !== 'string' || !Number.isFinite(Date.parse(input)))
    throw new Error('invalid timestamp');
  if (new Date(input).toISOString() !== input) throw new Error('noncanonical timestamp');
  return input;
}

function decode(row: Record<string, unknown>): FocusSession {
  try {
    const plannedMinutes = focusMinutes(row.planned_minutes);
    if (
      typeof row.task_title !== 'string' ||
      !row.task_title.trim() ||
      row.task_title.length > planningLimits.title ||
      /[\0\r\n]/.test(row.task_title) ||
      !validPlanningDay(row.task_day) ||
      typeof row.elapsed_ms !== 'number' ||
      !Number.isSafeInteger(row.elapsed_ms) ||
      row.elapsed_ms < 0 ||
      row.elapsed_ms > plannedMinutes * 60000
    )
      throw new Error('invalid snapshot');
    const active = row.status === 'running' || row.status === 'paused';
    const full = row.elapsed_ms === plannedMinutes * 60000;
    const interruptedReasons: FocusEndReason[] = [
      'sleep',
      'heartbeat-gap',
      'app-exit',
      'app-restart',
      'renderer-reload',
      'storage-error',
    ];
    if (
      (active && (row.reason !== null || row.ended_at !== null || full || row.review !== '')) ||
      (row.status === 'completed' &&
        (row.reason !== 'elapsed' || row.ended_at === null || !full)) ||
      (row.status === 'stopped' && (row.reason !== 'user-stop' || row.ended_at === null || full)) ||
      (row.status === 'interrupted' &&
        (!interruptedReasons.includes(row.reason as FocusEndReason) ||
          row.ended_at === null ||
          full)) ||
      (!active && !['completed', 'stopped', 'interrupted'].includes(String(row.status)))
    )
      throw new Error('invalid state');
    const review = focusReview(row.review);
    if (review !== row.review) throw new Error('invalid review');
    return {
      id: focusId(row.id),
      taskId: focusId(row.task_id),
      taskRevision: focusRevision(row.task_revision),
      taskTitle: row.task_title,
      taskDay: row.task_day,
      plannedMinutes,
      elapsedMs: row.elapsed_ms,
      status: row.status as FocusSession['status'],
      reason: row.reason as FocusSession['reason'],
      review,
      startedAt: timestamp(row.started_at),
      endedAt: row.ended_at === null ? null : timestamp(row.ended_at),
      updatedAt: timestamp(row.updated_at),
      revision: focusRevision(row.revision),
    };
  } catch {
    throw new AppError('focusCorrupt', '专注记录格式损坏，请保留数据目录并检查备份。');
  }
}

function rowOf(session: FocusSession): Record<string, unknown> {
  return {
    id: session.id,
    task_id: session.taskId,
    task_revision: session.taskRevision,
    task_title: session.taskTitle,
    task_day: session.taskDay,
    planned_minutes: session.plannedMinutes,
    elapsed_ms: session.elapsedMs,
    status: session.status,
    reason: session.reason,
    review: session.review,
    started_at: session.startedAt,
    ended_at: session.endedAt,
    updated_at: session.updatedAt,
    revision: session.revision,
  };
}

export class FocusStorage {
  constructor(private readonly db: DatabaseSync) {}

  active(): FocusSession | null {
    const rows = this.db
      .prepare("SELECT * FROM focus_sessions WHERE status IN ('running', 'paused') LIMIT 2")
      .all();
    if (rows.length > 1)
      throw new AppError('focusCorrupt', '存在多个未结束的专注记录，请保留数据目录并检查备份。');
    return rows[0] ? decode(rows[0]) : null;
  }

  recent(): FocusSession[] {
    return this.db
      .prepare(
        `SELECT * FROM focus_sessions WHERE status NOT IN ('running', 'paused')
         ORDER BY started_at DESC, id LIMIT ?`,
      )
      .all(focusLimits.recent)
      .map(decode);
  }

  get(input: unknown): FocusSession {
    const row = this.db.prepare('SELECT * FROM focus_sessions WHERE id = ?').get(focusId(input));
    if (!row) throw new AppError('focusMissing', '专注记录不存在，请重新加载。');
    return decode(row);
  }

  private transaction<T>(operation: () => T): T {
    this.db.exec('BEGIN IMMEDIATE;');
    try {
      const result = operation();
      this.db.exec('COMMIT;');
      return result;
    } catch (error) {
      try {
        this.db.exec('ROLLBACK;');
      } catch {
        // Keep the original failure if SQLite has already rolled back.
      }
      throw error;
    }
  }

  create(task: DailyTask, minutes: number, now: string): FocusSession {
    const session = decode(
      rowOf({
        id: randomUUID(),
        taskId: task.id,
        taskRevision: task.revision,
        taskTitle: task.title,
        taskDay: task.day,
        plannedMinutes: minutes,
        elapsedMs: 0,
        status: 'running',
        reason: null,
        review: '',
        startedAt: now,
        endedAt: null,
        updatedAt: now,
        revision: 1,
      }),
    );
    return this.transaction(() => {
      if (this.active()) throw new AppError('focusActive', '已有专注记录，请先结束当前一轮。');
      if (
        Number(this.db.prepare('SELECT count(*) AS count FROM focus_sessions').get()?.count) >=
        focusLimits.sessions
      )
        throw new AppError('focusLimit', '专注记录达到当前上限（10000），请保留数据并检查备份。');
      const currentTask = this.db
        .prepare('SELECT revision, status FROM daily_tasks WHERE id = ?')
        .get(task.id);
      if (!currentTask || currentTask.revision !== task.revision || currentTask.status !== 'todo')
        throw new AppError('focusTaskConflict', '关联任务已更新、完成或删除，请重新加载后开始。');
      return decode(
        this.db
          .prepare(
            `INSERT INTO focus_sessions
             (id, task_id, task_revision, task_title, task_day, planned_minutes, elapsed_ms,
              status, reason, review, started_at, ended_at, updated_at, revision)
             VALUES (?, ?, ?, ?, ?, ?, 0, 'running', NULL, '', ?, NULL, ?, 1) RETURNING *`,
          )
          .get(
            session.id,
            session.taskId,
            session.taskRevision,
            session.taskTitle,
            session.taskDay,
            session.plannedMinutes,
            session.startedAt,
            session.updatedAt,
          )!,
      );
    });
  }

  save(current: FocusSession, next: FocusSession): FocusSession {
    const validated = decode(rowOf(next));
    if (
      current.id !== validated.id ||
      current.taskId !== validated.taskId ||
      current.taskRevision !== validated.taskRevision ||
      current.taskTitle !== validated.taskTitle ||
      current.taskDay !== validated.taskDay ||
      current.plannedMinutes !== validated.plannedMinutes ||
      current.startedAt !== validated.startedAt
    )
      throw new AppError('focusSnapshot', '不能修改专注记录的来源或开始信息。');
    return this.transaction(() => {
      const row = this.db
        .prepare(
          `UPDATE focus_sessions SET elapsed_ms = ?, status = ?, reason = ?, review = ?,
           ended_at = ?, updated_at = ?, revision = ?
           WHERE id = ? AND revision = ? AND status = ? AND elapsed_ms = ? RETURNING *`,
        )
        .get(
          validated.elapsedMs,
          validated.status,
          validated.reason,
          validated.review,
          validated.endedAt,
          validated.updatedAt,
          validated.revision,
          current.id,
          current.revision,
          current.status,
          current.elapsedMs,
        );
      if (!row) throw new AppError('focusConflict', '专注记录已更新，请重新加载后再操作。');
      return decode(row);
    });
  }
}
