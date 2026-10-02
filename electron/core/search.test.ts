import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { EventEmitter } from 'node:events';
import { expect, it } from 'vitest';
import { Storage } from './storage';
import { SearchService } from './search';
import type { EvidencePreview } from '../../src/lib/types';

it('holds evidence on the server, rejects changed/expired questions, and validates citation locations', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'study-preview-'));
  const storage = new Storage(join(directory, 'main.sqlite3'));
  storage.addSource({
    id: 'a'.repeat(64),
    name: '资料.md',
    kind: 'markdown',
    bytes: 50,
    pageCount: 1,
    textStatus: 'ready',
    outline: [],
    segments: [{ anchor: 'md-line-1', title: '事务', depth: 1, line: 1, text: '事务避免脏读。' }],
  });
  const worker = Object.assign(new EventEmitter(), { kill: () => true });
  const search = new SearchService(
    storage,
    directory,
    'worker.mjs',
    () => worker,
    async () => {},
  );
  try {
    const pending = search.prepare('事务', null, () => {});
    worker.emit('message', {
      type: 'result',
      result: {
        question: '事务',
        sourceId: null,
        sourceCount: 1,
        notice: '',
        hits: [
          {
            number: 1,
            sourceId: 'a'.repeat(64),
            sourceName: '资料.md',
            kind: 'markdown',
            anchor: 'md-line-1',
            title: '事务',
            line: 1,
            start: 0,
            end: 7,
            text: '事务避免脏读。',
          },
        ],
      },
    });
    const preview = await pending;
    expect(() => search.consume(preview.id, '改过的问题')).toThrow('重新检索');
    expect(() => search.consume('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '事务')).toThrow(
      '重新检索',
    );
    const read = search.consume(preview.id, '事务');
    read.hits[0].text = '伪造';
    expect(search.consume(preview.id, '事务').hits[0].text).toBe('事务避免脏读。');
    const conversation = storage.chat.create();
    storage.chat.addTurn({
      id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      conversationId: conversation.id,
      question: '事务',
      answer: '避免脏读 [1]',
      status: 'completed',
      notice: '',
      provider: 'ollama',
      baseUrl: 'http://127.0.0.1:11434',
      model: 'test',
      createdAt: new Date().toISOString(),
      revision: 1,
      mode: 'sources',
      evidence: preview.hits,
    });
    await expect(
      search.resolveCitation('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 1),
    ).resolves.toMatchObject({ sourceId: 'a'.repeat(64), anchor: 'md-line-1', page: 1 });
    await expect(
      search.resolveCitation('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 99),
    ).rejects.toThrow('引用');
    await expect(
      search.resolveCitation('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '1'),
    ).rejects.toThrow('引用');
  } finally {
    search.cancel();
    storage.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
it('cancels an active indexing process and rejects a concurrent query', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'study-search-cancel-'));
  const storage = new Storage(join(directory, 'main.sqlite3'));
  const worker = Object.assign(new EventEmitter(), { kill: () => true });
  const search = new SearchService(
    storage,
    directory,
    'worker.mjs',
    () => worker,
    async () => {},
  );
  try {
    const pending = search.prepare('事务', null, () => {});
    await expect(search.prepare('另一个问题', null, () => {})).rejects.toThrow('取消');
    search.cancel();
    await expect(pending).rejects.toMatchObject({ code: 'cancelled' });
  } finally {
    search.cancel();
    storage.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
it('rejects evidence when the source copy fails its integrity check', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'study-search-hash-'));
  const storage = new Storage(join(directory, 'main.sqlite3'));
  const worker = Object.assign(new EventEmitter(), { kill: () => true });
  const search = new SearchService(
    storage,
    directory,
    'worker.mjs',
    () => worker,
    async () => {
      throw new Error('source changed');
    },
  );
  try {
    const pending = search.prepare('事务', null, () => {});
    const result: Omit<EvidencePreview, 'id'> = {
      question: '事务',
      sourceId: null,
      sourceCount: 1,
      notice: '',
      hits: [
        {
          number: 1,
          sourceId: 'a'.repeat(64),
          sourceName: '资料.md',
          kind: 'markdown',
          anchor: 'md-line-1',
          title: '事务',
          line: 1,
          start: 0,
          end: 7,
          text: '事务避免脏读。',
        },
      ],
    };
    worker.emit('message', { type: 'result', result });
    await expect(pending).rejects.toThrow('source changed');
  } finally {
    search.cancel();
    storage.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
