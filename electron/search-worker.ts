import { retrieve } from './core/retrieval';
import { failure } from './core/errors';

const [mainPath, indexPath, question, scope, rebuild] = process.argv.slice(2);
function send(value: unknown) {
  if (process.parentPort) process.parentPort.postMessage(value);
  else process.send?.(value as object);
}
try {
  const result = retrieve(
    mainPath,
    indexPath,
    question,
    scope || null,
    rebuild === '1',
    (progress) => send({ type: 'progress', progress }),
  );
  send({ type: 'result', result });
} catch (error) {
  const reported = failure(error);
  send({
    type: 'error',
    ...reported,
    message:
      reported.code === 'internal'
        ? '无法建立或读取检索索引，请检查磁盘空间，并尝试重建索引。'
        : reported.message,
  });
}
