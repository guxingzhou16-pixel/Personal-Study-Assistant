import { readFile } from 'node:fs/promises';
import { parseMarkdown, parsePdf } from './core/document-parser';
import { failure } from './core/errors';

const [path, kind, maxPages] = process.argv.slice(2);
// PDF.js recognizes Node in Electron's browser process, but excludes the utility
// subtype. This child is a Node-only parser with no renderer or desktop bridge.
// Set its compatibility hint before PDF.js loads so Node factories/polyfills are
// used here. The real main/renderer processes retain their original process type.
if (process.parentPort)
  Object.defineProperty(process, 'type', { value: 'browser', configurable: true });
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
