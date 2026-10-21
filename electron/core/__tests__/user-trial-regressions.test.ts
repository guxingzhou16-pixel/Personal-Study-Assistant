import { afterEach, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { Storage } from '../storage';
import { parseMarkdown } from '../document-parser';
import { retrieve } from '../retrieval';
import { retrieveHybrid } from '../vector-retrieval';
import { TaskProposalService } from '../task-proposals';
import { fixtureTurn } from '../../../tests/fixtures/legacy-databases';
import type { EmbeddingEncoder } from '../embeddings';

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});
function root() {
  const directory = mkdtempSync(join(tmpdir(), 'study-trial-fix-'));
  directories.push(directory);
  return directory;
}
function recallFixture() {
  const directory = root(),
    main = join(directory, 'main.sqlite3'),
    index = join(directory, 'index.sqlite3');
  const body = '# 主动回忆\n\n主动回忆是先合上资料，用自己的话写下要点，再打开原文核对。';
  const id = createHash('sha256').update(body).digest('hex');
  const store = new Storage(main);
  store.addSource({
    id,
    name: '学习方法',
    kind: 'markdown',
    bytes: Buffer.byteLength(body),
    ...parseMarkdown(Buffer.from(body)),
  });
  store.close();
  return { main, index, id };
}

const casualQuestions = [
  '请用 demo 解释主动回忆',
  '请帮我 review 一下主动回忆',
  '解释主动回忆，给个例子',
  '用 example 说明主动回忆',
  '请 summarize 主动回忆',
  '请用 DEMO 解释主动回忆',
  '请 Describe 主动回忆',
  '请 Suggest 主动回忆',
];
it.each(
  casualQuestions.flatMap((question) => ['keyword', 'hybrid'].map((mode) => ({ question, mode }))),
)(
  'keeps $mode evidence for an ordinary request expression: $question',
  async ({ question, mode }) => {
    const { main, index, id } = recallFixture();
    const encoder: EmbeddingEncoder = {
      id: 'trial-query-fixture',
      dimensions: 3,
      embed: async (texts) => texts.map(() => Float32Array.of(1, 0, 0)),
      dispose: async () => {},
    };
    const result =
      mode === 'keyword'
        ? retrieve(main, index, question, id)
        : await retrieveHybrid(main, index, question, id, false, () => {}, encoder);
    expect(result.hits.length).toBeGreaterThan(0);
    expect(result.hits.every((hit) => hit.sourceId === id && hit.text.includes('主动回忆'))).toBe(
      true,
    );
    if (mode === 'hybrid') expect(result.notice).toContain('混合检索');
  },
);

it('keeps route preview order in storage and after reopening even when UUIDs sort in reverse', () => {
  const path = join(root(), 'main.sqlite3');
  let store = new Storage(path);
  try {
    const conversation = store.chat.createLearningConversation();
    const plan = {
      limitations: '',
      steps: [
        {
          title: '先阅读原子性定义',
          action: '阅读定义',
          artifact: '标记原文',
          minutes: 5,
          citations: [1],
        },
        {
          title: '再准备解释案例',
          action: '准备案例',
          artifact: '写出解释',
          minutes: 5,
          citations: [1],
        },
      ],
    };
    const turn = fixtureTurn(conversation.id, {
      learningRequest: {
        goal: '理解事务',
        query: '事务',
        minutes: 10,
        sourceId: null,
        format: 'steps-v1',
      },
      answer: JSON.stringify(plan),
    });
    store.chat.addTurn(turn);
    const service = new TaskProposalService(store);
    const proposal = service.prepareBatch(turn.id, {
      plan,
      indices: [0, 1],
      day: '2026-10-16',
      projectId: null,
    });
    const saved = service.confirmBatch(proposal.id);
    expect(saved.map((task) => task.title)).toEqual(proposal.tasks.map((task) => task.title));
    expect(saved[0].createdAt).toBe(saved[1].createdAt);
    const db = new DatabaseSync(path);
    try {
      const change = db.prepare('UPDATE daily_tasks SET id=? WHERE id=?');
      change.run('ffffffff-ffff-ffff-ffff-ffffffffffff', saved[0].id);
      change.run('11111111-1111-1111-1111-111111111111', saved[1].id);
    } finally {
      db.close();
    }
    expect(store.planning.overview('2026-10-16').tasks.map((task) => task.title)).toEqual(
      plan.steps.map((step) => step.title),
    );
    store.close();
    store = new Storage(path);
    expect(store.planning.overview('2026-10-16').tasks.map((task) => task.title)).toEqual(
      plan.steps.map((step) => step.title),
    );
  } finally {
    store.close();
  }
});
