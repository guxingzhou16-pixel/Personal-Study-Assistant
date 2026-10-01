import { parentPort, workerData } from 'node:worker_threads';
import { readFile } from 'node:fs/promises';
import { parseMarkdown, parsePdf } from './core/document-parser';
import { failure } from './core/errors';

try {
  const result =
    workerData.kind === 'pdf'
      ? await parsePdf(workerData.path, workerData.maxPages, (message) =>
          parentPort?.postMessage({ type: 'progress', message }),
        )
      : parseMarkdown(await readFile(workerData.path));
  parentPort?.postMessage({ type: 'result', result });
} catch (error) {
  parentPort?.postMessage({ type: 'error', ...failure(error) });
}
