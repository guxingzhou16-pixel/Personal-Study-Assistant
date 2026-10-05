import { randomUUID } from 'node:crypto';
import { lstat, mkdir, readFile, realpath, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { RestoreReceipt } from '../../src/lib/types';
import { AppError } from './errors';
import { record } from './settings';
import { plainDirectory } from './backup-files';

const ACTIVE = 'active-learning.json';
const PENDING = 'pending-restore.json';
const RESTORES = 'learning-restores';
export interface LearningLocation {
  id: string | null;
  directory: string;
  receipt: RestoreReceipt | null;
}
export interface PendingRestore {
  format: 1;
  id: string;
  previousId: string | null;
}
export function restoreId(input: unknown): string {
  if (typeof input !== 'string' || !/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(input))
    throw new AppError('restoreId', '恢复预览无效，请重新选择备份。');
  return input;
}
async function json(path: string): Promise<unknown | undefined> {
  try {
    const info = await lstat(path);
    if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1 || info.size > 4096)
      throw new AppError('dataLocation', '学习数据位置记录损坏，请保留整个应用数据目录。');
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')
      return undefined;
    throw error instanceof AppError
      ? error
      : new AppError('dataLocation', '学习数据位置记录无法读取，请保留整个应用数据目录。');
  }
}
async function atomicJson(root: string, name: string, value: unknown): Promise<void> {
  const directory = await realpath(root);
  const temporary = join(directory, '.' + name + '.' + randomUUID() + '.tmp');
  try {
    await writeFile(temporary, JSON.stringify(value), { flag: 'wx', flush: true });
    await rename(temporary, join(directory, name));
  } finally {
    await rm(temporary, { force: true }).catch(() => {});
  }
}
export async function restoreDirectory(root: string, id: string): Promise<string> {
  const parent = await plainDirectory(join(await realpath(root), RESTORES));
  return plainDirectory(join(parent, restoreId(id)));
}
export async function createRestoreDirectory(root: string, id: string): Promise<string> {
  const parent = join(await realpath(root), RESTORES);
  await mkdir(parent, { recursive: true });
  await plainDirectory(parent);
  const directory = join(parent, restoreId(id));
  await mkdir(directory);
  return plainDirectory(directory);
}
export async function removeRestoreDirectory(root: string, id: string): Promise<void> {
  // Only a generated UUID child, with both parent and child links rejected, may be removed.
  const current = await learningLocation(root);
  const pending = await pendingRestore(root);
  if (current.id === id || pending?.id === id)
    throw new AppError('restoreProtected', '不能移除正在使用或等待重启的数据。');
  const directory = await restoreDirectory(root, id);
  await rm(directory, { recursive: true });
}
export async function learningLocation(root: string): Promise<LearningLocation> {
  const directory = await realpath(root);
  const raw = await json(join(directory, ACTIVE));
  if (raw === undefined) return { id: null, directory, receipt: null };
  const value = record(raw);
  if (
    value.format !== 1 ||
    Object.keys(value).length !== 4 ||
    !['format', 'id', 'previousId', 'restoredAt'].every((key) => key in value) ||
    typeof value.restoredAt !== 'string' ||
    !Number.isFinite(Date.parse(value.restoredAt))
  )
    throw new AppError('dataLocation', '学习数据位置记录损坏，请保留整个应用数据目录。');
  const id = restoreId(value.id);
  const previousId = value.previousId === null ? null : restoreId(value.previousId);
  if (id === previousId)
    throw new AppError('dataLocation', '学习数据位置不能指向自身作为恢复前位置。');
  const activeDirectory = await restoreDirectory(root, id);
  for (const name of ['study-companion.sqlite3', 'study-activity.sqlite3']) {
    const info = await lstat(join(activeDirectory, name));
    if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1 || info.size < 1)
      throw new AppError(
        'dataLocation',
        '当前学习数据库缺失或无效。请保留整个应用数据目录，不能重新创建空库代替。',
      );
  }
  await plainDirectory(join(activeDirectory, 'sources'));
  return {
    id,
    directory: activeDirectory,
    receipt: {
      restoredAt: value.restoredAt,
      preservedDirectory: previousId ? join(directory, RESTORES, previousId) : directory,
    },
  };
}
export async function pendingRestore(root: string): Promise<PendingRestore | undefined> {
  const raw = await json(join(root, PENDING));
  if (raw === undefined) return;
  const value = record(raw);
  if (
    value.format !== 1 ||
    Object.keys(value).length !== 3 ||
    !['format', 'id', 'previousId'].every((key) => key in value)
  )
    throw new AppError('restorePending', '待恢复记录损坏，当前数据保持不变。');
  return {
    format: 1,
    id: restoreId(value.id),
    previousId: value.previousId === null ? null : restoreId(value.previousId),
  };
}
export async function scheduleRestore(
  root: string,
  id: string,
  previousId: string | null,
): Promise<void> {
  if (await pendingRestore(root))
    throw new AppError('restorePending', '已有等待重启的恢复，请先退出并重新打开应用。');
  const current = await learningLocation(root);
  if (current.id !== previousId || id === previousId)
    throw new AppError('restoreConflict', '学习数据位置已变化，请重新选择备份。');
  await restoreDirectory(root, id);
  await atomicJson(root, PENDING, { format: 1, id: restoreId(id), previousId });
}
export async function activateRestore(
  root: string,
  pending: PendingRestore,
): Promise<LearningLocation> {
  const current = await learningLocation(root);
  if (current.id !== pending.previousId)
    throw new AppError('restoreConflict', '恢复前的数据位置已变化，未切换数据。');
  const directory = await restoreDirectory(root, pending.id);
  const restoredAt = new Date().toISOString();
  // Preserve the exact old pointer as well as the old data directory for manual rollback.
  await atomicJson(
    root,
    'before-restore-' + pending.id + '.json',
    (await json(join(root, ACTIVE))) ?? null,
  );
  await atomicJson(root, ACTIVE, { ...pending, restoredAt });
  // The active pointer is the commit boundary. A leftover pending marker is harmless.
  await rm(join(root, PENDING), { force: true }).catch(() => {});
  return {
    id: pending.id,
    directory,
    receipt: { restoredAt, preservedDirectory: current.directory },
  };
}
export async function clearAppliedRestore(root: string): Promise<void> {
  await rm(join(root, PENDING), { force: true });
}
export async function quarantineRestore(root: string): Promise<void> {
  await rename(join(root, PENDING), join(root, 'pending-restore.failed-' + randomUUID() + '.json'));
}
