import { build, Platform, Arch } from 'electron-builder';
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { copyFile, mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { basename, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { finalizeUninstaller } from './nsis-uninstaller.mjs';
import { assertSignedFile, signingCertificate, windowsSignature } from './windows-signing.mjs';

async function sha256(path) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}

const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);
const mode = process.argv[2];
const signedBuild = process.argv.length === 4 && process.argv[3] === '--signed' && mode === 'nsis';
if ((!signedBuild && process.argv.length !== 3) || (mode !== 'dir' && mode !== 'nsis'))
  throw new Error('请使用 npm run desktop:pack、desktop:dist 或 desktop:dist:signed。');
if (process.platform !== 'win32' || process.arch !== 'x64')
  throw new Error('当前打包只支持 Windows x64 构建机与目标。');
const certificate = signedBuild
  ? signingCertificate(process.env.STUDY_COMPANION_SIGNING_CERT_SHA1)
  : null;
if (signedBuild && process.env.ELECTRON_BUILDER_OFFLINE === 'true')
  throw new Error('可信签名构建必须能够请求 RFC 3161 时间戳。');

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
const installer = resolve(output, `StudyCompanion-${metadata.version}-win-x64-setup.exe`);
const application = resolve(output, 'win-unpacked', 'StudyCompanion.exe');
const uninstaller = installer.replace(/\.exe$/, '.__uninstaller.exe');
const signedFiles = new Map();
const require = createRequire(import.meta.resolve('electron-builder'));
if (require('app-builder-lib/package.json').version !== '26.15.3')
  throw new Error('NSIS 提取与签名核对仅适用于 builder 26.15.3，请先审查升级。');
const signingConfig = signedBuild
  ? {
      forceCodeSigning: true,
      win: {
        ...config.win,
        signExecutable: true,
        signExts: [basename(application), basename(installer), basename(uninstaller), '!.exe'],
        signtoolOptions: {
          certificateSha1: certificate.thumbprint,
          signingHashAlgorithms: ['sha256'],
          rfc3161TimeStampServer: 'http://timestamp.digicert.com',
          sign: async (configuration, packager) => {
            const path = resolve(configuration.path);
            if (
              ![application, installer, uninstaller].includes(path) ||
              signedFiles.has(path) ||
              configuration.hash !== 'sha256' ||
              configuration.isNest ||
              configuration.cscInfo?.thumbprint !== certificate.thumbprint
            )
              throw new Error('签名请求不是本次构建的三个自有文件或指定证书，拒绝签名。');
            const {
              WindowsSignToolManager,
            } = require('app-builder-lib/out/codeSign/windowsSignToolManager.js');
            await new WindowsSignToolManager(packager).doSign(configuration, packager);
            const signature = windowsSignature(path);
            assertSignedFile(signature, certificate.thumbprint);
            // Builder deletes this file after embedding it; preserve its signed bytes as evidence.
            let preserved = path;
            if (path === uninstaller) {
              await mkdir(join(output, 'signing-artifacts'));
              preserved = resolve(output, 'signing-artifacts', basename(path));
              await copyFile(path, preserved);
            }
            signedFiles.set(path, {
              file: relative(output, preserved).replaceAll('\\', '/'),
              bytes: (await stat(preserved)).size,
              sha256: await sha256(preserved),
              ...signature,
            });
          },
        },
      },
      afterSign: async (context) => {
        if (
          resolve(context.appOutDir, 'StudyCompanion.exe') !== application ||
          !signedFiles.has(application)
        )
          throw new Error('主程序没有本次可信签名回执。');
        assertSignedFile(windowsSignature(application), certificate.thumbprint);
        // The resource records an actually signed app, not merely a requested signing mode.
        buildInfo.signed = true;
        const bytes = JSON.stringify(buildInfo, null, 2) + '\n';
        await writeFile(infoPath, bytes);
        await writeFile(join(context.appOutDir, 'resources', 'build-info.json'), bytes);
      },
    }
  : {};
let restoreNsisExecution;
let uninstallerExtractions = 0;
if (mode === 'nsis') {
  const { WineVmManager } = require('app-builder-lib/out/vm/WineVm.js');
  const { UninstallerReader } = require('app-builder-lib/out/targets/nsis/nsisUtil.js');
  const originalExec = WineVmManager.prototype.exec;
  // The default Windows build runs a stub to write its uninstaller. Use the same
  // pure file extractor that this pinned builder uses on macOS; never run that EXE.
  WineVmManager.prototype.exec = async function (file, args) {
    if (
      uninstallerExtractions !== 0 ||
      resolve(file) !== installer ||
      !Array.isArray(args) ||
      args.length !== 0
    )
      throw new Error('打包器请求了未核对的程序执行，拒绝构建。');
    await UninstallerReader.exec(installer, uninstaller);
    await writeFile(uninstaller, finalizeUninstaller(await readFile(uninstaller)));
    uninstallerExtractions++;
    console.log('已从编译文件提取卸载器，未执行临时安装程序。');
    return '';
  };
  restoreNsisExecution = () => {
    WineVmManager.prototype.exec = originalExec;
  };
}
let artifacts;
try {
  artifacts = await build({
    targets: Platform.WINDOWS.createTarget([mode], Arch.x64),
    config: {
      ...config,
      ...signingConfig,
      directories: { ...config.directories, output },
      extraResources: [...(config.extraResources ?? []), { from: infoPath, to: 'build-info.json' }],
    },
    publish: 'never',
  });
  if (mode === 'nsis' && uninstallerExtractions !== 1)
    throw new Error('卸载器纯提取次数与预期不符，不生成成功清单。');
} finally {
  restoreNsisExecution?.();
}
if (git('rev-parse', 'HEAD') !== buildInfo.gitCommit)
  throw new Error('构建期间 Git 提交已改变，请重新构建以记录准确来源。');
if (signedBuild) {
  if (signedFiles.size !== 3 || !buildInfo.signed)
    throw new Error('主程序、卸载器或安装器签名不完整，不生成成功清单。');
  for (const receipt of signedFiles.values()) {
    const path = resolve(output, receipt.file);
    assertSignedFile(windowsSignature(path), certificate.thumbprint);
    if ((await sha256(path)) !== receipt.sha256)
      throw new Error('签名后文件发生改变，不生成成功清单。');
  }
  await writeFile(
    join(output, 'signing-receipt.json'),
    JSON.stringify(
      { format: 1, status: 'verified', certificate, files: [...signedFiles.values()] },
      null,
      2,
    ) + '\n',
  );
}
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
  files.push({
    file: relative(output, path).replaceAll('\\', '/'),
    bytes: (await stat(path)).size,
    sha256: await sha256(path),
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
console.log(
  `本候选功能、安装/升级/卸载验收仍待完成；${buildInfo.signed ? '三个文件签名已核对' : '未签名'}、未发布。`,
);
