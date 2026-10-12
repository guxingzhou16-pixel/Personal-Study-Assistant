import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { rm } from 'node:fs/promises';
import { renameSync } from 'node:fs';
import type {
  CitationTarget,
  Evidence,
  EvidencePreview,
  RetrievalProgress,
  ReadingSelection,
} from '../../src/lib/types';
import type { Storage } from './storage';
import { AppError } from './errors';
import { string } from './settings';
import { sourceId } from './documents';
import { chatId } from './chat-storage';

type SearchMessage =
  | { type: 'result'; result: Omit<EvidencePreview, 'id'> }
  | { type: 'progress'; progress: RetrievalProgress }
  | { type: 'error'; code: string; message: string };
export interface SearchProcess {
  on(event: 'message', listener: (message: SearchMessage) => void): unknown;
  on(event: 'error', listener: () => void): unknown;
  on(event: 'exit', listener: (code: number | null) => void): unknown;
  kill(): boolean;
}
export type SearchLauncher = (modulePath: string, args: string[]) => SearchProcess;
export class SearchService {
  private active?: () => void;
  private readonly previews = new Map<string, { value: EvidencePreview; expires: number }>();
  constructor(
    private readonly storage: Storage,
    private readonly directory: string,
    private readonly workerPath: string,
    private readonly launch: SearchLauncher,
    private readonly verifySource: (id: string) => Promise<void>,
    private readonly modelPath: () => string | null = () => null,
  ) {}
  private checkEvidence(hit: Evidence): CitationTarget {
    const source = this.storage.getSource(hit.sourceId);
    const segment = this.storage.getSegment(hit.sourceId, hit.anchor);
    if (
      !source ||
      !segment ||
      hit.sourceName !== source.name ||
      hit.kind !== source.kind ||
      hit.title !== segment.title ||
      hit.page !== segment.page ||
      hit.line !== segment.line ||
      !Number.isInteger(hit.start) ||
      !Number.isInteger(hit.end) ||
      hit.start < 0 ||
      hit.end > segment.text.length ||
      hit.end <= hit.start ||
      segment.text.slice(hit.start, hit.end) !== hit.text
    )
      throw new AppError('citation', '这条引用与原文不一致，请重新检索资料。');
    return { sourceId: source.id, anchor: segment.anchor, page: segment.page ?? 1 };
  }
  prepare(
    input: unknown,
    sourceInput: unknown,
    progress: (value: RetrievalProgress) => void,
    selection?: ReadingSelection,
  ): Promise<EvidencePreview> {
    const question = string(input, '问题', 4000);
    if (!question) return Promise.reject(new AppError('question', '请先输入具体问题。'));
    const scope = sourceInput === null || sourceInput === undefined ? null : sourceId(sourceInput);
    return this.run(question, scope, false, progress).then((value) => {
      const hits = selection
        ? [
            selection,
            ...value.hits.filter(
              (hit) =>
                !(
                  hit.sourceId === selection.sourceId &&
                  hit.anchor === selection.anchor &&
                  hit.start < selection.end &&
                  hit.end > selection.start
                ),
            ),
          ]
            .slice(0, 4)
            .map((hit, index) => ({ ...hit, number: index + 1 }))
        : value.hits;
      const preview = {
        ...value,
        hits,
        id: randomUUID(),
        ...(selection ? { notice: `已加入你选中的确切原文，位置已核对。 ${value.notice}` } : {}),
      };
      if (this.previews.size >= 10) this.previews.delete(this.previews.keys().next().value!);
      this.previews.set(preview.id, {
        value: structuredClone(preview),
        expires: Date.now() + 600_000,
      });
      return preview;
    });
  }
  async rebuild(progress: (value: RetrievalProgress) => void): Promise<string> {
    const result = await this.run('', null, true, progress);
    this.previews.clear();
    return result.notice;
  }
  consume(input: unknown, question: string): EvidencePreview {
    const id = chatId(input);
    const preview = this.previews.get(id);
    if (!preview || preview.expires < Date.now() || preview.value.question !== question)
      throw new AppError('previewExpired', '问题或检索预览已变化/过期，请重新检索后发送。');
    for (const hit of preview.value.hits) this.checkEvidence(hit);
    return structuredClone(preview.value);
  }
  async resolveCitation(turnInput: unknown, numberInput: unknown): Promise<CitationTarget> {
    const turn = this.storage.chat.getTurn(turnInput);
    if (typeof numberInput !== 'number' || !Number.isInteger(numberInput))
      throw new AppError('citation', '引用编号无效。');
    const hit = turn.evidence.find((entry) => entry.number === numberInput);
    if (turn.mode !== 'sources' || !hit)
      throw new AppError('citation', '这条引用不在实际检索结果中。');
    const target = this.checkEvidence(hit);
    await this.verifySource(target.sourceId);
    return target;
  }
  cancel(): void {
    this.active?.();
  }
  get busy(): boolean {
    return this.active !== undefined;
  }
  private run(
    question: string,
    scope: string | null,
    rebuild: boolean,
    progress: (value: RetrievalProgress) => void,
  ): Promise<Omit<EvidencePreview, 'id'>> {
    const model = this.modelPath();
    return this.runWorker(question, scope, rebuild, progress, model).catch((error) => {
      if (
        !model ||
        !(error instanceof AppError) ||
        !['indexProcess', 'indexTimeout'].includes(error.code)
      )
        throw error;
      progress({ current: 0, total: 0, message: '语义处理未完成，正在使用关键词检索…' });
      return this.runWorker(question, scope, rebuild, progress, null).then((result) => ({
        ...result,
        notice: `语义检索进程退出或超时，已使用关键词检索。可在设置中检查模型并重试。 ${result.notice}`,
      }));
    });
  }
  private runWorker(
    question: string,
    scope: string | null,
    rebuild: boolean,
    progress: (value: RetrievalProgress) => void,
    modelPath: string | null,
  ): Promise<Omit<EvidencePreview, 'id'>> {
    if (this.active)
      return Promise.reject(new AppError('searchBusy', '已有检索正在进行，请先取消或等待完成。'));
    const indexPath = join(this.directory, 'search-index.sqlite3');
    const staged = rebuild
      ? join(this.directory, `search-index.${randomUUID()}.sqlite3`)
      : undefined;
    return new Promise((resolve, reject) => {
      const worker = this.launch(this.workerPath, [
        join(this.directory, 'study-companion.sqlite3'),
        staged ?? indexPath,
        question,
        scope ?? '',
        rebuild ? '1' : '0',
        modelPath ?? '',
      ]);
      let finished = false;
      let resultReceived = false;
      let exited = false;
      const cleanup = () => {
        if (staged)
          void rm(staged, { force: true }).catch(() => {
            /* Cancelled derived staging files are safe to keep if Windows still holds them. */
          });
      };
      const finish = (error?: unknown, result?: Omit<EvidencePreview, 'id'>) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        worker.kill();
        this.active = undefined;
        if (exited) cleanup();
        if (error) reject(error);
        else resolve(result!);
      };
      const timer = setTimeout(
        () => finish(new AppError('indexTimeout', '索引处理超过 5 分钟，请缩小资料规模后重试。')),
        300_000,
      );
      this.active = () => finish(new AppError('cancelled', '已取消资料检索，原资料和旧索引保留。'));
      worker.on('message', (message) => {
        if (finished) return;
        if (message.type === 'progress') progress(message.progress);
        else if (message.type === 'error') finish(new AppError(message.code, message.message));
        else if (message.type === 'result' && !resultReceived) {
          resultReceived = true;
          void (async () => {
            const result = message.result;
            if (result.question !== question || result.sourceId !== scope || result.hits.length > 4)
              throw new AppError('retrieval', '检索结果格式无效，请重新建立索引。');
            for (const id of new Set(result.hits.map((hit) => hit.sourceId)))
              await this.verifySource(id);
            for (const [index, hit] of result.hits.entries()) {
              if (hit.number !== index + 1)
                throw new AppError('retrieval', '检索引用编号无效，请重新建立索引。');
              if (scope !== null && hit.sourceId !== scope)
                throw new AppError('retrieval', '检索结果超出所选资料范围。');
              this.checkEvidence(hit);
            }
            if (finished) return;
            if (staged) renameSync(staged, indexPath);
            finish(undefined, result);
          })().catch((error) => finish(error));
        }
      });
      worker.on('error', () =>
        finish(new AppError('indexProcess', '检索进程无法启动，请重新构建或检查安装文件。')),
      );
      worker.on('exit', () => {
        exited = true;
        if (!finished && !resultReceived)
          finish(new AppError('indexProcess', '检索进程意外退出，请重建索引后重试。'));
        if (finished) cleanup();
      });
    });
  }
}
