import { randomUUID } from 'node:crypto';
import { mkdir, rename, rm } from 'node:fs/promises';
import { basename, join } from 'node:path';
import type { BackupManifest, BackupState, RestorePreview } from '../../src/lib/types';
import { backupLimits } from '../../src/lib/backup';
import { AppError, failure } from './errors';
import { BackupRunner } from './backup-runner';
import { externalDirectory, plainDirectory } from './backup-files';
import {
  createRestoreDirectory,
  removeRestoreDirectory,
  restoreId,
  scheduleRestore,
  type LearningLocation,
} from './data-location';

interface BackupHost {
  selectFolder(purpose: 'export' | 'restore'): Promise<string | null>;
  approveRestore(preview: RestorePreview): Promise<boolean>;
  requireIdle(): void;
  notify(state: BackupState): void;
  restart(): void;
}
interface CachedRestore {
  preview: RestorePreview;
  directory: string;
  manifest: BackupManifest;
}

export class BackupService {
  private readonly state: BackupState;
  private cached?: CachedRestore;
  private cancelled = false;
  constructor(
    private readonly root: string,
    private readonly location: LearningLocation,
    private readonly runner: BackupRunner,
    private readonly host: BackupHost,
  ) {
    this.state = {
      revision: 0,
      learningDirectory: location.directory,
      operation: 'idle',
      progress: null,
      preview: null,
      lastExport: null,
      lastError: null,
      restoreReceipt: location.receipt,
    };
  }
  get busy(): boolean {
    return this.state.operation !== 'idle';
  }
  snapshot(): BackupState {
    return structuredClone(this.state);
  }
  private update(change: Partial<BackupState>): void {
    Object.assign(this.state, change);
    this.state.revision++;
    this.host.notify(this.snapshot());
  }
  private begin(operation: 'export' | 'inspect' | 'confirm'): void {
    if (this.busy) throw new AppError('backupBusy', '请先完成当前备份或恢复操作。');
    this.host.requireIdle();
    this.cancelled = false;
    this.update({
      operation,
      lastError: null,
      progress: { current: 0, total: 0, message: '请选择文件夹…' },
    });
  }
  private checkCancelled(): void {
    if (this.cancelled) throw new AppError('cancelled', '已取消，当前学习数据保持不变。');
  }
  private progress = (current: number, total: number, message: string): void => {
    this.update({ progress: { current, total, message } });
  };
  cancel(): void {
    if (this.state.operation === 'commit' || this.state.operation === 'restart')
      throw new AppError(
        'restoreScheduled',
        '已进入最后的写入阶段，无法取消；请等待结果。恢复前的学习数据会保留。',
      );
    this.cancelled = true;
    this.runner.cancel();
  }
  private report(error: unknown): void {
    const reported = failure(error);
    this.update({ lastError: reported.code === 'cancelled' ? null : reported.message });
  }
  async export(): Promise<BackupState> {
    this.begin('export');
    let temporary: string | undefined;
    let parent: string | undefined;
    try {
      const selection = await this.host.selectFolder('export');
      if (!selection) throw new AppError('cancelled', '已取消选择。');
      this.checkCancelled();
      parent = await externalDirectory(selection, this.root);
      const id = randomUUID();
      temporary = join(parent, '.拾知备份-' + id);
      await mkdir(temporary);
      this.checkCancelled();
      const manifest = await this.runner.run(
        'export',
        this.location.directory,
        temporary,
        this.progress,
      );
      this.checkCancelled();
      const name =
        '拾知备份-' +
        manifest.createdAt.replace(/[:.]/g, '-').replace('T', '_').replace('Z', '') +
        '-' +
        id.slice(0, 8);
      const destination = join(parent, name);
      this.update({
        operation: 'commit',
        progress: { current: 0, total: 0, message: '正在完成备份文件夹，请稍候…' },
      });
      await rename(temporary, destination);
      temporary = undefined;
      this.update({
        lastExport: {
          directory: destination,
          createdAt: manifest.createdAt,
          counts: manifest.counts,
        },
      });
    } catch (error) {
      this.report(error);
    } finally {
      if (temporary && parent) {
        try {
          // Only this operation's fresh UUID child can be cleaned, never the selected parent.
          if (
            (await plainDirectory(parent)) !== parent ||
            (await plainDirectory(temporary)) !== temporary
          )
            throw new Error('Directory changed');
          await rm(temporary, { recursive: true });
        } catch {
          this.update({
            lastError: '未完成的备份文件夹未能清理。请保留当前数据，并检查所选目录权限。',
          });
        }
      }
      this.update({ operation: 'idle', progress: null });
    }
    return this.snapshot();
  }
  async inspect(): Promise<BackupState> {
    this.begin('inspect');
    let id: string | undefined;
    let keep = false;
    try {
      const selection = await this.host.selectFolder('restore');
      if (!selection) throw new AppError('cancelled', '已取消选择。');
      this.checkCancelled();
      await externalDirectory(selection, this.root);
      if (this.cached) await this.removeCached();
      this.checkCancelled();
      id = randomUUID();
      const directory = await createRestoreDirectory(this.root, id);
      this.checkCancelled();
      const manifest = await this.runner.run('inspect', selection, directory, this.progress);
      this.checkCancelled();
      const preview: RestorePreview = {
        id,
        folderName: basename(selection),
        createdAt: manifest.createdAt,
        expiresAt: new Date(Date.now() + backupLimits.previewMs).toISOString(),
        mainVersion: manifest.mainVersion,
        activityVersion: manifest.activityVersion,
        counts: manifest.counts,
        bytes: manifest.files.reduce((sum, file) => sum + file.bytes, 0),
      };
      this.cached = { preview, directory, manifest };
      keep = true;
      this.update({ preview });
    } catch (error) {
      this.report(error);
    } finally {
      if (id && !keep) {
        try {
          await removeRestoreDirectory(this.root, id);
        } catch {
          this.update({
            lastError:
              '恢复未完成，暂存副本未能清理。当前学习数据保持不变，请检查应用数据目录权限。',
          });
        }
      }
      this.update({ operation: 'idle', progress: null });
    }
    return this.snapshot();
  }
  private async removeCached(): Promise<void> {
    if (!this.cached) return;
    await removeRestoreDirectory(this.root, this.cached.preview.id);
    this.cached = undefined;
    this.update({ preview: null });
  }
  async discard(input: unknown): Promise<BackupState> {
    const id = restoreId(input);
    if (this.busy) throw new AppError('backupBusy', '请先取消当前操作再放弃恢复预览。');
    if (!this.cached || this.cached.preview.id !== id)
      throw new AppError('restoreExpired', '恢复预览已失效，请重新选择备份。');
    this.begin('inspect');
    try {
      await this.removeCached();
    } catch (error) {
      this.report(error);
    } finally {
      this.update({ operation: 'idle', progress: null });
    }
    return this.snapshot();
  }
  async releasePreview(): Promise<void> {
    if (!this.cached || this.busy) return;
    this.update({
      operation: 'commit',
      progress: { current: 0, total: 0, message: '正在清理未确认的恢复副本…' },
    });
    try {
      await this.removeCached();
    } finally {
      this.update({ operation: 'idle', progress: null });
    }
  }
  async confirm(input: unknown): Promise<BackupState> {
    const id = restoreId(input);
    if (
      !this.cached ||
      this.cached.preview.id !== id ||
      Date.parse(this.cached.preview.expiresAt) <= Date.now()
    )
      throw new AppError('restoreExpired', '恢复预览已过期，请重新选择备份。');
    this.begin('confirm');
    const cached = this.cached;
    try {
      if (!(await this.host.approveRestore(cached.preview)))
        throw new AppError('cancelled', '已取消确认。');
      this.checkCancelled();
      if (Date.parse(cached.preview.expiresAt) <= Date.now())
        throw new AppError('restoreExpired', '确认期间预览已过期，请重新选择备份。');
      const actual = await this.runner.run('verify', cached.directory, '', this.progress);
      this.checkCancelled();
      if (JSON.stringify(actual) !== JSON.stringify(cached.manifest))
        throw new AppError('restoreChanged', '暂存备份在预览后被修改，请重新选择备份。');
      if (Date.parse(cached.preview.expiresAt) <= Date.now())
        throw new AppError('restoreExpired', '校验期间预览已过期，请重新选择备份。');
      this.update({
        operation: 'commit',
        progress: { current: 0, total: 0, message: '正在提交恢复记录，请等待应用重启…' },
      });
      await scheduleRestore(this.root, id, this.location.id);
      // A durable pending marker consumes the preview, even if the IPC reply is lost.
      this.cached = undefined;
      this.update({
        operation: 'restart',
        preview: null,
        progress: { current: 0, total: 0, message: '恢复已准备，正在退出并重新打开应用…' },
      });
      this.host.restart();
    } catch (error) {
      this.report(error);
    } finally {
      if (this.state.operation !== 'restart') this.update({ operation: 'idle', progress: null });
    }
    return this.snapshot();
  }
}
