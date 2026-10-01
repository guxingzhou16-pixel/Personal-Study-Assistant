import { readFile } from 'node:fs/promises';
import { parseMarkdown, parsePdf } from './core/document-parser';
import { failure } from './core/errors';

const [path, kind, maxPages] = process.argv.slice(2);
function send(message: unknown) {
  if (process.parentPort) process.parentPort.postMessage(message);
  else process.send?.(message as object);
}
try {
  const result =
    kind === 'pdf'
      ? await parsePdf(path, Number(maxPages), (message) => send({ type: 'progress', message }))
      : parseMarkdown(await readFile(path));
  send({ type: 'result', result });
} catch (error) {
  send({ type: 'error', ...failure(error) });
}
