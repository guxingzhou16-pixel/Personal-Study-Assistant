import { performance } from 'node:perf_hooks';
import type {
  FocusAction,
  FocusEndReason,
  FocusOverview,
  FocusReviewResult,
  FocusSession,
} from '../../src/lib/types';
import { focusLimits } from '../../src/lib/focus';
import { AppError } from './errors';
import { FocusStorage, focusId, focusMinutes, focusReview, focusRevision } from './focus-storage';
import { PlanningStorage } from './planning-storage';
import { record } from './settings';

function increment(revision: number): number {
  if (revision === Number.MAX_SAFE_INTEGER)
    throw new AppError('focusRevision', '专注版本达到上限，请保留数据并检查备份。');
  return revision + 1;
}

export class FocusTracker {
  private current: FocusSession | null;
  private lastTick = 0;
  private pendingInterruption = false;
  private version = 0;

  constructor(
    private readonly storage: FocusStorage,
    private readonly planning: PlanningStorage,
    private readonly now = () => new Date(),
    private readonly monotonic = () => performance.now(),
  ) {
    this.current = storage.active();
    if (this.current) this.end('interrupted', 'app-restart');
  }

  private write(next: FocusSession): void {
    if (!this.current) throw new AppError('focusMissing', '当前没有专注记录。');
    try {
      this.current = this.storage.save(this.current, next);
    } catch (error) {
      this.storageFailure(error, '专注保存失败');
    }
  }

  private storageFailure(error: unknown, label: string): never {
    if (this.current) {
      this.pendingInterruption = true;
      this.lastTick = 0;
    }
    const detail = error instanceof AppError ? error.message : '请检查磁盘空间和数据目录权限。';
    throw new AppError(
      'focusStorage',
      `${label}，未确认写入${this.current ? '；当前专注已停止计时' : ''}。${detail}`,
    );
  }

  private end(status: 'completed' | 'stopped' | 'interrupted', reason: FocusEndReason): void {
    if (!this.current) return;
    const now = this.now().toISOString();
    this.write({
      ...this.current,
      status,
      reason,
      elapsedMs:
        status === 'completed' ? this.current.plannedMinutes * 60000 : this.current.elapsedMs,
      endedAt: now,
      updatedAt: now,
      revision: increment(this.current.revision),
    });
    this.current = null;
    this.lastTick = 0;
    this.pendingInterruption = false;
  }

  private recoverStorageFailure(): void {
    if (!this.pendingInterruption) return;
    this.end('interrupted', 'storage-error');
  }

  private snapshot(): FocusOverview {
    const recent = this.storage.recent();
    this.version += 1;
    return {
      current: this.current ? structuredClone(this.current) : null,
      recent,
      version: this.version,
    };
  }

  overview(): FocusOverview {
    this.recoverStorageFailure();
    this.checkpoint();
    return this.snapshot();
  }

  start(input: unknown): FocusOverview {
    const data = record(input);
    if (Object.keys(data).some((key) => !['taskId', 'taskRevision', 'minutes'].includes(key)))
      throw new AppError('validation', '专注请求包含不支持的字段。');
    const taskId = focusId(data.taskId);
    const taskRevision = focusRevision(data.taskRevision);
    const minutes = focusMinutes(data.minutes);
    this.recoverStorageFailure();
    this.checkpoint();
    if (this.current) throw new AppError('focusActive', '请先结束当前专注，再开始新的一轮。');
    const task = this.planning.getTask(taskId);
    if (task.revision !== taskRevision || task.status !== 'todo')
      throw new AppError('focusTaskConflict', '任务已更新或完成，请重新加载后再开始。');
    this.current = this.storage.create(task, minutes, this.now().toISOString());
    this.lastTick = this.monotonic();
    return this.snapshot();
  }

  control(idInput: unknown, revisionInput: unknown, actionInput: unknown): FocusOverview {
    const id = focusId(idInput);
    const revision = focusRevision(revisionInput);
    if (
      !['pause', 'resume', 'stop'].includes(String(actionInput)) ||
      typeof actionInput !== 'string'
    )
      throw new AppError('focusAction', '专注操作无效，请重新加载。');
    const action = actionInput as FocusAction;
    this.recoverStorageFailure();
    if (!this.current || this.current.id !== id || this.current.revision !== revision)
      throw new AppError('focusConflict', '专注状态已变化，请重新加载后再操作。');
    // Elapsed-only checkpoints keep revision stable; user transitions and completion change it.
    this.checkpoint();
    if (!this.current) return this.snapshot();
    if (action === 'stop') {
      this.end('stopped', 'user-stop');
    } else {
      const expected = action === 'pause' ? 'running' : 'paused';
      if (this.current.status !== expected)
        throw new AppError('focusState', '当前专注状态不支持这个操作，请重新加载。');
      this.write({
        ...this.current,
        status: action === 'pause' ? 'paused' : 'running',
        updatedAt: this.now().toISOString(),
        revision: increment(this.current.revision),
      });
      this.lastTick = this.monotonic();
    }
    return this.snapshot();
  }

  saveReview(idInput: unknown, revisionInput: unknown, reviewInput: unknown): FocusReviewResult {
    const id = focusId(idInput);
    const revision = focusRevision(revisionInput);
    const review = focusReview(reviewInput);
    this.recoverStorageFailure();
    let current = this.storage.get(id);
    if (current.status === 'running' || current.status === 'paused')
      throw new AppError('focusReviewActive', '请结束本轮专注后再写复盘。');
    if (current.revision !== revision)
      throw new AppError('focusConflict', '复盘记录已更新，未覆盖新版本。请保留草稿并重新加载。');
    if (current.review !== review) {
      try {
        current = this.storage.save(current, {
          ...current,
          review,
          updatedAt: this.now().toISOString(),
          revision: increment(current.revision),
        });
      } catch (error) {
        this.storageFailure(error, '复盘保存失败');
      }
    }
    return { session: current, overview: this.overview() };
  }

  checkpoint(): void {
    if (this.pendingInterruption || this.current?.status !== 'running') return;
    const tick = this.monotonic();
    const interval = tick - this.lastTick;
    if (!Number.isFinite(interval) || interval < 0 || interval > focusLimits.heartbeatMs) {
      this.interrupt('heartbeat-gap');
      return;
    }
    const elapsed = Math.floor(interval);
    if (elapsed === 0) return;
    if (this.current.elapsedMs + elapsed >= this.current.plannedMinutes * 60000) {
      this.end('completed', 'elapsed');
      return;
    }
    this.write({
      ...this.current,
      elapsedMs: this.current.elapsedMs + elapsed,
      updatedAt: this.now().toISOString(),
    });
    this.lastTick += elapsed;
  }

  interrupt(reason: FocusEndReason): void {
    if (
      !['sleep', 'app-exit', 'renderer-reload', 'storage-error', 'heartbeat-gap'].includes(reason)
    )
      throw new AppError('focusReason', '专注中断原因无效。');
    if (!this.current) return;
    // Preserve only the last durable heartbeat. Interruptions never infer completion at a boundary.
    if (this.pendingInterruption) {
      this.recoverStorageFailure();
      return;
    }
    this.end('interrupted', reason);
  }
}
