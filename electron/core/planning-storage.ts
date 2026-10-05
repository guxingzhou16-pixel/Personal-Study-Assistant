import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import type {
  DailyTask,
  PlanningOverview,
  ProjectDraft,
  StudyProject,
  TaskDraft,
} from '../../src/lib/types';
import { planningLimits, validPlanningDay } from '../../src/lib/planning';
import { AppError } from './errors';
import { record, string } from './settings';

export const PLANNING_MIGRATION = `
  CREATE TABLE study_projects (
    id TEXT PRIMARY KEY, title TEXT NOT NULL, goal TEXT NOT NULL,
    archived INTEGER NOT NULL CHECK(archived IN (0, 1)),
    revision INTEGER NOT NULL CHECK(revision > 0),
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  );
  CREATE INDEX study_projects_updated ON study_projects(archived, updated_at DESC);
  CREATE TABLE daily_tasks (
    id TEXT PRIMARY KEY, title TEXT NOT NULL, details TEXT NOT NULL,
    project_id TEXT REFERENCES study_projects(id) ON DELETE RESTRICT,
    day TEXT NOT NULL, minutes INTEGER NOT NULL CHECK(minutes BETWEEN 5 AND 480),
    status TEXT NOT NULL CHECK(status IN ('todo', 'completed')),
    completed_at TEXT, revision INTEGER NOT NULL CHECK(revision > 0),
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
    CHECK((status = 'todo' AND completed_at IS NULL) OR
      (status = 'completed' AND completed_at IS NOT NULL))
  );
  CREATE INDEX daily_tasks_day ON daily_tasks(day, status, created_at, id);
  CREATE INDEX daily_tasks_project ON daily_tasks(project_id);
  PRAGMA user_version = 9;
`;

export const TASK_ORIGIN_MIGRATION = `
  ALTER TABLE daily_tasks ADD COLUMN origin TEXT NOT NULL DEFAULT 'manual'
    CHECK(origin IN ('manual', 'learning-route'));
  ALTER TABLE daily_tasks ADD COLUMN origin_turn_id TEXT;
  ALTER TABLE daily_tasks ADD COLUMN origin_turn_revision INTEGER
    CHECK((origin = 'manual' AND origin_turn_id IS NULL AND origin_turn_revision IS NULL) OR
      (origin = 'learning-route' AND origin_turn_id IS NOT NULL AND
       origin_turn_revision IS NOT NULL AND origin_turn_revision > 0));
  PRAGMA user_version = 10;
`;

function planningId(input: unknown): string {
  if (typeof input !== 'string' || !/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(input))
    throw new AppError('planningId', '项目或任务标识无效，请重新加载。');
  return input;
}

function revision(input: unknown, minimum = 1): number {
  if (typeof input !== 'number' || !Number.isSafeInteger(input) || input < minimum)
    throw new AppError('planningRevision', '项目或任务版本无效，请重新加载。');
  return input;
}

function canIncrement(version: number): void {
  if (version === Number.MAX_SAFE_INTEGER)
    throw new AppError('planningRevision', '版本已达到上限，未执行修改。请保留数据并检查备份。');
}

function fields(input: unknown, allowed: string[]): Record<string, unknown> {
  const data = record(input);
  if (Object.keys(data).some((key) => !allowed.includes(key)))
    throw new AppError('validation', '项目或任务请求包含不支持的字段。');
  return data;
}

function text(input: unknown, label: string, limit: number, title = false): string {
  const value = string(input, label, limit);
  if (value.includes('\0') || (title && (!value || /[\r\n]/.test(value))))
    throw new AppError('planningContent', '请填写一行标题，内容不能包含空字符。');
  return value;
}

function projectDraft(data: Record<string, unknown>): ProjectDraft {
  if (typeof data.archived !== 'boolean')
    throw new AppError('planningArchived', '项目归档状态无效，请重新加载。');
  return {
    title: text(data.title, '项目标题', planningLimits.title, true),
    goal: text(data.goal, '学习目标', planningLimits.goal),
    archived: data.archived,
  };
}

function planningDay(input: unknown): string {
  if (!validPlanningDay(input))
    throw new AppError('planningDay', '请选择合法日期，格式为 YYYY-MM-DD。');
  return input;
}

function taskDraft(data: Record<string, unknown>): TaskDraft {
  if (
    typeof data.minutes !== 'number' ||
    !Number.isInteger(data.minutes) ||
    data.minutes < planningLimits.minMinutes ||
    data.minutes > planningLimits.maxMinutes
  )
    throw new AppError('planningMinutes', '任务预计时长应为 5 到 480 之间的整数分钟。');
  return {
    title: text(data.title, '任务标题', planningLimits.title, true),
    details: text(data.details, '任务说明', planningLimits.details),
    projectId: data.projectId === null ? null : planningId(data.projectId),
    day: planningDay(data.day),
    minutes: data.minutes,
  };
}

export function readTaskDraft(input: unknown): TaskDraft {
  return taskDraft(fields(input, ['title', 'details', 'projectId', 'day', 'minutes']));
}

function timestamp(input: unknown): string {
  if (typeof input !== 'string' || !Number.isFinite(Date.parse(input)))
    throw new Error('invalid timestamp');
  return input;
}

function decodeProject(row: Record<string, unknown>): StudyProject {
  try {
    if (row.archived !== 0 && row.archived !== 1) throw new Error('invalid archived state');
    return {
      ...projectDraft({ ...row, archived: row.archived === 1 }),
      id: planningId(row.id),
      revision: revision(row.revision),
      createdAt: timestamp(row.created_at),
      updatedAt: timestamp(row.updated_at),
    };
  } catch {
    throw new AppError('planningCorrupt', '项目数据格式损坏，请保留数据目录并检查备份。');
  }
}

function decodeTask(row: Record<string, unknown>): DailyTask {
  try {
    if (
      (row.status !== 'todo' && row.status !== 'completed') ||
      (row.status === 'todo' && row.completed_at !== null) ||
      (row.status === 'completed' && row.completed_at === null)
    )
      throw new Error('invalid completion state');
    if (
      (row.origin !== 'manual' && row.origin !== 'learning-route') ||
      (row.origin === 'manual' &&
        (row.origin_turn_id !== null || row.origin_turn_revision !== null))
    )
      throw new Error('invalid task origin');
    return {
      ...taskDraft({ ...row, projectId: row.project_id }),
      id: planningId(row.id),
      revision: revision(row.revision),
      status: row.status,
      completedAt: row.completed_at === null ? null : timestamp(row.completed_at),
      origin: row.origin,
      originTurnId: row.origin === 'manual' ? null : planningId(row.origin_turn_id),
      originTurnRevision: row.origin === 'manual' ? null : revision(row.origin_turn_revision),
      createdAt: timestamp(row.created_at),
      updatedAt: timestamp(row.updated_at),
    };
  } catch {
    throw new AppError('planningCorrupt', '任务数据格式损坏，请保留数据目录并检查备份。');
  }
}

export class PlanningStorage {
  constructor(private readonly db: DatabaseSync) {}

  overview(input: unknown): PlanningOverview {
    const day = planningDay(input);
    const projects = this.db
      .prepare('SELECT * FROM study_projects ORDER BY archived, updated_at DESC, id')
      .all()
      .map(decodeProject);
    const tasks = this.db
      .prepare(
        `SELECT * FROM daily_tasks WHERE day = ?
        ORDER BY CASE status WHEN 'todo' THEN 0 ELSE 1 END, created_at, id`,
      )
      .all(day)
      .map(decodeTask);
    const projectIds = new Set(projects.map((project) => project.id));
    if (tasks.some((task) => task.projectId !== null && !projectIds.has(task.projectId)))
      throw new AppError('planningCorrupt', '任务关联项目缺失，请保留数据目录并检查备份。');
    return { day, projects, tasks };
  }

  getProject(input: unknown): StudyProject {
    const row = this.db.prepare('SELECT * FROM study_projects WHERE id = ?').get(planningId(input));
    if (!row) throw new AppError('projectMissing', '项目不存在，请重新加载或解除关联。');
    return decodeProject(row);
  }

  private getTask(input: unknown): DailyTask {
    const row = this.db.prepare('SELECT * FROM daily_tasks WHERE id = ?').get(planningId(input));
    if (!row) throw new AppError('taskMissing', '任务已删除或不存在，请重新加载。');
    return decodeTask(row);
  }

  saveProject(input: unknown): StudyProject {
    const data = fields(input, ['id', 'revision', 'title', 'goal', 'archived']);
    const draft = projectDraft(data);
    const version = revision(data.revision, data.id === null ? 0 : 1);
    const now = new Date().toISOString();
    if (data.id === null) {
      if (version !== 0) throw new AppError('planningRevision', '新项目的初始版本须为 0。');
      if (
        Number(this.db.prepare('SELECT count(*) AS count FROM study_projects').get()?.count) >=
        planningLimits.projects
      )
        throw new AppError('projectLimit', '项目达到当前上限（200），归档项目仍保留并计入总数。');
      return decodeProject(
        this.db
          .prepare(
            `INSERT INTO study_projects
            (id, title, goal, archived, revision, created_at, updated_at)
            VALUES (?, ?, ?, ?, 1, ?, ?) RETURNING *`,
          )
          .get(randomUUID(), draft.title, draft.goal, Number(draft.archived), now, now)!,
      );
    }
    const id = planningId(data.id);
    const current = this.getProject(id);
    if (current.revision !== version)
      throw new AppError('projectConflict', '项目已更新，未覆盖新版本。请保留草稿并重新加载。');
    canIncrement(version);
    const row = this.db
      .prepare(
        `UPDATE study_projects SET title = ?, goal = ?, archived = ?,
        revision = revision + 1, updated_at = ? WHERE id = ? AND revision = ? RETURNING *`,
      )
      .get(draft.title, draft.goal, Number(draft.archived), now, id, version);
    if (!row) {
      this.getProject(id);
      throw new AppError('projectConflict', '项目已更新，未覆盖新版本。请保留草稿并重新加载。');
    }
    return decodeProject(row);
  }

  saveTask(input: unknown): DailyTask {
    const data = fields(input, [
      'id',
      'revision',
      'title',
      'details',
      'projectId',
      'day',
      'minutes',
    ]);
    const draft = taskDraft(data);
    const version = revision(data.revision, data.id === null ? 0 : 1);
    let current: DailyTask | null = null;
    if (data.id === null) {
      if (version !== 0) throw new AppError('planningRevision', '新任务的初始版本须为 0。');
    } else {
      current = this.getTask(data.id);
      if (current.revision !== version)
        throw new AppError('taskConflict', '任务已更新，未覆盖新版本。请保留草稿并重新加载。');
      canIncrement(version);
    }
    if (draft.projectId !== null) {
      const project = this.getProject(draft.projectId);
      if (project.archived && current?.projectId !== project.id)
        throw new AppError('projectArchived', '不能新增关联到归档项目，请恢复项目或重新选择。');
    }
    const values = [draft.title, draft.details, draft.projectId, draft.day, draft.minutes];
    const now = new Date().toISOString();
    if (current === null) {
      if (
        Number(this.db.prepare('SELECT count(*) AS count FROM daily_tasks').get()?.count) >=
        planningLimits.tasks
      )
        throw new AppError('taskLimit', '任务达到当前上限（5000），请整理并删除不再需要的任务。');
      return decodeTask(
        this.db
          .prepare(
            `INSERT INTO daily_tasks
            (id, title, details, project_id, day, minutes, status, completed_at,
             revision, created_at, updated_at, origin, origin_turn_id, origin_turn_revision)
            VALUES (?, ?, ?, ?, ?, ?, 'todo', NULL, 1, ?, ?, 'manual', NULL, NULL) RETURNING *`,
          )
          .get(randomUUID(), ...values, now, now)!,
      );
    }
    const row = this.db
      .prepare(
        `UPDATE daily_tasks SET title = ?, details = ?, project_id = ?, day = ?, minutes = ?,
        revision = revision + 1, updated_at = ? WHERE id = ? AND revision = ? RETURNING *`,
      )
      .get(...values, now, current.id, version);
    if (!row) {
      this.getTask(current.id);
      throw new AppError('taskConflict', '任务已更新，未覆盖新版本。请保留草稿并重新加载。');
    }
    return decodeTask(row);
  }

  createFromProposal(
    input: TaskDraft,
    projectSnapshot: StudyProject | null,
    origin: { turnId: string; turnRevision: number },
  ): DailyTask {
    const draft = readTaskDraft(input);
    const turnId = planningId(origin.turnId);
    const turnRevision = revision(origin.turnRevision);
    this.db.exec('BEGIN IMMEDIATE;');
    try {
      if (draft.projectId !== (projectSnapshot?.id ?? null))
        throw new AppError('taskProposalProject', '任务关联项目与预览不一致，请重新预览。');
      if (projectSnapshot !== null) {
        const project = this.getProject(projectSnapshot.id);
        if (project.archived || JSON.stringify(project) !== JSON.stringify(projectSnapshot))
          throw new AppError('taskProposalProject', '关联项目已更新或归档，请重新预览任务提议。');
      }
      if (
        Number(this.db.prepare('SELECT count(*) AS count FROM daily_tasks').get()?.count) >=
        planningLimits.tasks
      )
        throw new AppError('taskLimit', '任务达到当前上限（5000），请整理并删除不再需要的任务。');
      const now = new Date().toISOString();
      const task = decodeTask(
        this.db
          .prepare(
            `INSERT INTO daily_tasks
            (id, title, details, project_id, day, minutes, status, completed_at,
             revision, created_at, updated_at, origin, origin_turn_id, origin_turn_revision)
            VALUES (?, ?, ?, ?, ?, ?, 'todo', NULL, 1, ?, ?, 'learning-route', ?, ?) RETURNING *`,
          )
          .get(
            randomUUID(),
            draft.title,
            draft.details,
            draft.projectId,
            draft.day,
            draft.minutes,
            now,
            now,
            turnId,
            turnRevision,
          )!,
      );
      this.db.exec('COMMIT;');
      return task;
    } catch (error) {
      try {
        this.db.exec('ROLLBACK;');
      } catch {
        // SQLite may already have rolled back; keep the original write failure.
      }
      throw error;
    }
  }

  setCompleted(input: unknown, revisionInput: unknown, completed: unknown): DailyTask {
    const id = planningId(input);
    const version = revision(revisionInput);
    if (typeof completed !== 'boolean')
      throw new AppError('planningCompleted', '任务完成状态无效，请重新加载。');
    const current = this.getTask(id);
    if (current.revision !== version)
      throw new AppError('taskConflict', '任务已更新，未修改完成状态。请重新加载后再确认。');
    const status = completed ? 'completed' : 'todo';
    if (current.status === status) return current;
    canIncrement(version);
    const now = new Date().toISOString();
    const row = this.db
      .prepare(
        `UPDATE daily_tasks SET status = ?, completed_at = ?, revision = revision + 1,
        updated_at = ? WHERE id = ? AND revision = ? RETURNING *`,
      )
      .get(status, completed ? now : null, now, id, version);
    if (!row) {
      this.getTask(id);
      throw new AppError('taskConflict', '任务已更新，未修改完成状态。请重新加载后再确认。');
    }
    return decodeTask(row);
  }

  deleteTask(input: unknown, revisionInput: unknown): void {
    const id = planningId(input);
    const version = revision(revisionInput);
    if (this.getTask(id).revision !== version)
      throw new AppError('taskConflict', '任务已更新，未删除。请重新加载后再确认。');
    const result = this.db
      .prepare('DELETE FROM daily_tasks WHERE id = ? AND revision = ?')
      .run(id, version);
    if (!result.changes) {
      this.getTask(id);
      throw new AppError('taskConflict', '任务已更新，未删除。请重新加载后再确认。');
    }
  }
}
