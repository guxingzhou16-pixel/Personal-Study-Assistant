import { afterEach, expect, it, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Storage } from './storage';
import { TaskProposalService } from './task-proposals';
import { fixtureTurn, fixtureRequest } from '../../tests/fixtures/legacy-databases';
import type { LearningPlan } from '../../src/lib/types';

const stores: Storage[] = [];
afterEach(() => {
  vi.restoreAllMocks();
  stores.splice(0).forEach((store) => store.close());
});
const plan: LearningPlan = {
  limitations: '缺少底层实现原文，不作实现保证。',
  steps: [5, 10, 15].map((minutes, index) => ({
    title: `步骤${index + 1}`,
    action: '读原文、写自己的例子并求证',
    minutes,
    citations: [1],
    artifact: '一份用户笔记',
  })),
};
const day = '2026-10-13';
function setup(file = false, legacy = false) {
  const path = file
    ? join(mkdtempSync(join(tmpdir(), 'study-task-batch-')), 'main.sqlite3')
    : ':memory:';
  const store = new Storage(path);
  stores.push(store);
  const conversation = store.chat.createLearningConversation();
  const turn = fixtureTurn(conversation.id, {
    learningRequest: legacy
      ? fixtureRequest
      : { ...fixtureRequest, format: 'steps-v1', minutes: 30 },
    answer: legacy ? '### 阅读与求证\n30分钟阅读。[1]' : JSON.stringify(plan),
  });
  store.chat.addTurn(turn);
  const service = new TaskProposalService(store);
  const request = { plan, indices: [0, 2], day, projectId: null };
  return { store, turn, service, request, path };
}
it('previews exact edited steps with original sources, cancel writes nothing, confirm saves all todo tasks once', () => {
  const { store, turn, service, request } = setup();
  const edited = structuredClone(plan);
  edited.steps[0].title = '我的阅读步骤';
  const first = service.prepareBatch(turn.id, { ...request, plan: edited });
  expect(first.tasks.map((task) => task.title)).toEqual(['我的阅读步骤', '步骤3']);
  expect(first.tasks[0].details).toContain('study-companion://source/');
  expect(store.planning.overview(day).tasks).toEqual([]);
  service.discard(first.id);
  expect(() => service.confirmBatch(first.id)).toThrow('取消');
  const second = service.prepareBatch(turn.id, { ...request, plan: edited });
  expect(() => service.confirm(second.id)).toThrow();
  const saved = service.confirmBatch(second.id);
  expect(saved).toHaveLength(2);
  saved.forEach((task, index) => {
    expect(task).toMatchObject({
      ...second.tasks[index],
      origin: 'learning-route',
      originTurnId: turn.id,
      originTurnRevision: turn.revision,
      status: 'todo',
      completedAt: null,
    });
  });
  expect(() => service.confirmBatch(second.id)).toThrow('确认');
  expect(store.planning.overview(day).tasks).toHaveLength(2);
  expect(store.memories.list()).toEqual([]);
});
it('invalidates re-previews and refuses stale route or archived project before any write', () => {
  const { store, turn, service, request } = setup();
  const old = service.prepareBatch(turn.id, request);
  const updated = service.prepareBatch(turn.id, request);
  expect(() => service.confirmBatch(old.id)).toThrow();
  store.chat.saveTurn({ ...turn, revision: turn.revision + 1 });
  expect(() => service.confirmBatch(updated.id)).toThrow('变化');
  const project = store.planning.saveProject({
    id: null,
    revision: 0,
    title: '事务学习',
    goal: '先求证',
    archived: false,
  });
  const preview = service.prepareBatch(turn.id, { ...request, projectId: project.id });
  store.planning.saveProject({
    id: project.id,
    revision: project.revision,
    title: project.title,
    goal: project.goal,
    archived: true,
  });
  expect(() => service.confirmBatch(preview.id)).toThrow('归档');
  expect(store.planning.overview(day).tasks).toEqual([]);
});
it.each([
  { indices: [0, 0] },
  { indices: [3] },
  { indices: [] },
  { plan: { ...plan, steps: plan.steps.map((step) => ({ ...step, citations: [99] })) } },
  { plan: { ...plan, steps: plan.steps.map((step) => ({ ...step, minutes: 5 })) } },
  { tool: 'createTask' },
  { status: 'completed' },
])('rejects invalid edits and forged execution metadata: %j', (edit) => {
  const { store, turn, service, request } = setup();
  expect(() => service.prepareBatch(turn.id, { ...request, ...edit })).toThrow();
  expect(store.planning.overview(day).tasks).toEqual([]);
});
it('rolls back all inserts when a later task fails and keeps the same preview for an explicit retry', () => {
  const { store, turn, service, request, path } = setup(true);
  const preview = service.prepareBatch(turn.id, { ...request, indices: [0, 1] });
  const db = new DatabaseSync(path);
  try {
    db.exec(
      "CREATE TRIGGER test_batch_failure BEFORE INSERT ON daily_tasks WHEN NEW.title = '步骤2' BEGIN SELECT RAISE(ABORT, 'injected second insert failure'); END;",
    );
    expect(() => service.confirmBatch(preview.id)).toThrow('injected second insert failure');
    expect(store.planning.overview(day).tasks).toEqual([]);
    db.exec('DROP TRIGGER test_batch_failure;');
    expect(service.confirmBatch(preview.id)).toHaveLength(2);
  } finally {
    db.close();
  }
});
it('keeps historical Markdown single proposals usable without converting them into a checked batch', () => {
  const { turn, service, request } = setup(false, true);
  expect(service.prepare(turn.id, { day, projectId: null }).draft.title).toContain('学习：');
  expect(() => service.prepareBatch(turn.id, request)).toThrow('JSON');
});
it('refuses an expired batch preview without writing tasks', () => {
  const { store, turn, service, request } = setup();
  const preview = service.prepareBatch(turn.id, request);
  vi.spyOn(Date, 'now').mockReturnValue(Date.parse(preview.expiresAt) + 1);
  expect(() => service.confirmBatch(preview.id)).toThrow('过期');
  expect(store.planning.overview(day).tasks).toEqual([]);
});
it('checks remaining capacity for the entire batch before inserting any selected step', () => {
  const { store, turn, service, request } = setup();
  for (let index = 0; index < 4999; index++)
    store.planning.saveTask({
      id: null,
      revision: 0,
      title: '合成占位任务',
      details: '',
      day,
      minutes: 5,
      projectId: null,
    });
  const preview = service.prepareBatch(turn.id, request);
  expect(() => service.confirmBatch(preview.id)).toThrow('5000');
  expect(store.planning.overview(day).tasks).toHaveLength(4999);
});
