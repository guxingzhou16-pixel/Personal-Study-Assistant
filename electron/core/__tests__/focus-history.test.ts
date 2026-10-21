import { randomUUID } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, expect, it } from 'vitest';
import type { FocusSession } from '../../../src/lib/types';
import { focusLimits } from '../../../src/lib/focus';
import { FocusTracker } from '../focus';
import { Storage } from '../storage';

const resources: Array<{ store: Storage; db: DatabaseSync }> = [];
afterEach(() => {
  resources.splice(0).forEach(({ store, db }) => {
    db.close();
    store.close();
  });
});

function setup() {
  const root = mkdtempSync(join(tmpdir(), 'study-focus-history-core-'));
  const path = join(root, 'study-companion.sqlite3');
  const store = new Storage(path);
  const db = new DatabaseSync(path);
  resources.push({ store, db });
  const task = store.planning.saveTask({
    id: null,
    revision: 0,
    title: '合成历史任务',
    details: '历史回归夹具，不表示实际学习或计满',
    day: '1999-12-31',
    minutes: 5,
    projectId: null,
  });
  function seed(overrides: Partial<FocusSession> = {}): FocusSession {
    const session: FocusSession = {
      id: randomUUID(),
      taskId: task.id,
      taskRevision: task.revision,
      taskTitle: task.title,
      taskDay: task.day,
      plannedMinutes: 5,
      elapsedMs: 1000,
      status: 'stopped',
      reason: 'user-stop',
      review: '',
      startedAt: '2026-10-06T10:00:00.000Z',
      endedAt: '2026-10-06T10:00:01.000Z',
      updatedAt: '2026-10-06T10:00:01.000Z',
      revision: 2,
      ...overrides,
    };
    if (overrides.endedAt === undefined) {
      session.endedAt =
        session.status === 'running' || session.status === 'paused'
          ? null
          : new Date(Date.parse(session.startedAt) + session.elapsedMs).toISOString();
    }
    if (overrides.updatedAt === undefined) session.updatedAt = session.endedAt ?? session.startedAt;
    db.prepare(
      `INSERT INTO focus_sessions
       (id, task_id, task_revision, task_title, task_day, planned_minutes, elapsed_ms,
        status, reason, review, started_at, ended_at, updated_at, revision)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      session.id,
      session.taskId,
      session.taskRevision,
      session.taskTitle,
      session.taskDay,
      session.plannedMinutes,
      session.elapsedMs,
      session.status,
      session.reason,
      session.review,
      session.startedAt,
      session.endedAt,
      session.updatedAt,
      session.revision,
    );
    return session;
  }
  return { store, db, task, seed };
}

function localDay(date: Date): string {
  return `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

it('filters by the current local start day, not task day or the day a session ended', () => {
  const { store, seed } = setup();
  const start = new Date(2026, 9, 6, 23, 59, 0);
  const end = new Date(2026, 9, 7, 0, 1, 0);
  const session = seed({
    startedAt: start.toISOString(),
    endedAt: end.toISOString(),
    updatedAt: end.toISOString(),
    elapsedMs: 120000,
  });
  expect(store.focus.history({ day: localDay(start), page: 1 }).sessions).toEqual([session]);
  expect(store.focus.history({ day: localDay(end), page: 1 }).sessions).toEqual([]);
  expect(store.focus.history({ day: session.taskDay, page: 1 }).total).toBe(0);
});

it.each(['running', 'paused'] as const)(
  'includes all terminal states and excludes %s without changing records',
  (status) => {
    const { store, seed } = setup();
    const stopped = seed();
    const completed = seed({ status: 'completed', reason: 'elapsed', elapsedMs: 300000 });
    const interrupted = seed({ status: 'interrupted', reason: 'sleep' });
    const active = seed({ status, reason: null, endedAt: null, revision: 1 });
    const before = store.focus.active();
    const page = store.focus.history({ day: null, page: 1 });
    expect(page.total).toBe(3);
    expect(new Set(page.sessions.map((item) => item.id))).toEqual(
      new Set([stopped.id, completed.id, interrupted.id]),
    );
    expect(store.focus.active()).toEqual(before);
    expect(store.focus.get(active.id)).toEqual(active);
  },
);

it('pages all records beyond recent twenty, with a stable id tie break and a clamped last page', () => {
  const { store, seed } = setup();
  const sessions = Array.from({ length: 45 }, (_, index) =>
    seed({
      id: `00000000-0000-4000-8000-${String(45 - index).padStart(12, '0')}`,
      startedAt: new Date(Date.UTC(2026, 9, 6, 10, Math.floor(index / 2))).toISOString(),
    }),
  );
  const expected = sessions.sort(
    (a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt) || a.id.localeCompare(b.id),
  );
  const first = store.focus.history({ day: null, page: 1 });
  const second = store.focus.history({ day: null, page: 2 });
  const last = store.focus.history({ day: null, page: 500 });
  expect(first).toMatchObject({ page: 1, pageSize: 20, total: 45 });
  expect(second.sessions).toEqual(expected.slice(20, 40));
  expect(last).toMatchObject({ page: 3, pageSize: 20, total: 45 });
  expect([...first.sessions, ...second.sessions, ...last.sessions]).toEqual(expected);
  expect(store.focus.history({ day: null, page: 2 })).toEqual(second);
  expect(store.focus.recent()).toHaveLength(focusLimits.recent);
  expect(store.focus.recent().some((item) => item.id === expected[44].id)).toBe(false);
});

it('sorts extended canonical ISO years by actual instants across the ordinary ISO year boundary', () => {
  const { store, seed } = setup();
  const previous = seed({
    startedAt: '9999-12-31T23:59:00.000Z',
    endedAt: '9999-12-31T23:59:01.000Z',
    updatedAt: '9999-12-31T23:59:01.000Z',
  });
  const next = seed({
    startedAt: '+010000-01-01T00:00:00.000Z',
    endedAt: '+010000-01-01T00:00:01.000Z',
    updatedAt: '+010000-01-01T00:00:01.000Z',
  });
  const ancient = seed({
    startedAt: '-000001-01-01T00:00:00.000Z',
    endedAt: '-000001-01-01T00:00:01.000Z',
    updatedAt: '-000001-01-01T00:00:01.000Z',
  });
  expect(store.focus.history({ day: null, page: 1 }).sessions.map((item) => item.id)).toEqual([
    next.id,
    previous.id,
    ancient.id,
  ]);
});

it('clamps an empty filter to page one and preserves its explicit date', () => {
  const { store, seed } = setup();
  seed();
  expect(store.focus.history({ day: '2000-01-01', page: 500 })).toEqual({
    day: '2000-01-01',
    page: 1,
    pageSize: 20,
    total: 0,
    sessions: [],
  });
});

it.each([
  null,
  [],
  {},
  { day: null },
  { page: 1 },
  { day: null, page: 0 },
  { day: null, page: -1 },
  { day: null, page: 501 },
  { day: null, page: 1.5 },
  { day: null, page: '1' },
  { day: null, page: Number.NaN },
  { day: null, page: Number.POSITIVE_INFINITY },
  { day: '', page: 1 },
  { day: '2026-02-29', page: 1 },
  { day: '2026-2-01', page: 1 },
  { day: '0000-01-01', page: 1 },
  { day: '10000-01-01', page: 1 },
  { day: '2026-10-06T00:00:00Z', page: 1 },
  { day: [], page: 1 },
  { day: null, page: 1, status: 'running' },
])('rejects malformed history query %j without changing persisted rows', (query) => {
  const { store, seed } = setup();
  const session = seed();
  expect(() => store.focus.history(query)).toThrow();
  expect(store.focus.get(session.id)).toEqual(session);
});

it('keeps an old review outside recent twenty, rejects stale review writes, and retains deleted task snapshots', () => {
  const { store, task, seed } = setup();
  const old = seed({ review: '旧复盘原文' });
  for (let index = 1; index <= 21; index++) {
    seed({ startedAt: new Date(Date.UTC(2026, 9, 7, 10, index)).toISOString() });
  }
  const tracker = new FocusTracker(store.focus, store.planning);
  expect(tracker.overview().recent.some((item) => item.id === old.id)).toBe(false);
  const saved = tracker.saveReview(old.id, old.revision, '修订旧复盘');
  expect(saved.session).toMatchObject({ id: old.id, review: '修订旧复盘', revision: 3 });
  expect(saved.overview.recent.some((item) => item.id === old.id)).toBe(false);
  expect(() => tracker.saveReview(old.id, old.revision, '过期草稿')).toThrow('未覆盖');
  store.planning.deleteTask(task.id, task.revision);
  expect(() => store.planning.getTask(task.id)).toThrow('不存在');
  expect(store.focus.get(old.id)).toEqual(saved.session);
  expect(store.focus.history({ day: null, page: 2 }).sessions).toContainEqual(saved.session);
});

it('reports corrupt canonical start timestamps rather than silently hiding a record', () => {
  const { store, db, seed } = setup();
  const session = seed();
  db.prepare('UPDATE focus_sessions SET started_at = ? WHERE id = ?').run(
    '2026-10-06T10:00:00Z',
    session.id,
  );
  expect(() => store.focus.history({ day: null, page: 1 })).toThrow('格式损坏');
});
