import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, expect, it, vi } from 'vitest';
import { defaultSettings, type ChatTurn } from '../../../src/lib/types';
import { Storage } from '../storage';
import { ChatService } from '../chat';
import { AppError } from '../errors';
import { copyIntoLegacy } from '../../../tests/fixtures/legacy-databases';

const stores: Storage[] = [];
const directories: string[] = [];
afterEach(() => {
  stores.splice(0).forEach((store) => store.close());
  directories.splice(0).forEach((directory) => rmSync(directory, { recursive: true, force: true }));
});
function setup() {
  const directory = mkdtempSync(join(tmpdir(), 'study-chat-'));
  directories.push(directory);
  const path = join(directory, 'study.sqlite3');
  const storage = new Storage(path);
  stores.push(storage);
  storage.saveSettings({
    ...defaultSettings,
    ollama: { baseUrl: 'http://127.0.0.1:11434', model: 'local' },
  });
  return { storage, path, directory };
}

it('migrates v2 without losing settings or source anchors and makes a readable backup', () => {
  const { storage, path, directory } = setup();
  storage.addSource({
    id: 'a'.repeat(64),
    name: '原资料.md',
    kind: 'markdown',
    bytes: 50,
    pageCount: 1,
    textStatus: 'ready',
    outline: [],
    segments: [{ anchor: 'md-line-1', title: '闭包', depth: 1, line: 1, text: '保留原文' }],
  });
  storage.close();
  stores.pop();
  const legacyPath = path + '.v2';
  copyIntoLegacy(path, legacyPath, 2);
  const upgraded = new Storage(legacyPath);
  stores.push(upgraded);
  expect(upgraded.schemaVersion).toBe(13);
  expect(upgraded.loadSettings().ollama.model).toBe('local');
  expect(upgraded.getSegment('a'.repeat(64), 'md-line-1')?.text).toBe('保留原文');
  const backupName = readdirSync(directory).find((name) => name.includes('before-v3'))!;
  const backup = new DatabaseSync(join(directory, backupName), { readOnly: true });
  expect(backup.prepare('PRAGMA user_version').get()?.user_version).toBe(2);
  expect(backup.prepare('SELECT text FROM source_segments').get()?.text).toBe('保留原文');
  backup.close();
});

it('saves turns, sends only completed history, and does not read cloud keys for Ollama', async () => {
  const { storage } = setup();
  const load = vi.fn();
  const transport = vi.fn(async (_input, onText) => {
    onText('解释结果');
    return { truncated: false };
  });
  const chat = new ChatService(storage, { load }, () => {}, transport);
  const conversation = storage.chat.create();
  chat.send({ conversationId: conversation.id, question: '第一个问题' });
  await expect.poll(() => storage.chat.get(conversation.id).turns[0]?.status).toBe('completed');
  chat.send({ conversationId: conversation.id, question: '继续解释' });
  await expect.poll(() => storage.chat.get(conversation.id).turns[1]?.status).toBe('completed');
  expect(transport.mock.calls[1][0].messages.slice(-3)).toEqual([
    { role: 'user', content: '第一个问题' },
    { role: 'assistant', content: '解释结果' },
    { role: 'user', content: '继续解释' },
  ]);
  expect(load).not.toHaveBeenCalled();
  expect(storage.chat.list()[0].title).toBe('第一个问题');
  chat.close();
});

it('stops immediately and rejects late text even from an uncooperative transport', async () => {
  const { storage } = setup();
  let release!: () => void;
  let emit!: (text: string) => void;
  const updates: ChatTurn[] = [];
  const chat = new ChatService(
    storage,
    { load: () => undefined },
    (turn) => updates.push(turn),
    async (_input, onText) => {
      emit = onText;
      onText('保留部分');
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      onText('不应出现');
      return { truncated: false };
    },
  );
  const conversation = storage.chat.create();
  const turn = chat.send({ conversationId: conversation.id, question: '问题' });
  expect(() => chat.send({ conversationId: conversation.id, question: '重复发送' })).toThrow(
    '停止',
  );
  chat.stop(turn.id);
  emit('迟到文本');
  release();
  await new Promise((resolve) => setTimeout(resolve, 10));
  expect(storage.chat.get(conversation.id).turns[0]).toMatchObject({
    answer: '保留部分',
    status: 'stopped',
  });
  expect(updates.at(-1)?.status).toBe('stopped');
  chat.close();
});

it('requires consent bound to the exact remote endpoint before reading keys or sending any content', () => {
  const { storage } = setup();
  storage.saveSettings({
    ...defaultSettings,
    provider: 'openai',
    openai: { baseUrl: 'https://models.example/v1', model: 'remote' },
  });
  const load = vi.fn();
  const transport = vi.fn();
  const chat = new ChatService(storage, { load }, () => {}, transport);
  const conversation = storage.chat.create();
  for (const consentEndpoint of [undefined, 'https://other.example/v1']) {
    expect(() =>
      chat.send({ conversationId: conversation.id, question: '隐私内容', consentEndpoint }),
    ).toThrow('确认');
  }
  expect(transport).not.toHaveBeenCalled();
  expect(load).not.toHaveBeenCalled();
  expect(storage.chat.get(conversation.id).turns).toHaveLength(0);
  chat.close();
});

it('persists partial answers as interrupted when closing and recovers unfinished rows on restart', async () => {
  const { storage } = setup();
  const chat = new ChatService(
    storage,
    { load: () => undefined },
    () => {},
    async (_input, onText) => {
      onText('未完的回答');
      return new Promise(() => {});
    },
  );
  const conversation = storage.chat.create();
  chat.send({ conversationId: conversation.id, question: '需要继续' });
  chat.close();
  expect(storage.chat.get(conversation.id).turns[0]).toMatchObject({
    answer: '未完的回答',
    status: 'interrupted',
  });
  const row = storage.chat.get(conversation.id).turns[0];
  storage.chat.saveTurn({ ...row, status: 'streaming' });
  const reopened = new ChatService(storage, { load: () => undefined }, () => {});
  expect(storage.chat.get(conversation.id).turns[0].status).toBe('interrupted');
  reopened.close();
});

it('rejects invalid input, an absent model, and unknown conversations before network use', () => {
  const { storage } = setup();
  const transport = vi.fn();
  const chat = new ChatService(storage, { load: () => undefined }, () => {}, transport);
  const conversation = storage.chat.create();
  for (const question of ['', '   ', 5, 'x'.repeat(4001)]) {
    expect(() => chat.send({ conversationId: conversation.id, question })).toThrow();
  }
  expect(() => chat.send({ conversationId: 'nope', question: '问' })).toThrow();
  storage.saveSettings(defaultSettings);
  expect(() => chat.send({ conversationId: conversation.id, question: '问' })).toThrow('模型');
  expect(transport).not.toHaveBeenCalled();
  chat.close();
});

it('rejects NUL in a user question before storing a turn or using the model', () => {
  const { storage } = setup();
  const transport = vi.fn();
  const chat = new ChatService(storage, { load: () => undefined }, () => {}, transport);
  const conversation = storage.chat.create();
  try {
    expect(() =>
      chat.send({ conversationId: conversation.id, question: '问题\0内容' }),
    ).toThrow();
    expect(storage.chat.get(conversation.id).turns).toHaveLength(0);
    expect(transport).not.toHaveBeenCalled();
  } finally {
    chat.close();
  }
});

it.each(['ollama', 'openai'] as const)(
  'keeps readable saved text after rejecting a NUL delta in a %s stream',
  async (provider) => {
    const { storage, path } = setup();
    storage.saveSettings({
      ...defaultSettings,
      provider,
      [provider]: { baseUrl: 'http://127.0.0.1:11434', model: 'local' },
    });
    const frame = (content: string, done: boolean) =>
      provider === 'ollama'
        ? JSON.stringify({ message: { content }, done }) + '\n'
        : 'data: ' +
          JSON.stringify({ choices: [{ delta: { content }, finish_reason: done ? 'stop' : null }] }) +
          '\n\n';
    const request = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(frame('正常内容', false) + frame('异常\0内容', true)));
    const chat = new ChatService(storage, { load: () => undefined }, () => {});
    const conversation = storage.chat.create();
    try {
      const turn = chat.send({ conversationId: conversation.id, question: '保留正常回答' });
      await expect.poll(() => chat.current()).toBeNull();
      const expected = {
        id: turn.id,
        question: '保留正常回答',
        answer: '正常内容',
        status: 'error',
        notice: expect.stringContaining('流式格式无法识别'),
      };
      expect(storage.chat.get(conversation.id).turns[0]).toMatchObject(expected);
      chat.close();
      storage.close();
      stores.pop();
      const reopened = new Storage(path);
      stores.push(reopened);
      expect(reopened.chat.get(conversation.id).turns[0]).toMatchObject(expected);
      expect(request).toHaveBeenCalledOnce();
    } finally {
      chat.close();
      request.mockRestore();
    }
  },
);

it('uses the exact consented endpoint key and selected style, and rejects stale model settings', async () => {
  const { storage } = setup();
  const baseUrl = 'https://models.example/v1';
  storage.saveSettings({
    ...defaultSettings,
    responseStyle: 'coach',
    provider: 'openai',
    openai: { baseUrl, model: 'remote' },
  });
  const load = vi.fn(() => 'fake-key');
  const transport = vi.fn(async (_input, onText) => {
    onText('回答');
    return { truncated: true };
  });
  const chat = new ChatService(storage, { load }, () => {}, transport);
  const conversation = storage.chat.create();
  expect(() =>
    chat.send({
      conversationId: conversation.id,
      question: '问题',
      consentEndpoint: baseUrl,
      expectedProfile: 'stale',
    }),
  ).toThrow('变化');
  expect(load).not.toHaveBeenCalled();
  chat.send({
    conversationId: conversation.id,
    question: '问题',
    consentEndpoint: baseUrl,
    expectedProfile: `openai|${baseUrl}|remote`,
  });
  await expect.poll(() => storage.chat.get(conversation.id).turns[0]?.status).toBe('completed');
  expect(load).toHaveBeenCalledWith(baseUrl);
  expect(transport.mock.calls[0][0].key).toBe('fake-key');
  expect(transport.mock.calls[0][0].messages[0].content).toContain('直接、清楚');
  expect(storage.chat.get(conversation.id).turns[0].notice).toContain('长度上限');
  chat.close();
});

it('keeps a partial answer and surfaces generation and save failures instead of reporting success', async () => {
  const { storage } = setup();
  const updates: ChatTurn[] = [];
  const chat = new ChatService(
    storage,
    { load: () => undefined },
    (turn) => updates.push(turn),
    async (_input, onText) => {
      onText('部分内容');
      throw new AppError('streamIncomplete', '连接中断');
    },
  );
  const conversation = storage.chat.create();
  chat.send({ conversationId: conversation.id, question: '问题' });
  await expect.poll(() => storage.chat.get(conversation.id).turns[0]?.status).toBe('error');
  expect(storage.chat.get(conversation.id).turns[0]).toMatchObject({
    answer: '部分内容',
    notice: '连接中断',
  });
  const save = vi.spyOn(storage.chat, 'saveTurn').mockImplementation(() => {
    throw new Error('disk full');
  });
  chat.send({ conversationId: conversation.id, question: '保存失败测试' });
  await expect.poll(() => updates.at(-1)?.notice).toContain('保存失败');
  expect(chat.current()).toBeNull();
  save.mockRestore();
  chat.close();
});
