import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, statSync } from 'node:fs';
import { mkdir, mkdtemp, open, rename, rm, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { EmbeddingStatus, RetrievalProgress } from '../../src/lib/types';
import { embeddingModel, embeddingDownloadTimeoutMs, type EmbeddingModel } from './embedding-model';
import { AppError } from './errors';

type Download = (url: string, options?: RequestInit) => Promise<Response>;
export function embeddingPath(directory: string, model = embeddingModel): string {
  return join(directory, `${model.repository.replaceAll('/', '--')}-${model.revision}`);
}
export async function verifyEmbeddingFiles(path: string, model = embeddingModel): Promise<boolean> {
  for (const file of model.files) {
    const location = join(path, file.path);
    try {
      const info = await stat(location);
      if (!info.isFile() || info.size !== file.bytes) return false;
      const hash = createHash('sha256');
      for await (const chunk of createReadStream(location)) hash.update(chunk);
      if (hash.digest('hex') !== file.sha256) return false;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
      throw new AppError('embeddingRead', '无法读取本地检索模型，请检查数据目录权限。');
    }
  }
  return true;
}

export class EmbeddingFiles {
  private active?: AbortController;
  readonly modelPath: string;
  constructor(
    private readonly directory: string,
    private readonly download: Download = fetch,
    private readonly model: EmbeddingModel = embeddingModel,
  ) {
    this.modelPath = embeddingPath(directory, model);
  }
  // Fast candidate check for launching a worker. The worker verifies every hash
  // before loading; never hash the ONNX weight synchronously in the main process.
  candidatePath(): string | null {
    if (this.active) return null;
    try {
      return this.model.files.every((file) => {
        const info = statSync(join(this.modelPath, file.path));
        return info.isFile() && info.size === file.bytes;
      })
        ? this.modelPath
        : null;
    } catch {
      return null;
    }
  }
  async status(): Promise<EmbeddingStatus> {
    let state: EmbeddingStatus['state'] = 'missing';
    if (this.active) state = 'downloading';
    else if (await verifyEmbeddingFiles(this.modelPath, this.model)) state = 'ready';
    else {
      try {
        await stat(this.modelPath);
        state = 'invalid';
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
          throw new AppError('embeddingRead', '无法读取本地检索模型目录。');
      }
    }
    return {
      state,
      name: this.model.name,
      dimensions: this.model.dimensions,
      bytes: this.model.files.reduce((sum, file) => sum + file.bytes, 0),
      revision: this.model.revision,
      message: {
        missing: '尚未下载，仍可使用关键词检索。',
        downloading: '正在下载，当前使用关键词检索。',
        invalid: '模型文件不完整或已改变，请重新下载；当前使用关键词检索。',
        ready: '模型文件已校验；实际推理需另行测试，不能仅据文件判定混合检索可用。',
      }[state],
    };
  }
  cancel(): void {
    this.active?.abort();
  }
  get busy(): boolean {
    return this.active !== undefined;
  }
  async install(progress: (value: RetrievalProgress) => void): Promise<EmbeddingStatus> {
    if (this.active) throw new AppError('embeddingBusy', '检索模型正在下载，请先等待或取消。');
    const controller = new AbortController();
    this.active = controller;
    const signal = AbortSignal.any([
      controller.signal,
      AbortSignal.timeout(embeddingDownloadTimeoutMs),
    ]);
    let staged: string | undefined;
    try {
      await mkdir(this.directory, { recursive: true });
      staged = await mkdtemp(join(this.directory, '.download-'));
      const total = this.model.files.reduce((sum, file) => sum + file.bytes, 0);
      let current = 0;
      for (const file of this.model.files) {
        signal.throwIfAborted();
        const response = await this.download(
          `https://huggingface.co/${this.model.repository}/resolve/${this.model.revision}/${file.path}`,
          { signal, redirect: 'follow' },
        );
        if (!response.ok || !response.body)
          throw new AppError(
            'embeddingDownload',
            '模型下载失败，请检查网络后重试；关键词检索仍可用。',
          );
        const target = join(staged, file.path);
        await mkdir(dirname(target), { recursive: true });
        const handle = await open(target, 'wx');
        const hash = createHash('sha256');
        let bytes = 0;
        try {
          for await (const part of response.body) {
            signal.throwIfAborted();
            bytes += part.length;
            if (bytes > file.bytes)
              throw new AppError('embeddingIntegrity', '下载文件大小不符，请重新下载。');
            hash.update(part);
            await handle.writeFile(part);
            current += part.length;
            progress({
              current,
              total,
              message: `下载检索模型：${Math.round((current / total) * 100)}%`,
            });
          }
        } finally {
          await handle.close();
        }
        if (bytes !== file.bytes || hash.digest('hex') !== file.sha256)
          throw new AppError('embeddingIntegrity', '下载文件未通过完整性校验，请重新下载。');
      }
      signal.throwIfAborted();
      // Keep a working copy until all replacement files have been verified.
      const previous = join(this.directory, `.previous-${randomUUID()}`);
      let moved = false;
      try {
        await rename(this.modelPath, previous);
        moved = true;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
      try {
        await rename(staged, this.modelPath);
        staged = undefined;
      } catch (error) {
        if (moved) await rename(previous, this.modelPath);
        throw error;
      }
      if (moved) await rm(previous, { recursive: true, force: true });
    } catch (error) {
      if (controller.signal.aborted)
        throw new AppError('cancelled', '已取消模型下载，关键词检索仍可用。');
      if (signal.aborted)
        throw new AppError(
          'embeddingTimeout',
          `模型下载超过 ${embeddingDownloadTimeoutMs / 60_000} 分钟，请检查网络后重试。`,
        );
      if (error instanceof AppError) throw error;
      throw new AppError(
        'embeddingDownload',
        '无法下载或保存模型，请检查网络、磁盘空间与目录权限。',
      );
    } finally {
      try {
        if (staged) await rm(staged, { recursive: true, force: true });
      } finally {
        this.active = undefined;
      }
    }
    return this.status();
  }
}
