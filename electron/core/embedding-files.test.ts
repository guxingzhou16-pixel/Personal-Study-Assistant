import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, expect, it, vi } from 'vitest';
import { EmbeddingFiles } from './embedding-files';
import type { EmbeddingModel } from './embedding-model';

const directories: string[] = [];
afterEach(() =>
  directories.splice(0).forEach((path) => rmSync(path, { recursive: true, force: true })),
);
const content = Buffer.from('test-only model');
const model: EmbeddingModel = {
  name: 'Test model',
  repository: 'test/model',
  revision: 'a'.repeat(40),
  dimensions: 3,
  dtype: 'q8',
  pooling: 'cls',
  queryPrefix: '',
  maxTokens: 512,
  files: [
    {
      path: 'onnx/model_quantized.onnx',
      bytes: content.length,
      sha256: createHash('sha256').update(content).digest('hex'),
    },
  ],
};
function directory() {
  const path = mkdtempSync(join(tmpdir(), 'study-embedding-files-'));
  directories.push(path);
  return path;
}
it('downloads only pinned files, verifies them, and makes a complete model available atomically', async () => {
  const request = vi.fn(async (_url: string, _options?: RequestInit) => new Response(content));
  const files = new EmbeddingFiles(directory(), request, model);
  expect((await files.status()).state).toBe('missing');
  expect(request).not.toHaveBeenCalled();
  const progress = vi.fn();
  await files.install(progress);
  expect(await files.status()).toMatchObject({ state: 'ready', bytes: content.length });
  expect(request.mock.calls[0][0]).toBe(
    `https://huggingface.co/test/model/resolve/${model.revision}/onnx/model_quantized.onnx`,
  );
  expect(readFileSync(join(files.modelPath, model.files[0].path))).toEqual(content);
  expect(progress).toHaveBeenCalledWith(
    expect.objectContaining({ current: content.length, total: content.length }),
  );
});
it('rejects incomplete or altered downloads and keeps the previous verified model', async () => {
  let body = content;
  const files = new EmbeddingFiles(directory(), async () => new Response(body), model);
  await files.install(() => {});
  body = Buffer.from('altered content');
  await expect(files.install(() => {})).rejects.toMatchObject({ code: 'embeddingIntegrity' });
  expect((await files.status()).state).toBe('ready');
  writeFileSync(join(files.modelPath, model.files[0].path), body);
  expect((await files.status()).state).toBe('invalid');
});
it('cancels a pending download, rejects concurrent installation, and leaves no ready model', async () => {
  const files = new EmbeddingFiles(
    directory(),
    async (_url, options) => {
      if (options!.signal!.aborted) throw new Error('aborted');
      await new Promise<void>((_resolve, reject) =>
        options!.signal!.addEventListener('abort', () => reject(new Error('aborted')), {
          once: true,
        }),
      );
      return new Response(content);
    },
    model,
  );
  const pending = files.install(() => {});
  const outcome = pending.catch((error: { code: string }) => error.code);
  await vi.waitFor(async () => expect((await files.status()).state).toBe('downloading'));
  await expect(files.install(() => {})).rejects.toMatchObject({ code: 'embeddingBusy' });
  files.cancel();
  expect(await outcome).toBe('cancelled');
  expect((await files.status()).state).toBe('missing');
});

it('allows a slow but progressing download to finish after more than five minutes', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  const timeout = vi.spyOn(AbortSignal, 'timeout').mockImplementation((delay) => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(new DOMException('Timed out', 'TimeoutError')), delay);
    return controller.signal;
  });
  let requested!: () => void;
  const started = new Promise<void>((resolve) => {
    requested = resolve;
  });
  const files = new EmbeddingFiles(
    directory(),
    async (_url, options) => {
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          options!.signal!.addEventListener(
            'abort',
            () => controller.error(new Error('timed out')),
            { once: true },
          );
          for (let part = 0; part < 4; part++)
            setTimeout(
              () => {
                if (options!.signal!.aborted) return;
                controller.enqueue(
                  content.subarray(
                    Math.floor((content.length * part) / 4),
                    Math.floor((content.length * (part + 1)) / 4),
                  ),
                );
                if (part === 3) controller.close();
              },
              (part + 1) * 120_000,
            );
        },
      });
      requested();
      return new Response(stream);
    },
    model,
  );
  try {
    const pending = files.install(() => {});
    void pending.catch(() => {});
    await started;
    await vi.advanceTimersByTimeAsync(480_000);
    await expect(pending).resolves.toMatchObject({ state: 'ready' });
  } finally {
    timeout.mockRestore();
    vi.useRealTimers();
  }
});
