import { build } from 'esbuild';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const directory = 'design-lab/2026-10-21-sunny-motion';
await mkdir(`${directory}/assets`, { recursive: true });
await build({
  entryPoints: ['src/lib/motion.ts'],
  outfile: `${directory}/assets/runtime.js`,
  format: 'iife',
  globalName: 'SunnyMotion',
  target: 'es2022',
  banner: {
    js: '// Generated from src/lib/motion.ts. Run node scripts/build-motion-demo.mjs to refresh.',
  },
});
await copyFile('src/styles/motion.css', `${directory}/assets/motion.css`);
const sourceFiles = ['src/lib/motion.ts', 'src/styles/motion.css'];
const sources = await Promise.all(
  sourceFiles.map(async (path) => ({
    path,
    sha256: createHash('sha256')
      .update(await readFile(path))
      .digest('hex'),
  })),
);
await writeFile(
  `${directory}/assets/sources.json`,
  JSON.stringify({ generator: 'scripts/build-motion-demo.mjs', sources }, null, 2) + '\n',
);
console.log(`Updated offline demo runtime and motion CSS in ${directory}`);
