import { afterEach, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import type { Node, Parent } from 'unist';
import { Storage } from '../storage';
import { HistoryService } from '../history';
import { MemoryProposalService } from '../memory-proposals';
import { historyMarkdown } from '../history-markdown';
import { emptyNoteDraft } from '../../../src/lib/notes';
import {
  fixtureEvidence,
  fixtureRequest,
  fixtureMemory,
} from '../../../tests/fixtures/legacy-databases';
import type { ChatTurn } from '../../../src/lib/types';
const stores: Storage[] = [];
afterEach(() => {
  for (const store of stores.splice(0)) store.close();
});
function setup() {
  const store = new Storage(':memory:');
  stores.push(store);
  let active: ChatTurn | null = null;
  const service = new HistoryService(store.chat, () => active);
  return {
    store,
    service,
    setActive: (turn: ChatTurn | null) => {
      active = turn;
    },
  };
}
function turn(conversationId: string, edit: Partial<ChatTurn> = {}): ChatTurn {
  return {
    id: randomUUID(),
    conversationId,
    question: '事务是什么',
    answer: '全部提交或回滚。[1]',
    status: 'completed',
    notice: '',
    provider: 'ollama',
    baseUrl: 'http://127.0.0.1:11434',
    model: 'fake',
    createdAt: new Date().toISOString(),
    revision: 1,
    mode: 'sources',
    evidence: fixtureEvidence,
    ...edit,
  };
}
it('guards purposes, exact content revisions and busy targets, preserving unrelated data on deletion', () => {
  const { store, service, setActive } = setup();
  const chat = store.chat.create();
  const saved = turn(chat.id);
  store.chat.addTurn(saved);
  const note = store.notes.save({ ...emptyNoteDraft(), id: null, revision: 0, title: '笔记' });
  const feedback = store.chat.createNoteConversation(note.id);
  const feedbackTurn = turn(feedback.id, { noteSnapshot: note });
  store.chat.addTurn(feedbackTurn);
  const routeConversation = store.chat.createLearningConversation();
  const route = turn(routeConversation.id, {
    learningRequest: fixtureRequest,
    learningMemories: [fixtureMemory],
  });
  store.chat.addTurn(route);
  for (const id of [feedback.id, routeConversation.id]) {
    expect(() => service.read({ kind: 'conversation', id })).toThrow();
    expect(() => service.rename(id, 'a'.repeat(64), '非法')).toThrow();
  }
  for (const id of [saved.id, feedbackTurn.id])
    expect(() => service.read({ kind: 'learning', id })).toThrow();
  const preview = service.read({ kind: 'conversation', id: chat.id }).preview;
  setActive(saved);
  expect(() => service.verify(preview.target, preview.version)).toThrow('生成');
  setActive(route);
  expect(service.verify(preview.target, preview.version).turns[0]).toEqual(saved);
  setActive(null);
  store.chat.saveTurn({ ...saved, status: 'streaming' });
  expect(() => service.read(preview.target)).toThrow('生成');
  store.chat.saveTurn({ ...saved, revision: 2, answer: '另一个回答' });
  expect(() => service.rename(chat.id, preview.version, '旧版覆盖')).toThrow('变化');
  expect(store.chat.get(chat.id).title).toBe('事务是什么');
  const latest = service.read(preview.target).preview;
  service.delete(latest.target, latest.version);
  expect(store.chat.list()).toEqual([]);
  expect(() => store.chat.getTurn(saved.id)).toThrow();
  expect(store.notes.get(note.id)).toEqual(note);
  expect(store.chat.getTurn(route.id)).toEqual(route);
  expect(store.chat.getTurn(feedbackTurn.id)).toEqual(feedbackTurn);
  expect(() => service.delete(latest.target, latest.version)).toThrow();
});
it.each([
  null,
  [],
  {},
  { kind: 'chat', id: randomUUID() },
  { kind: 'conversation', id: 123 },
  { kind: 'conversation', id: 'invalid' },
  { kind: 'conversation', id: randomUUID(), sql: 'DELETE' },
])('rejects malformed target %j', (target) => {
  const { service } = setup();
  expect(() => service.read(target)).toThrow();
});
it.each([null, 123, '', 'A'.repeat(64), 'a'.repeat(63), 'z'.repeat(64)])(
  'rejects malformed version %j',
  (version) => {
    const { store, service } = setup();
    const chat = store.chat.create();
    expect(() => service.verify({ kind: 'conversation', id: chat.id }, version)).toThrow();
    expect(store.chat.list()).toHaveLength(1);
  },
);
it('keeps a custom title on the first and subsequent turns and rejects control or oversized names', () => {
  const { store, service } = setup();
  const chat = store.chat.create();
  const target = { kind: 'conversation' as const, id: chat.id };
  const preview = service.read(target).preview;
  const renamed = service.rename(chat.id, preview.version, '  自定义标题  ');
  expect(renamed.title).toBe('自定义标题');
  store.chat.addTurn(turn(chat.id));
  expect(store.chat.get(chat.id).title).toBe('自定义标题');
  for (const title of ['', '  ', 'x'.repeat(121), 'bad\nname', 'bad\u0000name']) {
    const before = store.chat.get(chat.id);
    expect(() => service.rename(chat.id, service.read(target).preview.version, title)).toThrow();
    expect(store.chat.get(chat.id)).toEqual(before);
  }
  service.rename(chat.id, service.read(target).preview.version, 'x'.repeat(120));
  expect(store.chat.get(chat.id).title).toHaveLength(120);
});
it('deletes one route without deleting the singleton or confirmed memory provenance', () => {
  const { store, service } = setup();
  const conversation = store.chat.createLearningConversation();
  const route = turn(conversation.id, { learningRequest: fixtureRequest });
  const other = turn(conversation.id, { learningRequest: fixtureRequest });
  store.chat.addTurn(route);
  store.chat.addTurn(other);
  const proposals = new MemoryProposalService(store);
  const memory = proposals.confirm(proposals.prepare(route.id).id);
  const target = { kind: 'learning' as const, id: route.id };
  const preview = service.read(target).preview;
  service.delete(target, preview.version);
  expect(store.chat.getTurn(other.id)).toEqual(other);
  expect(store.chat.findLearningConversation()!.id).toBe(conversation.id);
  expect(store.memories.list()[0]).toEqual(memory);
});
it('exports saved snapshots into literal Markdown blocks even with hostile fences, HTML and images', () => {
  const { store, service } = setup();
  const conversation = store.chat.createLearningConversation();
  const hostile =
    '````\n<img src="https://example.invalid/private">\n![image](https://example.invalid/a)\n[link](https://example.invalid)\n```';
  const saved = turn(conversation.id, {
    question: hostile,
    answer: hostile,
    learningRequest: { ...fixtureRequest, goal: hostile },
    learningMemories: [{ ...fixtureMemory, content: hostile }],
    evidence: fixtureEvidence.map((e) => ({ ...e, text: hostile, end: e.start + hostile.length })),
  });
  store.chat.addTurn(saved);
  const result = service.read({ kind: 'learning', id: saved.id });
  const markdown = historyMarkdown(result.preview, result.turns);
  const tree = unified().use(remarkParse).parse(markdown);
  const types: string[] = [];
  const visit = (node: Node) => {
    types.push(node.type);
    if ('children' in node) for (const child of (node as Parent).children) visit(child);
  };
  visit(tree);
  expect(types).not.toContain('html');
  expect(types).not.toContain('image');
  expect(types).not.toContain('link');
  expect(markdown).toContain(hostile);
  expect(markdown).toContain('UTF-16 偏移');
  expect(markdown).toContain(fixtureMemory.id);
  expect(markdown).toContain('不是实际学习时长');
});
