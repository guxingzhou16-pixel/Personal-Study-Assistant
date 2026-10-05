import { verifyBackup, writeBackup } from './core/backup-files';
import { failure } from './core/errors';

const [operation, source, destination] = process.argv.slice(2);
function send(value: unknown) {
  if (process.parentPort) process.parentPort.postMessage(value);
  else process.send?.(value as object);
}
try {
  const progress = (current: number, total: number, message: string) =>
    send({ type: 'progress', current, total, message });
  const result =
    operation === 'export'
      ? await writeBackup(source, destination, progress)
      : await verifyBackup(source, progress, operation === 'inspect' ? destination : undefined);
  send({ type: 'result', result });
} catch (error) {
  const reported = failure(error);
  send({
    type: 'error',
    code: reported.code,
    message:
      reported.code === 'internal'
        ? '无法完成备份读写或校验，请检查文件完整性、磁盘空间与目录权限。'
        : reported.message,
  });
}
