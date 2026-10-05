import { createHash } from 'node:crypto';
import { lstat, mkdir, open, readdir, realpath, writeFile } from 'node:fs/promises';
import { isAbsolute, join, relative, sep } from 'node:path';
import { backup, DatabaseSync } from 'node:sqlite';
import type { BackupCounts, BackupFile, BackupManifest } from '../../src/lib/types';
import { backupLimits, backupCountLabels } from '../../src/lib/backup';

import { AppError } from './errors';
import { record } from './settings';

import { DOCUMENT_LIMITS } from './documents';

import { MAIN_DATABASE, ACTIVITY_DATABASE, inspectDatabases } from './backup-data';

export const MANIFEST = 'manifest.json';
export type BackupProgress = (current: number, total: number, message: string) => void;
function invalid(message = '备份格式或内容不完整，请保留原文件并重新导出。'): never {
  throw new AppError('backupInvalid', message);
}
function fields(input: unknown, keys: string[]): Record<string, unknown> {
  const value = record(input);
  if (Object.keys(value).length !== keys.length || keys.some((key) => !(key in value))) invalid();
  return value;
}
function integer(value: unknown, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max)
    invalid();
  return value;
}
export function readManifest(input: unknown): BackupManifest {
  const value = fields(input, [
    'format',
    'application',
    'createdAt',
    'mainVersion',
    'activityVersion',
    'counts',
    'files',
  ]);
  if (value.format !== backupLimits.format || value.application !== 'StudyCompanion')
    invalid('这不是当前版本支持的拾知备份（格式 1）。请使用对应的软件版本打开。');
  if (
    value.mainVersion !== backupLimits.mainVersion ||
    value.activityVersion !== backupLimits.activityVersion
  )
    invalid('备份的数据库版本不兼容；当前支持主库 11、学习记录库 1。请使用对应版本的应用导出。');
  if (
    typeof value.createdAt !== 'string' ||
    !Number.isFinite(Date.parse(value.createdAt)) ||
    new Date(value.createdAt).toISOString() !== value.createdAt
  )
    invalid();
  const rawCounts = fields(
    value.counts,
    backupCountLabels.map(({ key }) => key),
  );
  const counts = Object.fromEntries(
    backupCountLabels.map(({ key }) => [key, integer(rawCounts[key], 0, 1_000_000)]),
  ) as unknown as BackupCounts;
  if (
    !Array.isArray(value.files) ||
    value.files.length < 2 ||
    value.files.length > backupLimits.files
  )
    invalid();
  let bytes = 0;
  const paths = new Set<string>();
  const files = value.files.map((raw): BackupFile => {
    const file = fields(raw, ['path', 'bytes', 'sha256']);
    if (
      typeof file.path !== 'string' ||
      (![MAIN_DATABASE, ACTIVITY_DATABASE].includes(file.path) &&
        !/^sources\/[a-f0-9]{64}\.(pdf|md)$/.test(file.path))
    )
      invalid('备份含有不允许的文件路径。');
    const limit = file.path.startsWith('sources/')
      ? file.path.endsWith('.pdf')
        ? DOCUMENT_LIMITS.pdf
        : DOCUMENT_LIMITS.markdown
      : backupLimits.databaseBytes;
    const size = integer(file.bytes, 1, limit);
    if (
      typeof file.sha256 !== 'string' ||
      !/^[a-f0-9]{64}$/.test(file.sha256) ||
      paths.has(file.path)
    )
      invalid();
    if (file.path.startsWith('sources/') && file.sha256 !== file.path.slice(8, 72))
      invalid('资料摘要与备份文件名不一致。');
    paths.add(file.path);
    bytes += size;
    return { path: file.path, bytes: size, sha256: file.sha256 };
  });
  if (
    bytes > backupLimits.totalBytes ||
    !paths.has(MAIN_DATABASE) ||
    !paths.has(ACTIVITY_DATABASE) ||
    files.length !== counts.sources + 2
  )
    invalid();
  return {
    format: 1,
    application: 'StudyCompanion',
    createdAt: value.createdAt,
    mainVersion: backupLimits.mainVersion,
    activityVersion: backupLimits.activityVersion,
    counts,
    files,
  };
}

export async function plainDirectory(path: string): Promise<string> {
  const info = await lstat(path);
  if (!info.isDirectory() || info.isSymbolicLink()) invalid('备份目录不能是链接或非目录文件。');
  return realpath(path);
}
export function inside(parent: string, child: string): boolean {
  const location = relative(parent, child);
  return (
    !location || (location !== '..' && !location.startsWith('..' + sep) && !isAbsolute(location))
  );
}
export async function externalDirectory(path: string, dataRoot: string): Promise<string> {
  const parent = await plainDirectory(path);
  if (inside(await realpath(dataRoot), parent))
    throw new AppError('backupLocation', '请选择应用数据目录以外的位置。');
  return parent;
}
async function plainFile(path: string, limit: number): Promise<void> {
  const info = await lstat(path);
  if (
    !info.isFile() ||
    info.isSymbolicLink() ||
    info.nlink !== 1 ||
    info.size < 1 ||
    info.size > limit
  )
    invalid('备份文件缺失、过大或使用了文件链接。');
}
async function readSmallJson(path: string, limit: number): Promise<unknown> {
  await plainFile(path, limit);
  const file = await open(path, 'r');
  try {
    const buffer = Buffer.alloc(limit + 1);
    let used = 0;
    while (used < buffer.length) {
      const read = await file.read(buffer, used, buffer.length - used, null);
      if (!read.bytesRead) break;
      used += read.bytesRead;
    }
    if (used > limit) invalid('备份清单超过大小限制。');
    return JSON.parse(buffer.subarray(0, used).toString('utf8'));
  } finally {
    await file.close();
  }
}
// Streaming avoids loading a PDF or database into the main process or worker heap.
async function transfer(
  path: string,
  limit: number,
  destination?: string,
): Promise<{ bytes: number; sha256: string }> {
  await plainFile(path, limit);
  const source = await open(path, 'r');
  let target: Awaited<ReturnType<typeof open>> | undefined;
  const hash = createHash('sha256');
  let bytes = 0;
  try {
    target = destination ? await open(destination, 'wx') : undefined;
    const buffer = Buffer.alloc(256 * 1024);
    for (;;) {
      const read = await source.read(buffer, 0, buffer.length, null);
      if (!read.bytesRead) break;
      bytes += read.bytesRead;
      if (bytes > limit) invalid('备份文件在读取期间超过大小限制。');
      const chunk = buffer.subarray(0, read.bytesRead);
      hash.update(chunk);
      if (target) {
        let offset = 0;
        while (offset < chunk.length) {
          const written = await target.write(chunk, offset, chunk.length - offset, null);
          if (!written.bytesWritten) throw new AppError('backupWrite', '备份文件未能完整写入。');
          offset += written.bytesWritten;
        }
      }
    }
    await target?.sync();
    return { bytes, sha256: hash.digest('hex') };
  } finally {
    await source.close();
    await target?.close();
  }
}

async function inventory(directory: string, manifest: BackupManifest): Promise<void> {
  const entries = await readdir(directory);
  if (
    entries.length !== 4 ||
    ![MAIN_DATABASE, ACTIVITY_DATABASE, MANIFEST, 'sources'].every((name) => entries.includes(name))
  )
    invalid('请选完整备份文件夹；不能包含密钥、缓存或其他额外文件。');
  await plainDirectory(join(directory, 'sources'));
  const sourceFiles = await readdir(join(directory, 'sources'));
  const expected = new Set(
    manifest.files
      .filter((file) => file.path.startsWith('sources/'))
      .map((file) => file.path.slice(8)),
  );
  if (sourceFiles.length !== expected.size || sourceFiles.some((name) => !expected.has(name)))
    invalid('资料副本与备份清单不一致。');
}
export async function verifyBackup(
  directoryInput: string,
  progress: BackupProgress,
  destination?: string,
): Promise<BackupManifest> {
  const directory = await plainDirectory(directoryInput);
  const manifest = readManifest(
    await readSmallJson(join(directory, MANIFEST), backupLimits.manifestBytes),
  );
  await inventory(directory, manifest);
  if (destination) await mkdir(join(destination, 'sources'));
  for (let index = 0; index < manifest.files.length; index++) {
    const file = manifest.files[index];
    progress(index, manifest.files.length, '校验并暂存备份文件…');
    const actual = await transfer(
      join(directory, file.path),
      file.bytes,
      destination ? join(destination, file.path) : undefined,
    );
    if (actual.bytes !== file.bytes || actual.sha256 !== file.sha256)
      invalid('备份文件摘要不一致，文件可能缺失、损坏或在校验时被修改。');
  }
  const checked = inspectDatabases(destination ?? directory);
  if (
    backupCountLabels.some(({ key }) => manifest.counts[key] !== checked.counts[key]) ||
    checked.sources.some(
      (source) =>
        !manifest.files.some(
          (file) =>
            file.path === source.path &&
            file.bytes === source.bytes &&
            file.sha256 === source.sha256,
        ),
    )
  )
    invalid('数据库记录与资料清单或数量不一致。');
  if (destination)
    await writeFile(join(destination, MANIFEST), JSON.stringify(manifest, null, 2), {
      flag: 'wx',
      flush: true,
    });
  progress(manifest.files.length, manifest.files.length, '备份完整性校验完成。');
  return manifest;
}

export async function writeBackup(
  learningDirectory: string,
  destination: string,
  progress: BackupProgress,
): Promise<BackupManifest> {
  await plainDirectory(learningDirectory);
  await plainDirectory(join(learningDirectory, 'sources'));
  await mkdir(join(destination, 'sources'));
  for (const name of [MAIN_DATABASE, ACTIVITY_DATABASE]) {
    await plainFile(join(learningDirectory, name), backupLimits.databaseBytes);
    progress(0, 0, '保存数据库一致性快照…');
    const db = new DatabaseSync(join(learningDirectory, name), {
      readOnly: true,
      allowExtension: false,
    });
    try {
      await backup(db, join(destination, name));
    } finally {
      db.close();
    }
    // A standalone export must not depend on a WAL sidecar.
    const exported = new DatabaseSync(join(destination, name));
    try {
      exported.exec('PRAGMA journal_mode = DELETE;');
    } finally {
      exported.close();
    }
  }
  const checked = inspectDatabases(destination);
  const files: BackupFile[] = [];
  for (const name of [MAIN_DATABASE, ACTIVITY_DATABASE])
    files.push({
      path: name,
      ...(await transfer(join(destination, name), backupLimits.databaseBytes)),
    });
  if (
    files.reduce((sum, file) => sum + file.bytes, 0) +
      checked.sources.reduce((sum, file) => sum + file.bytes, 0) >
    backupLimits.totalBytes
  )
    invalid('完整备份超过当前版本的 50 GiB 限制，请保留数据并等待更大资料库支持。');
  for (let index = 0; index < checked.sources.length; index++) {
    const source = checked.sources[index];
    progress(index, checked.sources.length, '复制并核对资料副本…');
    const actual = await transfer(
      join(learningDirectory, source.path),
      source.bytes,
      join(destination, source.path),
    );
    if (actual.bytes !== source.bytes || actual.sha256 !== source.sha256)
      invalid('资料副本缺失或被修改。备份未完成，请检查资料后重试。');
    files.push({ path: source.path, ...actual });
  }
  const manifest = readManifest({
    format: 1,
    application: 'StudyCompanion',
    createdAt: new Date().toISOString(),
    mainVersion: backupLimits.mainVersion,
    activityVersion: backupLimits.activityVersion,
    counts: checked.counts,
    files,
  });
  // The completion marker is published last; cancellation never leaves a valid partial backup.
  await writeFile(join(destination, MANIFEST), JSON.stringify(manifest, null, 2), {
    flag: 'wx',
    flush: true,
  });
  return manifest;
}
