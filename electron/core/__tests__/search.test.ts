import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { EventEmitter } from 'node:events';
import { expect, it, vi } from 'vitest';
import { Storage } from '../storage';
import { SearchService } from '../search';
import type { EvidencePreview } from '../../../src/lib/types';

function exitingWorker() {
  const worker = Object.assign(new EventEmitter(), {
    kill: () => {
      queueMicrotask(() => worker.emit('exit', 0));
      return true;
    },
  });
  return worker;
}

it('keeps indexing busy until cancellation is acknowledged by an actual worker exit', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'study-search-exit-'));
  const storage = new Storage(join(directory, 'main.sqlite3'));
  const workers: (EventEmitter & { kill: () => boolean })[] = [];
  const search = new SearchService(
    storage,
    directory,
    'worker.mjs',
    () => {
      const worker = Object.assign(new EventEmitter(), { kill: vi.fn(() => true) });
      workers.push(worker);
      return worker;
    },
    async () => {},
  );
  try {
    const pending = search.prepare('事务', null, () => {}).catch((error: unknown) => error);
    search.cancel();
    await Promise.resolve();
    expect(search.busy).toBe(true);
    await expect(search.prepare('新问题', null, () => {})).rejects.toMatchObject({
      code: 'searchBusy',
    });
    await expect(search.rebuild(() => {})).rejects.toMatchObject({ code: 'searchBusy' });
    await expect(search.probeEmbedding()).rejects.toMatchObject({ code: 'searchBusy' });
    expect(workers).toHaveLength(1);
    workers[0].emit('message', {
      type: 'result',
      result: { question: '事务', sourceId: null, sourceCount: 0, hits: [], notice: 'late' },
    });
    workers[0].emit('exit', null);
    expect(await pending).toMatchObject({ code: 'cancelled' });
    expect(search.busy).toBe(false);
    const next = search.prepare('新问题', null, () => {}).catch((error: unknown) => error);
    workers[0].emit('exit', null);
    expect(search.busy).toBe(true);
    search.cancel();
    workers[1].emit('exit', null);
    expect(await next).toMatchObject({ code: 'cancelled' });
  } finally {
    workers.forEach((worker) => worker.emit('exit', null));
    storage.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

it('reports a bounded termination failure without releasing the lock on a live worker', async () => {
  vi.useFakeTimers();
  const directory = mkdtempSync(join(tmpdir(), 'study-search-kill-failed-'));
  const storage = new Storage(join(directory, 'main.sqlite3'));
  const worker = Object.assign(new EventEmitter(), { kill: () => false });
  const search = new SearchService(
    storage,
    directory,
    'worker.mjs',
    () => worker,
    async () => {},
  );
  try {
    const pending = search.prepare('事务', null, () => {}).catch((error: unknown) => error);
    search.cancel();
    await vi.advanceTimersByTimeAsync(5001);
    expect(await pending).toMatchObject({ code: 'indexExitTimeout' });
    expect(search.busy).toBe(true);
    await expect(search.prepare('新问题', null, () => {})).rejects.toMatchObject({
      code: 'searchBusy',
    });
    worker.emit('exit', 1);
    expect(search.busy).toBe(false);
  } finally {
    worker.emit('exit', 1);
    vi.useRealTimers();
    storage.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

it('retries cancellation on spawn when the first kill happens before the child has started', async () => {
  vi.useFakeTimers();
  const directory = mkdtempSync(join(tmpdir(), 'study-search-before-spawn-'));
  const storage = new Storage(join(directory, 'main.sqlite3'));
  let spawned = false;
  const worker = Object.assign(new EventEmitter(), {
    kill: vi.fn(() => {
      if (!spawned) return false;
      queueMicrotask(() => worker.emit('exit', null));
      return true;
    }),
  });
  const search = new SearchService(
    storage,
    directory,
    'worker.mjs',
    () => worker,
    async () => {},
  );
  try {
    const pending = search.prepare('事务', null, () => {}).catch((error: unknown) => error);
    search.cancel();
    expect(search.busy).toBe(true);
    spawned = true;
    worker.emit('spawn');
    await vi.advanceTimersByTimeAsync(5001);
    expect(await pending).toMatchObject({ code: 'cancelled' });
    expect(worker.kill).toHaveBeenCalledTimes(2);
    expect(search.busy).toBe(false);
  } finally {
    worker.emit('exit', null);
    vi.useRealTimers();
    storage.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

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
  const worker = exitingWorker();
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
    const clock = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 600_001);
    try {
      expect(() => search.consume(preview.id, '事务')).toThrow('重新检索');
    } finally {
      clock.mockRestore();
    }
    const altered = search.prepare('事务', null, () => {});
    worker.emit('message', {
      type: 'result',
      result: { ...preview, hits: [{ ...preview.hits[0], sourceName: '伪造资料.pdf', page: 99 }] },
    });
    await expect(altered).rejects.toThrow('引用');
  } finally {
    search.cancel();
    storage.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
it('cancels an active indexing process and rejects a concurrent query', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'study-search-cancel-'));
  const storage = new Storage(join(directory, 'main.sqlite3'));
  const worker = exitingWorker();
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
  const worker = exitingWorker();
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

it('passes only the main-process model path and retries a crashed semantic worker with keywords', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'study-search-fallback-'));
  const storage = new Storage(join(directory, 'main.sqlite3'));
  const workers: (EventEmitter & { kill: () => boolean })[] = [];
  const launch = vi.fn((_modulePath: string, _args: string[]) => {
    const worker = exitingWorker();
    workers.push(worker);
    return worker;
  });
  const search = new SearchService(
    storage,
    directory,
    'worker.mjs',
    launch,
    async () => {},
    () => 'verified-local-model',
  );
  try {
    const pending = search.prepare('事务', null, () => {});
    void pending.catch(() => {});
    expect(launch.mock.calls[0][1].at(-1)).toBe('verified-local-model');
    workers[0].emit('exit', 1);
    await vi.waitFor(() => expect(workers).toHaveLength(2));
    expect(launch.mock.calls[1][1].at(-1)).toBe('');
    workers[1].emit('message', {
      type: 'result',
      result: {
        question: '事务',
        sourceId: null,
        sourceCount: 0,
        hits: [],
        notice: 'keyword result',
      },
    });
    expect((await pending).notice).toContain('已使用关键词检索');
    const cancelled = search.prepare('事务', null, () => {});
    search.cancel();
    await expect(cancelled).rejects.toMatchObject({ code: 'cancelled' });
    expect(workers).toHaveLength(3);
  } finally {
    search.cancel();
    storage.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

it('returns index notices so a semantic fallback is visible after a rebuild', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'study-index-report-'));
  const storage = new Storage(join(directory, 'main.sqlite3'));
  const worker = exitingWorker();
  const search = new SearchService(
    storage,
    directory,
    'worker.mjs',
    (_modulePath, args) => {
      writeFileSync(args[1], 'completed staging fixture');
      return worker;
    },
    async () => {},
  );
  try {
    const pending = search.rebuild(() => {});
    worker.emit('message', {
      type: 'result',
      result: {
        question: '',
        sourceId: null,
        sourceCount: 0,
        hits: [],
        notice: '已使用关键词检索',
      },
    });
    expect(await pending).toContain('已使用关键词检索');
  } finally {
    search.cancel();
    storage.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
