import { build, Platform, Arch } from 'electron-builder';
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { basename, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);
const mode = process.argv[2];
if (process.argv.length !== 3 || (mode !== 'dir' && mode !== 'nsis'))
  throw new Error('请使用 npm run desktop:pack 或 npm run desktop:dist。');
if (process.platform !== 'win32' || process.arch !== 'x64')
  throw new Error('当前打包只支持 Windows x64 构建机与目标。');

const config = JSON.parse(await readFile('electron-builder.json', 'utf8'));
const metadata = JSON.parse(await readFile('package.json', 'utf8'));
const electron = JSON.parse(await readFile('node_modules/electron/package.json', 'utf8'));
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const buildInfo = {
  format: 1,
  appId: config.appId,
  version: metadata.version,
  electronVersion: electron.version,
  builderVersion: metadata.devDependencies['electron-builder'],
  nodeVersion: process.version,
  platform: 'win32',
  arch: 'x64',
  gitCommit: git('rev-parse', 'HEAD'),
  trackedWorktreeDirty: git('status', '--porcelain', '--untracked-files=no') !== '',
  lockfileSha256: createHash('sha256')
    .update(await readFile('package-lock.json'))
    .digest('hex'),
  createdAt: new Date().toISOString(),
  signed: false,
  functionalAcceptance: 'pending',
};
// Each run owns a fresh output directory; failed builds cannot reuse an old success receipt.
const output = join('release', `${mode}-${randomUUID()}`);
await mkdir(output, { recursive: true });
const infoPath = join(output, 'build-info.json');
await writeFile(infoPath, JSON.stringify(buildInfo, null, 2) + '\n');
const artifacts = await build({
  targets: Platform.WINDOWS.createTarget([mode], Arch.x64),
  config: {
    ...config,
    directories: { ...config.directories, output },
    extraResources: [{ from: infoPath, to: 'build-info.json' }],
  },
  publish: 'never',
});
if (git('rev-parse', 'HEAD') !== buildInfo.gitCommit)
  throw new Error('构建期间 Git 提交已改变，请重新构建以记录准确来源。');
let targets;
if (mode === 'nsis') {
  targets = artifacts.filter((path) => basename(path).endsWith('-setup.exe'));
} else {
  const entries = await readdir(join(output, 'win-unpacked'), {
    recursive: true,
    withFileTypes: true,
  });
  if (entries.some((entry) => !entry.isFile() && !entry.isDirectory()))
    throw new Error('目录包含链接或非普通文件，不生成成功清单。');
  targets = entries
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name))
    .sort();
}
if (targets.length === 0) throw new Error('构建未返回安装文件，不生成成功清单。');
const files = [];
// Stream files one at a time so large dependency trees do not exhaust file handles.
for (const path of targets) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  files.push({
    file: relative(output, path).replaceAll('\\', '/'),
    bytes: (await stat(path)).size,
    sha256: hash.digest('hex'),
  });
}
const audit = JSON.parse(await readFile(join(output, 'package-audit.json'), 'utf8'));
await writeFile(
  join(output, 'build-manifest.json'),
  JSON.stringify({ ...buildInfo, mode, packageAudit: audit, files }, null, 2) + '\n',
);
await writeFile(
  join(output, 'SHA256SUMS.txt'),
  files.map((file) => `${file.sha256}  ${file.file}\n`).join(''),
);
console.log(`构建与包内容检查完成：${output}`);
console.log('功能、安装/升级/卸载验收仍待完成；未签名、未发布。');
