import type { BackupManifest } from '../../src/lib/types';
import { backupLimits } from '../../src/lib/backup';
import { AppError } from './errors';
import { readManifest, type BackupProgress } from './backup-files';

type BackupMessage =
  | { type: 'result'; result: unknown }
  | { type: 'progress'; current: number; total: number; message: string }
  | { type: 'error'; code: string; message: string };
export interface BackupProcess {
  on(event: 'message', listener: (message: BackupMessage) => void): unknown;
  on(event: 'error', listener: () => void): unknown;
  on(event: 'exit', listener: (code: number | null) => void): unknown;
  kill(): boolean;
}
export type BackupLauncher = (path: string, args: string[]) => BackupProcess;

export class BackupRunner {
  private cancelActive?: () => void;
  constructor(
    private readonly workerPath: string,
    private readonly launch: BackupLauncher,
  ) {}
  cancel(): void {
    this.cancelActive?.();
  }
  run(
    operation: 'export' | 'inspect' | 'verify',
    source: string,
    destination: string,
    progress: BackupProgress,
  ): Promise<BackupManifest> {
    if (this.cancelActive) throw new AppError('backupBusy', '请先完成当前备份操作。');
    return new Promise((resolve, reject) => {
      const worker = this.launch(this.workerPath, [operation, source, destination]);
      let result: BackupManifest | undefined;
      let error: unknown;
      let finished = false;
      const stop = (reason: unknown) => {
        error ??= reason;
        worker.kill();
      };
      const timer = setTimeout(
        () =>
          stop(
            new AppError('backupTimeout', '备份处理超过 30 分钟，请检查磁盘或缩小资料规模后重试。'),
          ),
        backupLimits.workerMs,
      );
      this.cancelActive = () =>
        stop(new AppError('cancelled', '已取消，当前学习数据没有被恢复替换。'));
      worker.on('message', (message) => {
        if (finished || error) return;
        if (message.type === 'progress') progress(message.current, message.total, message.message);
        else if (message.type === 'result') {
          try {
            result = readManifest(message.result);
          } catch (failure) {
            error = failure;
          }
          worker.kill();
        } else if (message.type === 'error') stop(new AppError(message.code, message.message));
      });
      worker.on('error', () =>
        stop(new AppError('backupWorker', '备份进程无法运行，请重新构建应用后重试。')),
      );
      // Wait for exit before deleting a staged directory or unlocking writes.
      worker.on('exit', () => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        this.cancelActive = undefined;
        if (error) reject(error);
        else if (result) resolve(result);
        else reject(new AppError('backupWorker', '备份进程提前结束，操作未完成。'));
      });
    });
  }
}
