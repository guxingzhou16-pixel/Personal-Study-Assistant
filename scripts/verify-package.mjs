import { extractFile, listPackage, statFile } from '@electron/asar';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join, normalize } from 'node:path';

// This build hook only reads package files. It never starts Electron, SQLite or a model.
export default async function verifyPackage(context) {
  if (context.electronPlatformName !== 'win32')
    throw new Error('Only Windows packages are supported.');
  const resources = join(context.appOutDir, 'resources');
  const archive = join(resources, 'app.asar');
  const entries = listPackage(archive, { isPack: false }).map((path) =>
    path.replaceAll('\\', '/').replace(/^\//, ''),
  );
  const allowedRoots = new Set(['dist', 'dist-electron', 'node_modules', 'package.json']);
  const privateFile =
    /(^|\/)(\.env(?:\.|$)|credentials\.enc|active-learning|pending-restore|before-restore)|\.(?:db|sqlite3?|onnx|pem|key|md)$/i;
  for (const path of entries) {
    if (!allowedRoots.has(path.split('/')[0])) throw new Error(`Unexpected package entry: ${path}`);
    if (!path.startsWith('node_modules/') && privateFile.test(path))
      throw new Error(`Private or source-only file in package: ${path}`);
  }
  const requireFile = async (path, unpacked = false) => {
    const entry = statFile(archive, normalize(path), false);
    if (entry.files || entry.link || !(entry.size > 0))
      throw new Error(`Missing package file: ${path}`);
    if (unpacked) {
      if (!entry.unpacked) throw new Error(`File must remain outside ASAR: ${path}`);
      const actual = await stat(join(resources, 'app.asar.unpacked', path));
      if (!actual.isFile() || actual.size !== entry.size)
        throw new Error(`Invalid unpacked file: ${path}`);
    }
  };
  await requireFile('package.json');
  await requireFile('dist/index.html');
  await requireFile('dist-electron/main.cjs');
  await requireFile('dist-electron/preload.cjs');
  for (const worker of ['document', 'search', 'backup'])
    await requireFile(`dist-electron/${worker}-worker.mjs`, true);
  const runtimeFiles = [
    'node_modules/pdfjs-dist/package.json',
    'node_modules/pdfjs-dist/legacy/build/pdf.mjs',
    'node_modules/@huggingface/transformers/package.json',
    'node_modules/@huggingface/transformers/dist/transformers.node.mjs',
    'node_modules/onnxruntime-node/dist/index.js',
    'node_modules/onnxruntime-node/bin/napi-v6/win32/x64/onnxruntime_binding.node',
    'node_modules/onnxruntime-node/bin/napi-v6/win32/x64/onnxruntime.dll',
    'node_modules/sharp/package.json',
    'node_modules/sharp/dist/index.mjs',
    'node_modules/sharp/dist/index.cjs',
    'node_modules/@img/sharp-win32-x64/package.json',
  ];
  for (const path of runtimeFiles) await requireFile(path, true);
  const sharpFiles = entries.filter((path) =>
    /^node_modules\/@img\/sharp-win32-x64\/lib\/.+\.(node|dll)$/.test(path),
  );
  if (
    !sharpFiles.some((path) => path.endsWith('.node')) ||
    !sharpFiles.some((path) => path.endsWith('.dll'))
  )
    throw new Error('Missing Windows x64 Sharp binaries.');
  for (const path of sharpFiles) await requireFile(path, true);
  for (const prefix of ['dist/pdfjs/cmaps/', 'dist/pdfjs/standard_fonts/', 'dist/pdfjs/wasm/']) {
    if (
      !entries.some(
        (path) => path.startsWith(prefix) && statFile(archive, normalize(path)).size > 0,
      )
    )
      throw new Error(`Missing local PDF assets: ${prefix}`);
  }
  for (const pattern of [
    /^dist\/assets\/.+\.js$/,
    /^dist\/assets\/.+\.css$/,
    /^dist\/assets\/pdf\.worker.+\.mjs$/,
  ]) {
    if (!entries.some((path) => pattern.test(path)))
      throw new Error(`Missing renderer asset: ${pattern}`);
  }
  if (
    entries.some((path) =>
      /^node_modules\/onnxruntime-node\/bin\/napi-v6\/(darwin|linux|win32\/arm64)\//.test(path),
    )
  )
    throw new Error('ONNX binaries for another platform were included.');
  const metadata = JSON.parse(extractFile(archive, 'package.json').toString('utf8'));
  const info = JSON.parse(await readFile(join(resources, 'build-info.json'), 'utf8'));
  if (
    metadata.main !== 'dist-electron/main.cjs' ||
    metadata.version !== info.version ||
    info.arch !== 'x64'
  )
    throw new Error('Package metadata does not match its build record.');
  const result = {
    status: 'passed',
    kind: 'static-package-contents',
    archiveEntries: entries.length,
    workers: 3,
    nativeRuntime: 'win32-x64',
    functionalAcceptance: 'pending',
  };
  await writeFile(
    join(dirname(context.appOutDir), 'package-audit.json'),
    JSON.stringify(result, null, 2) + '\n',
  );
  console.log(`包内容检查通过：${entries.length} 项，三个后台入口及本地 PDF/ONNX/Sharp 资源。`);
}
