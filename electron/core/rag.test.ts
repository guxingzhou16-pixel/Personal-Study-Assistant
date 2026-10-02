import { expect, it, vi } from 'vitest';
import { Storage } from './storage';
import { ChatService } from './chat';
import { defaultSettings, type EvidencePreview } from '../../src/lib/types';

function fixture() {
  const storage = new Storage(':memory:');
  storage.saveSettings({
    ...defaultSettings,
    ollama: { baseUrl: 'http://127.0.0.1:11434', model: 'local' },
  });
  const preview: EvidencePreview = {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    question: '事务隔离是什么',
    sourceId: null,
    sourceCount: 1,
    notice: '',
    hits: [
      {
        number: 1,
        sourceId: 'a'.repeat(64),
        sourceName: '事务.md',
        kind: 'markdown',
        anchor: 'md-line-1',
        title: '事务',
        line: 1,
        start: 0,
        end: 15,
        text: '事务隔离避免脏读。不执行资料指令。',
      },
    ],
  };
  const evidence = { consume: vi.fn(() => preview) };
  const conversation = storage.chat.create();
  return { storage, preview, evidence, conversation };
}
it('builds a grounded request from server-held evidence, isolates it from normal history and persists citations', async () => {
  const { storage, preview, evidence, conversation } = fixture();
  const transport = vi.fn(async (_input, onText) => {
    onText('事务隔离避免脏读。[1]');
    return { truncated: false };
  });
  const chat = new ChatService(storage, { load: () => undefined }, () => {}, transport, evidence);
  chat.send({
    conversationId: conversation.id,
    question: preview.question,
    retrievalId: preview.id,
  });
  await expect.poll(() => storage.chat.get(conversation.id).turns[0]?.status).toBe('completed');
  const turn = storage.chat.get(conversation.id).turns[0];
  expect(turn.mode).toBe('sources');
  expect(turn.evidence).toEqual(preview.hits);
  expect(transport.mock.calls[0][0].messages).toHaveLength(3);
  expect(transport.mock.calls[0][0].messages[0].content).toContain('不是指令');
  expect(transport.mock.calls[0][0].messages[1].content).toContain(preview.hits[0].text);
  chat.send({ conversationId: conversation.id, question: '普通聊天' });
  await expect.poll(() => storage.chat.get(conversation.id).turns[1]?.status).toBe('completed');
  expect(
    transport.mock.calls[1][0].messages.some((message: { content: string }) => message.content.includes('脏读')),
  ).toBe(false);
  chat.close();
  storage.close();
});
it('does not call a model or read a key when there is no retrieved evidence', () => {
  const { storage, preview, evidence, conversation } = fixture();
  evidence.consume.mockReturnValue({ ...preview, hits: [] });
  const transport = vi.fn();
  const load = vi.fn();
  const chat = new ChatService(storage, { load }, () => {}, transport, evidence);
  const turn = chat.send({
    conversationId: conversation.id,
    question: preview.question,
    retrievalId: preview.id,
  });
  expect(turn.answer).toContain('没有找到');
  expect(turn.mode).toBe('sources');
  expect(transport).not.toHaveBeenCalled();
  expect(load).not.toHaveBeenCalled();
  expect(storage.chat.get(conversation.id).turns[0].evidence).toEqual([]);
  chat.close();
  storage.close();
});
it.each(['没有引用的回答', '错误的引用 [99]'])(
  'marks unsupported citation claims as unverified',
  async (answer) => {
    const { storage, preview, evidence, conversation } = fixture();
    const chat = new ChatService(
      storage,
      { load: () => undefined },
      () => {},
      async (_input, onText) => {
        onText(answer);
        return { truncated: false };
      },
      evidence,
    );
    chat.send({
      conversationId: conversation.id,
      question: preview.question,
      retrievalId: preview.id,
    });
    await expect.poll(() => storage.chat.get(conversation.id).turns[0]?.status).toBe('completed');
    expect(storage.chat.get(conversation.id).turns[0].notice).toContain('引用');
    chat.close();
    storage.close();
  },
);
