import { createHash, randomUUID } from 'node:crypto';
import { fork } from 'node:child_process';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, readFile, rename, rm, stat } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ImportProgress, ImportReport, OpenDocument, SourceKind } from '../../src/lib/types';
import { AppError, failure } from './errors';
import type { Storage } from './storage';
import { backupLimits } from '../../src/lib/backup';
import type { ParserResult } from './document-parser';

export const DOCUMENT_LIMITS = {
  pdf: 50 * 1024 * 1024,
  markdown: 5 * 1024 * 1024,
  files: 20,
  pages: 1000,
  sources: backupLimits.files - 2,
};
type ParserMessage =
  | { type: 'progress'; message: string }
  | { type: 'result'; result: ParserResult }
  | { type: 'error'; code: string; message: string };
export interface ParserProcess {
  on(event: 'message', listener: (message: ParserMessage) => void): unknown;
  on(event: 'error', listener: () => void): unknown;
  on(event: 'exit', listener: (code: number | null) => void): unknown;
  kill(): boolean;
}
export type ParserLauncher = (modulePath: string, args: string[]) => ParserProcess;
export function sourceId(input: unknown): string {
  if (typeof input !== 'string' || !/^[a-f0-9]{64}$/.test(input))
    throw new AppError('sourceId', '资料标识无效。');
  return input;
}
function fileKind(path: string): SourceKind {
  const extension = extname(path).toLowerCase();
  if (extension === '.pdf') return 'pdf';
  if (extension === '.md' || extension === '.markdown') return 'markdown';
  throw new AppError('fileType', '首版只支持 PDF 和 Markdown 文件。');
}
export class Documents {
  private active: AbortController | undefined;
  private markdownCompatibility?: { id: string; result: ParserResult };
  constructor(
    private readonly storage: Storage,
    private readonly directory: string,
    private readonly workerPath: string,
    private readonly launchParser: ParserLauncher = (path, args) =>
      fork(path, args, {
        stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
        execArgv: ['--max-old-space-size=256'],
      }),
  ) {}
  cancel(): void {
    this.active?.abort();
  }
  get busy(): boolean {
    return this.active !== undefined;
  }
  private filePath(id: string, kind: SourceKind) {
    return join(this.directory, `${sourceId(id)}.${kind === 'pdf' ? 'pdf' : 'md'}`);
  }
  async import(paths: string[], progress: (event: ImportProgress) => void): Promise<ImportReport> {
    if (this.active) throw new AppError('importBusy', '另一个导入正在进行，请稍候。');
    if (paths.length > DOCUMENT_LIMITS.files)
      throw new AppError('fileCount', '每次最多导入 20 份资料，请分批选择。');
    const controller = new AbortController();
    this.active = controller;
    const report: ImportReport = { added: 0, duplicates: 0, cancelled: false, failures: [] };
    try {
      await mkdir(this.directory, { recursive: true });
      for (let index = 0; index < paths.length; index++) {
        if (controller.signal.aborted) {
          report.cancelled = true;
          break;
        }
        const path = paths[index];
        const file = basename(path);
        const staged = join(this.directory, `.import-${randomUUID()}`);
        const notify = (message: string) =>
          progress({ file, current: index + 1, total: paths.length, message });
        try {
          const kind = fileKind(path);
          const info = await stat(path);
          const limit = DOCUMENT_LIMITS[kind];
          if (!info.isFile() || info.size === 0)
            throw new AppError('emptyFile', '文件为空或不是普通文件。');
          if (info.size > limit)
            throw new AppError(
              'fileSize',
              `${kind === 'pdf' ? 'PDF 最大 50 MB' : 'Markdown 最大 5 MB'}，请拆分后导入。`,
            );
          notify('复制到本地学习空间…');
          let bytes = 0;
          const digest = createHash('sha256');
          await pipeline(
            createReadStream(path),
            new Transform({
              transform(chunk: Buffer, _encoding, callback) {
                bytes += chunk.length;
                if (bytes > limit) {
                  callback(new AppError('fileSize', '文件在复制时超过大小限制。'));
                  return;
                }
                digest.update(chunk);
                callback(null, chunk);
              },
            }),
            createWriteStream(staged, { flags: 'wx' }),
            { signal: controller.signal },
          );
          const id = digest.digest('hex');
          if (this.storage.getSource(id)) {
            report.duplicates++;
            notify('已有相同内容，保留原有阅读进度。');
            continue;
          }
          this.storage.ensureSourceCapacity();
          notify('分析目录与文字…');
          const parsed = await this.parse(staged, kind, controller.signal, notify);
          controller.signal.throwIfAborted();
          const destination = this.filePath(id, kind);
          await rename(staged, destination);
          try {
            this.storage.addSource({
              id,
              name: file.replace(/\.(pdf|md|markdown)$/i, '').slice(0, 200) || '未命名资料',
              kind,
              bytes,
              ...parsed,
            });
          } catch (error) {
            await rm(destination, { force: true });
            throw error;
          }
          report.added++;
          notify('导入完成。');
        } catch (error) {
          if (controller.signal.aborted) {
            report.cancelled = true;
            break;
          }
          report.failures.push({ file, message: failure(error).message });
        } finally {
          await rm(staged, { force: true });
        }
      }
    } finally {
      this.active = undefined;
    }
    return report;
  }
  private parse(
    path: string,
    kind: SourceKind,
    signal: AbortSignal,
    progress: (message: string) => void,
  ): Promise<ParserResult> {
    return new Promise((resolve, reject) => {
      // PDF/native decompression stays in another process: cancelling it cannot terminate the main process.
      const worker = this.launchParser(this.workerPath, [
        path,
        kind,
        String(DOCUMENT_LIMITS.pages),
      ]);
      let finished = false;
      const finish = (error?: unknown, result?: ParserResult) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        signal.removeEventListener('abort', aborted);
        worker.kill();
        if (error) reject(error);
        else resolve(result!);
      };
      const aborted = () => finish(new AppError('cancelled', '已取消导入。'));
      const timer = setTimeout(
        () => finish(new AppError('parseTimeout', '解析超过 60 秒，请拆分文件后重试。')),
        60_000,
      );
      signal.addEventListener('abort', aborted, { once: true });
      worker.on('message', (message) => {
        if (message.type === 'progress') progress(message.message);
        else if (message.type === 'error') finish(new AppError(message.code, message.message));
        else if (message.type === 'result') finish(undefined, message.result);
      });
      worker.on('error', () =>
        finish(new AppError('parseError', '解析进程无法完成，请检查文件是否损坏或过大。')),
      );
      worker.on('exit', (code) => {
        if (!finished)
          finish(new AppError('parseExit', `资料解析未完成（${code}），请重试或拆分文件。`));
      });
      if (signal.aborted) aborted();
    });
  }
  async open(input: unknown): Promise<OpenDocument> {
    const id = sourceId(input);
    const source = this.storage.getSource(id);
    if (!source) throw new AppError('sourceMissing', '这份资料不存在，请返回资料库刷新。');
    let data: Buffer;
    try {
      data = await readFile(this.filePath(id, source.kind));
    } catch {
      throw new AppError(
        'sourceFileMissing',
        '本地资料副本无法读取，请保留数据目录并检查文件或备份。',
      );
    }
    if (data.length !== source.bytes || createHash('sha256').update(data).digest('hex') !== id)
      throw new AppError(
        'sourceChanged',
        '资料副本已被修改，现有引用可能失效。请重新导入修改后的文件。',
      );
    this.storage.touchSource(id);
    return source.kind === 'markdown'
      ? { source, text: data.toString('utf8') }
      : { source, data: new Uint8Array(data) };
  }
  async verify(input: unknown): Promise<void> {
    const id = sourceId(input);
    const source = this.storage.getSource(id);
    if (!source) throw new AppError('sourceMissing', '这份资料不存在，请刷新资料库。');
    const hash = createHash('sha256');
    let bytes = 0;
    try {
      for await (const chunk of createReadStream(this.filePath(id, source.kind))) {
        bytes += chunk.length;
        if (bytes > source.bytes)
          throw new AppError('sourceChanged', '资料副本已被修改，请重新导入。');
        hash.update(chunk);
      }
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('sourceFileMissing', '资料副本无法读取，请检查文件或备份后重试。');
    }
    if (bytes !== source.bytes || hash.digest('hex') !== id)
      throw new AppError('sourceChanged', '资料副本已被修改，请重新导入后再检索和引用。');
  }
  async selection(
    input: unknown,
    anchorInput: unknown,
    quoteInput: unknown,
  ): Promise<import('../../src/lib/types').ReadingSelection> {
    const id = sourceId(input);
    const source = this.storage.getSource(id);
    if (!source) throw new AppError('sourceMissing', '这份资料不存在。');
    if (
      typeof anchorInput !== 'string' ||
      typeof quoteInput !== 'string' ||
      quoteInput.length > 10_000
    )
      throw new AppError('citation', '引用格式无效或选中文字过长。');
    const segment = this.storage.getSegment(id, anchorInput);
    if (!segment) throw new AppError('citation', '无法找到这个资料位置。');
    const normalize = (value: string) => value.replace(/\s+/g, ' ').trim();
    const quote = normalize(quoteInput);
    const pattern = quote
      .split(' ')
      .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('\\s+');
    const match = quote ? new RegExp(pattern, 'u').exec(segment.text) : null;
    let start = match?.index ?? -1;
    let end = start + (match?.[0].length ?? 0);
    if (!match && quote && source.kind === 'markdown') {
      await this.verify(id);
      if (this.markdownCompatibility?.id !== id) {
        const result = await this.parse(
          this.filePath(id, 'markdown'),
          'markdown',
          new AbortController().signal,
          () => {},
        );
        this.markdownCompatibility = { id, result };
      }
      const parsed = this.markdownCompatibility.result;
      const original = parsed.markdownSelections?.find(
        (entry) => entry.anchor === segment.anchor && entry.legacyText === segment.text,
      );
      const canonical = parsed.segments.find((entry) => entry.anchor === segment.anchor);
      const selected = original && canonical ? new RegExp(pattern, 'u').exec(canonical.text) : null;
      if (selected && original) {
        const first = original.spans.find(
          (span) => span.start <= selected.index && span.end > selected.index,
        );
        const lastOffset = selected.index + selected[0].length;
        const last = original.spans.find(
          (span) => span.start < lastOffset && span.end >= lastOffset,
        );
        if (first && last) {
          start = first.legacyStart + selected.index - first.start;
          end = last.legacyStart + lastOffset - last.start;
        }
      }
    }
    if (start < 0 || end <= start)
      throw new AppError('citation', '请选择同一页或同一章节内的原文，再复制引用。');
    return {
      sourceId: id,
      sourceName: source.name,
      kind: source.kind,
      anchor: segment.anchor,
      title: segment.title,
      ...(segment.page ? { page: segment.page } : {}),
      ...(segment.line ? { line: segment.line } : {}),
      text: segment.text.slice(start, end),
      start,
      end,
    };
  }
  async citation(input: unknown, anchorInput: unknown, quoteInput: unknown): Promise<string> {
    const selection = await this.selection(input, anchorInput, quoteInput);
    const location =
      selection.kind === 'pdf'
        ? `第 ${selection.page} 页`
        : `${selection.title} · 第 ${selection.line} 行`;
    return `“${selection.text.replace(/\s+/g, ' ').trim()}”\n——《${selection.sourceName}》${location}\nstudy-companion://source/${selection.sourceId}#${selection.anchor}`;
  }
}
