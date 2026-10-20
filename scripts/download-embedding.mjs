import { build } from 'esbuild';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Developer evaluation cache, separate from the desktop's user data directory.
await build({
  entryPoints: ['electron/core/embedding-files.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node24',
  outfile: 'artifacts/download-runtime.mjs',
});
const { EmbeddingFiles } = await import(
  pathToFileURL(resolve('artifacts/download-runtime.mjs')).href
);
const files = new EmbeddingFiles(resolve('artifacts/embedding-model'));
if ((await files.status()).state !== 'ready') {
  let percentage = -1;
  await files.install((value) => {
    const next = Math.floor((value.current / value.total) * 20);
    if (next !== percentage) {
      percentage = next;
      console.log(value.message);
    }
  });
}
console.log('评测模型已校验：artifacts/embedding-model（不进入 Git；不读取个人资料）');
