import { afterEach, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { BackupRunner, type BackupProcess } from '../backup-runner';
import type { BackupManifest } from '../../../src/lib/types';
import { backupLimits } from '../../../src/lib/backup';
const manifest: BackupManifest = {
  format: 1,
  application: 'StudyCompanion',
  createdAt: '2026-10-08T00:00:00.000Z',
  mainVersion: 12,
  activityVersion: 1,
  counts: {
    sources: 0,
    notes: 0,
    conversations: 0,
    turns: 0,
    memories: 0,
    projects: 0,
    tasks: 0,
    focusSessions: 0,
    studyDays: 0,
    reviews: 0,
  },
  files: ['study-companion.sqlite3', 'study-activity.sqlite3'].map((path) => ({
    path,
    bytes: 4096,
    sha256: 'a'.repeat(64),
  })),
};
function setup() {
  const worker = new EventEmitter() as EventEmitter & { kill: () => boolean };
  worker.kill = vi.fn(() => true);
  const runner = new BackupRunner(
    'fixed-backup-worker.mjs',
    () => worker as unknown as BackupProcess,
  );
  return { worker, runner };
}
afterEach(() => vi.useRealTimers());
it('accepts a validated result only after the worker exits normally', async () => {
  const { worker, runner } = setup();
  let settled = false;
  const result = runner
    .run('export', 'source', 'staging', () => {})
    .then((value) => {
      settled = true;
      return value;
    });
  worker.emit('message', { type: 'result', result: manifest });
  await Promise.resolve();
  expect(settled).toBe(false);
  worker.emit('exit', 0);
  expect(await result).toEqual(manifest);
});
it('rejects unexpected worker exit without a result', async () => {
  const { worker, runner } = setup();
  const result = runner.run('export', 'source', 'staging', () => {});
  const check = expect(result).rejects.toThrow('提前结束');
  worker.emit('exit', 1);
  await check;
});
it('keeps cancellation pending until actual worker exit and then releases the runner lock', async () => {
  const { worker, runner } = setup();
  const result = runner.run('export', 'source', 'staging', () => {});
  const check = expect(result).rejects.toThrow('取消');
  runner.cancel();
  expect(worker.kill).toHaveBeenCalledTimes(1);
  expect(() => runner.run('export', 'source', 'staging', () => {})).toThrow('完成');
  worker.emit('exit', null);
  await check;
  const next = runner.run('export', 'source', 'staging', () => {});
  worker.emit('message', { type: 'result', result: manifest });
  worker.emit('exit', 0);
  expect(await next).toEqual(manifest);
});
it('rejects malformed result, explicit disk errors and worker startup failure after waiting for exit', async () => {
  for (const event of [
    { type: 'result', result: {} },
    { type: 'error', code: 'disk', message: '模拟磁盘写入失败' },
    null,
  ]) {
    const { worker, runner } = setup();
    const result = runner.run('export', 'source', 'staging', () => {});
    const check = expect(result).rejects.toThrow();
    if (event) worker.emit('message', event);
    else worker.emit('error', new Error('启动失败'));
    expect(worker.kill).toHaveBeenCalledTimes(1);
    worker.emit('exit', 1);
    await check;
  }
});
it('times out by killing the worker and rejects after its exit', async () => {
  vi.useFakeTimers();
  const { worker, runner } = setup();
  const result = runner.run('export', 'source', 'staging', () => {});
  const check = expect(result).rejects.toThrow('超过');
  await vi.advanceTimersByTimeAsync(backupLimits.workerMs);
  expect(worker.kill).toHaveBeenCalledTimes(1);
  worker.emit('exit', null);
  await check;
});
it('intentionally kills a worker after a validated terminal result and accepts that result after termination', async () => {
  const { worker, runner } = setup();
  const result = runner.run('export', 'source', 'staging', () => {});
  worker.emit('message', { type: 'result', result: manifest });
  expect(worker.kill).toHaveBeenCalledTimes(1);
  worker.emit('exit', 9);
  expect(await result).toEqual(manifest);
});
