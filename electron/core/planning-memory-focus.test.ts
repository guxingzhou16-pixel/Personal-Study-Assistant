import { afterEach, expect, it, vi } from 'vitest';
import { Storage } from './storage';
import { FocusTracker } from './focus';
import { MemoryProposalService } from './memory-proposals';
import { TaskProposalService } from './task-proposals';
import { validPlanningDay } from '../../src/lib/planning';
import { fixtureTurn, fixtureRequest } from '../../tests/fixtures/legacy-databases';

const stores: Storage[] = [];
afterEach(() => {
  vi.restoreAllMocks();
  stores.splice(0).forEach((store) => store.close());
});
function setup() {
  const store = new Storage(':memory:');
  stores.push(store);
  return store;
}
const memoryDraft = {
  id: null,
  revision: 0,
  title: '学习偏好',
  content: '先阅读\n再练习',
  kind: 'preference',
  scope: 'local',
};
const projectDraft = { id: null, revision: 0, title: '数据库', goal: '理解事务', archived: false };
const taskDraft = {
  id: null,
  revision: 0,
  title: '验证事务',
  details: '先读\n再练习',
  projectId: null,
  day: '2026-10-08',
  minutes: 25,
};
function savedRoute(store: Storage) {
  const conversation = store.chat.createLearningConversation();
  const turn = fixtureTurn(conversation.id, { learningRequest: fixtureRequest });
  store.chat.addTurn(turn);
  return turn;
}

it('preserves memory provenance, rejects stale writes/deletes, and invalidates deleted or changed selection', () => {
  const store = setup();
  const memory = store.memories.save(memoryDraft);
  expect(memory).toMatchObject({ origin: 'manual', originTurnId: null, revision: 1 });
  const selection = store.memories.select([memory.id], 'http://127.0.0.1:11434');
  const updated = store.memories.save({
    ...memoryDraft,
    id: memory.id,
    revision: memory.revision,
    title: '新偏好',
  });
  expect(updated.createdAt).toBe(memory.createdAt);
  expect(() => store.memories.verify(selection, 'http://localhost:11434')).toThrow('变化');
  expect(() => store.memories.save({ ...memoryDraft, id: memory.id, revision: 1 })).toThrow(
    '未覆盖',
  );
  expect(() => store.memories.delete(memory.id, 1)).toThrow('未删除');
  store.memories.delete(memory.id, 2);
  expect(store.memories.list()).toEqual([]);
  expect(() => store.memories.select([memory.id], 'http://localhost:11434')).toThrow('不存在');
});
it.each([null, 'REMOTE', '', 1, {}, []])(
  'rejects invalid memory scope %j before any write',
  (scope) => {
    const store = setup();
    expect(() => store.memories.save({ ...memoryDraft, scope })).toThrow();
    expect(store.memories.list()).toEqual([]);
  },
);
it('enforces memory limits, missing fields, NUL, provenance and loopback-only scope', () => {
  const store = setup();
  for (const edit of [
    { title: '' },
    { title: 'x'.repeat(101) },
    { content: 'x'.repeat(1001) },
    { title: 'line\nbreak' },
    { content: 'x\0' },
    { origin: 'learning-route' },
    { revision: 0.1 },
    { id: 'invalid' },
  ])
    expect(() => store.memories.save({ ...memoryDraft, ...edit })).toThrow();
  const local = store.memories.save({
    ...memoryDraft,
    title: 'x'.repeat(100),
    content: 'x'.repeat(1000),
  });
  for (const endpoint of ['http://localhost:11434', 'http://127.0.0.1:11434', 'http://[::1]:11434'])
    expect(store.memories.select([local.id], endpoint)).toHaveLength(1);
  for (const endpoint of [
    'https://example.test',
    'https://localhost.example.test',
    'http://127.0.0.2:11434',
  ])
    expect(() => store.memories.select([local.id], endpoint)).toThrow();
  expect(() => store.memories.select([local.id, local.id], 'http://localhost:11434')).toThrow();
  expect(() => store.memories.select(Array(6).fill(local.id), 'http://localhost:11434')).toThrow();
  const disabled = store.memories.save({ ...memoryDraft, scope: 'disabled' });
  expect(() => store.memories.select([disabled.id], 'http://localhost')).toThrow();
  const remote = store.memories.save({ ...memoryDraft, scope: 'remote' });
  expect(store.memories.select([remote.id], 'https://example.test')).toHaveLength(1);
  for (let i = 3; i < 500; i++) store.memories.save(memoryDraft);
  expect(() => store.memories.save(memoryDraft)).toThrow('500');
  expect(store.memories.list()).toHaveLength(500);
  expect(store.memories.save({ ...memoryDraft, id: local.id, revision: 1 }).revision).toBe(2);
});
it('requires single explicit memory/task confirmation, expires previews and preserves source after route deletion', () => {
  const store = setup();
  const turn = savedRoute(store);
  const memories = new MemoryProposalService(store);
  const tasks = new TaskProposalService(store);
  const first = memories.prepare(turn.id);
  const second = memories.prepare(turn.id);
  expect(() => memories.confirm(first.id)).toThrow();
  expect(store.memories.list()).toEqual([]);
  const memory = memories.confirm(second.id);
  expect(memory).toMatchObject({
    origin: 'learning-route',
    originTurnId: turn.id,
    content: fixtureRequest.goal,
  });
  expect(() => memories.confirm(second.id)).toThrow();
  const taskPreview = tasks.prepare(turn.id, { day: taskDraft.day, projectId: null });
  expect(store.planning.overview(taskDraft.day).tasks).toEqual([]);
  const task = tasks.confirm(taskPreview.id);
  expect(task).toMatchObject({
    status: 'todo',
    completedAt: null,
    origin: 'learning-route',
    originTurnId: turn.id,
    originTurnRevision: turn.revision,
  });
  expect(() => tasks.confirm(taskPreview.id)).toThrow();
  const discarded = tasks.prepare(turn.id, { day: taskDraft.day, projectId: null });
  tasks.discard(discarded.id);
  tasks.discard(discarded.id);
  expect(() => tasks.confirm(discarded.id)).toThrow();
  const expires = memories.prepare(turn.id);
  const now = Date.now();
  vi.spyOn(Date, 'now').mockReturnValue(now + 600_001);
  expect(() => memories.confirm(expires.id)).toThrow();
  vi.restoreAllMocks();
  const pending = tasks.prepare(turn.id, { day: taskDraft.day, projectId: null });
  store.chat.deleteLearningTurn(turn.id);
  expect(() => tasks.confirm(pending.id)).toThrow();
  expect(store.planning.getTask(task.id)).toEqual(task);
  expect(store.memories.get(memory.id)).toEqual(memory);
});
it.each(['stopped', 'error', 'interrupted', 'streaming'] as const)(
  'refuses %s routes as memory/task provenance',
  (status) => {
    const store = setup();
    const turn = savedRoute(store);
    store.chat.saveTurn({ ...turn, status });
    expect(() => new MemoryProposalService(store).prepare(turn.id)).toThrow();
    expect(() =>
      new TaskProposalService(store).prepare(turn.id, { day: taskDraft.day, projectId: null }),
    ).toThrow();
  },
);
it('rechecks source revision and project snapshot at confirmation and retains a failed preview for retry', () => {
  const store = setup();
  const turn = savedRoute(store);
  const project = store.planning.saveProject(projectDraft);
  const tasks = new TaskProposalService(store);
  const old = tasks.prepare(turn.id, { day: taskDraft.day, projectId: project.id });
  store.planning.saveProject({ ...projectDraft, id: project.id, revision: 1, archived: true });
  expect(() => tasks.confirm(old.id)).toThrow();
  expect(store.planning.overview(taskDraft.day).tasks).toEqual([]);
  const preview = tasks.prepare(turn.id, { day: taskDraft.day, projectId: null });
  const create = vi.spyOn(store.planning, 'createFromProposal').mockImplementation(() => {
    throw new Error('injected write failure');
  });
  expect(() => tasks.confirm(preview.id)).toThrow('write failure');
  expect(store.planning.overview(taskDraft.day).tasks).toEqual([]);
  create.mockRestore();
  expect(tasks.confirm(preview.id).title).toContain('学习：');
  const sourceChange = tasks.prepare(turn.id, { day: taskDraft.day, projectId: null });
  store.chat.saveTurn({ ...turn, revision: turn.revision + 1 });
  expect(() => tasks.confirm(sourceChange.id)).toThrow('变化');
});
it('preserves task completion, source, date and archived associations while guarding revision', () => {
  const store = setup();
  const project = store.planning.saveProject(projectDraft);
  const task = store.planning.saveTask({ ...taskDraft, projectId: project.id });
  store.planning.saveProject({ ...projectDraft, id: project.id, revision: 1, archived: true });
  expect(() => store.planning.saveTask({ ...taskDraft, projectId: project.id })).toThrow('归档');
  const completed = store.planning.setCompleted(task.id, 1, true);
  expect(completed.completedAt).toBeTruthy();
  expect(store.planning.setCompleted(task.id, 2, true)).toEqual(completed);
  expect(() => store.planning.setCompleted(task.id, 1, true)).toThrow();
  const changed = store.planning.saveTask({
    ...taskDraft,
    id: task.id,
    revision: 2,
    projectId: project.id,
    day: '0099-02-28',
  });
  expect(changed).toMatchObject({
    status: 'completed',
    completedAt: completed.completedAt,
    createdAt: task.createdAt,
    origin: 'manual',
  });
  expect(store.planning.overview(task.day).tasks).toEqual([]);
  expect(store.planning.overview(changed.day).tasks).toEqual([changed]);
  const reopened = store.planning.setCompleted(task.id, 3, false);
  expect(reopened.completedAt).toBeNull();
  expect(() => store.planning.deleteTask(task.id, 3)).toThrow();
  store.planning.deleteTask(task.id, 4);
  expect(store.planning.overview(changed.day).tasks).toEqual([]);
});
it.each(['0001-01-01', '0099-12-31', '2000-02-29', '9999-12-31'])(
  'accepts exact valid planning day %s',
  (day) => {
    const store = setup();
    expect(validPlanningDay(day)).toBe(true);
    expect(store.planning.saveTask({ ...taskDraft, day }).day).toBe(day);
  },
);
it.each([
  '0000-01-01',
  '1900-02-29',
  '2026-02-30',
  '2026-13-01',
  '2026-1-01',
  '2026-10-08T00:00:00Z',
])('refuses invalid planning day %s', (day) => {
  const store = setup();
  expect(validPlanningDay(day)).toBe(false);
  expect(() => store.planning.overview(day)).toThrow();
  expect(() => store.planning.saveTask({ ...taskDraft, day })).toThrow();
});
it('enforces project/task limits and refuses forged status/provenance/estimated time before mutation', () => {
  const store = setup();
  for (const edit of [
    { minutes: 4 },
    { minutes: 481 },
    { minutes: 5.5 },
    { minutes: NaN },
    { minutes: Infinity },
    { title: '' },
    { title: 'x'.repeat(121) },
    { details: 'x'.repeat(4001) },
    { status: 'completed' },
    { origin: 'learning-route' },
    { completedAt: 'now' },
  ])
    expect(() => store.planning.saveTask({ ...taskDraft, ...edit })).toThrow();
  const first = store.planning.saveTask({
    ...taskDraft,
    minutes: 5,
    title: 'x'.repeat(120),
    details: 'x'.repeat(4000),
  });
  expect(store.planning.saveTask({ ...taskDraft, minutes: 480 })).toMatchObject({ minutes: 480 });
  for (let i = 0; i < 200; i++) store.planning.saveProject(projectDraft);
  expect(() => store.planning.saveProject(projectDraft)).toThrow('200');
  for (let i = 2; i < 5000; i++) store.planning.saveTask(taskDraft);
  expect(() => store.planning.saveTask(taskDraft)).toThrow('5000');
  expect(store.planning.saveTask({ ...taskDraft, id: first.id, revision: 1 }).revision).toBe(2);
});
function clock() {
  const store = setup();
  let tick = 0;
  let wall = Date.parse('2026-10-08T00:00:00Z');
  const tracker = new FocusTracker(
    store.focus,
    store.planning,
    () => new Date(wall),
    () => tick,
  );
  const task = store.planning.saveTask(taskDraft);
  return {
    store,
    tracker,
    task,
    advance: (ms: number) => {
      tick += ms;
      wall += ms;
    },
    wall: (ms: number) => {
      wall += ms;
    },
  };
}
it('completes only reliable elapsed time, preserves control revision on heartbeats and never completes a task', () => {
  const { store, tracker, task, advance, wall } = clock();
  const start = tracker.start({ taskId: task.id, taskRevision: 1, minutes: 5 }).current!;
  expect(() => tracker.start({ taskId: task.id, taskRevision: 1, minutes: 5 })).toThrow();
  wall(-86_400_000);
  for (let i = 0; i < 9; i++) {
    advance(30_000);
    tracker.checkpoint();
    expect(tracker.overview().current!.revision).toBe(1);
  }
  advance(30_000);
  tracker.checkpoint();
  const session = store.focus.get(start.id);
  expect(session).toMatchObject({
    status: 'completed',
    reason: 'elapsed',
    elapsedMs: 300000,
    revision: 2,
  });
  expect(tracker.overview().current).toBeNull();
  expect(store.planning.getTask(task.id)).toEqual(task);
  const review = tracker.saveReview(session.id, 2, '复盘');
  expect(review.session).toMatchObject({ review: '复盘', elapsedMs: 300000, revision: 3 });
  expect(() => tracker.saveReview(session.id, 2, '旧稿')).toThrow();
});
it('pauses/resumes exactly and interrupts a heartbeat gap instead of inferring completion', () => {
  const { tracker, task, advance, store } = clock();
  const first = tracker.start({ taskId: task.id, taskRevision: 1, minutes: 5 }).current!;
  advance(1234);
  let current = tracker.control(first.id, 1, 'pause').current!;
  expect(current.elapsedMs).toBe(1234);
  advance(200000);
  expect(tracker.overview().current!.elapsedMs).toBe(1234);
  expect(() => tracker.start({ taskId: task.id, taskRevision: 1, minutes: 5 })).toThrow();
  current = tracker.control(first.id, current.revision, 'resume').current!;
  advance(30001);
  tracker.checkpoint();
  expect(store.focus.get(first.id)).toMatchObject({
    status: 'interrupted',
    reason: 'heartbeat-gap',
    elapsedMs: 1234,
  });
  expect(() => tracker.control(first.id, current.revision, 'resume')).toThrow();
});
it.each(['sleep', 'app-exit', 'renderer-reload'] as const)(
  'interrupts %s and startup without adding uncommitted tail time',
  (reason) => {
    const { tracker, store, task, advance } = clock();
    const first = tracker.start({ taskId: task.id, taskRevision: 1, minutes: 25 }).current!;
    advance(1000);
    tracker.checkpoint();
    advance(999);
    tracker.interrupt(reason);
    expect(store.focus.get(first.id)).toMatchObject({
      status: 'interrupted',
      reason,
      elapsedMs: 1000,
    });
    const second = tracker.start({ taskId: task.id, taskRevision: 1, minutes: 25 }).current!;
    tracker.control(second.id, 1, 'pause');
    const reopened = new FocusTracker(store.focus, store.planning);
    expect(reopened.overview().current).toBeNull();
    expect(store.focus.get(second.id)).toMatchObject({
      status: 'interrupted',
      reason: 'app-restart',
      elapsedMs: 0,
    });
  },
);
it('freezes at the last durable checkpoint after storage failure and cannot start until interrupted state is saved', () => {
  const { tracker, store, task, advance } = clock();
  const first = tracker.start({ taskId: task.id, taskRevision: 1, minutes: 5 }).current!;
  advance(1000);
  tracker.checkpoint();
  const save = vi.spyOn(store.focus, 'save').mockImplementation(() => {
    throw new Error('disk failure');
  });
  advance(1000);
  expect(() => tracker.checkpoint()).toThrow('停止计时');
  advance(400000);
  expect(() => tracker.start({ taskId: task.id, taskRevision: 1, minutes: 5 })).toThrow();
  expect(store.focus.get(first.id).elapsedMs).toBe(1000);
  save.mockRestore();
  expect(tracker.overview().current).toBeNull();
  expect(store.focus.get(first.id)).toMatchObject({
    status: 'interrupted',
    reason: 'storage-error',
    elapsedMs: 1000,
  });
});
it('rejects stale/completed tasks and forged focus inputs without creating sessions', () => {
  const { tracker, store, task } = clock();
  for (const edit of [
    { minutes: 4 },
    { minutes: 121 },
    { minutes: 5.5 },
    { elapsedMs: 10 },
    { status: 'completed' },
    { taskRevision: 0 },
    { taskId: 'invalid' },
  ])
    expect(() =>
      tracker.start({ taskId: task.id, taskRevision: 1, minutes: 5, ...edit }),
    ).toThrow();
  store.planning.setCompleted(task.id, 1, true);
  expect(() => tracker.start({ taskId: task.id, taskRevision: 1, minutes: 5 })).toThrow();
  expect(tracker.overview().recent).toEqual([]);
});
