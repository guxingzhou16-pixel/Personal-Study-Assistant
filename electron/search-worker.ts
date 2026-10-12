import { retrieve } from './core/retrieval';
import { failure } from './core/errors';
import { loadLocalEncoder } from './core/embeddings';
import { retrieveHybrid } from './core/vector-retrieval';

const [mainPath, indexPath, question, scope, rebuild, modelPath, operation] = process.argv.slice(2);
function send(value: unknown) {
  if (process.parentPort) process.parentPort.postMessage(value);
  else process.send?.(value as object);
}
try {
  const progress = (progress: import('../src/lib/types').RetrievalProgress) =>
    send({ type: 'progress', progress });
  let encoder: Awaited<ReturnType<typeof loadLocalEncoder>> | undefined;
  let fallback = '';
  if (modelPath) {
    progress({ current: 0, total: 0, message: '正在加载本地检索模型…' });
    try {
      encoder = await loadLocalEncoder(modelPath);
    } catch (error) {
      const reported = failure(error);
      fallback =
        reported.code === 'embeddingRuntime'
          ? `${reported.message} 已使用关键词检索。 `
          : '本地嵌入模型无法加载或校验失败，已使用关键词检索；请在设置中检查模型或重新下载。 ';
    }
  } else fallback = '未加载本地嵌入模型，已使用关键词检索；可在设置中下载语义检索模型。 ';
  let result;
  try {
    if (operation === 'probe') {
      const vectors = encoder ? await encoder.embed(['用自己的话复述，再核对原文。'], 'query') : [];
      const valid =
        vectors.length === 1 &&
        vectors[0].length === 512 &&
        vectors[0].every(Number.isFinite) &&
        vectors[0].some((value) => value !== 0);
      result = {
        question,
        sourceId: null,
        sourceCount: 0,
        hits: [],
        embeddingAvailable: valid,
        notice: valid
          ? '本次固定文本的本地嵌入推理通过（512 维）；不代表所有资料召回正确。'
          : `${fallback}未通过实际嵌入推理；仍可阅读并使用关键词检索。`,
      };
      fallback = '';
    } else
      result = encoder
        ? await retrieveHybrid(
            mainPath,
            indexPath,
            question,
            scope || null,
            rebuild === '1',
            progress,
            encoder,
          )
        : retrieve(mainPath, indexPath, question, scope || null, rebuild === '1', progress);
  } finally {
    await encoder?.dispose();
  }
  result.notice = fallback + result.notice;
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
