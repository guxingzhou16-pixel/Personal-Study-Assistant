import { extractFile, statFile } from '@electron/asar';
import { isUtf8 } from 'node:buffer';
import { createHash } from 'node:crypto';
import { lstat, mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join, normalize, resolve } from 'node:path';

const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const packageFile = /(?:^|\/)node_modules\/(?:@[^/]+\/)?[^/]+\/package\.json$/;
const noticeFile = /^(?:licen[cs]es?|notice|copying|copyright|authors)(?:[._-].*)?$/i;
const licenseFile = /^(?:licen[cs]es?|copying|copyright)(?:[._-].*)?$/i;

function safeRelative(input) {
  if (typeof input !== 'string' || !input || /[\\:\x00-\x1f]/.test(input))
    throw new Error(`Invalid notice path: ${input}`);
  if (input.split('/').some((part) => !part || part === '.' || part === '..' || /[. ]$/.test(part)))
    throw new Error(`Invalid notice path: ${input}`);
  return input;
}

// Reject links in every component, including directories containing an otherwise regular file.
async function checkedPath(root, file, directory = false) {
  let path = resolve(root);
  const base = await lstat(path);
  if (!base.isDirectory() || base.isSymbolicLink()) throw new Error(`Unsafe notice root: ${root}`);
  const parts = safeRelative(file).split('/');
  for (const [index, part] of parts.entries()) {
    path = join(path, part);
    const entry = await lstat(path);
    const needsDirectory = index < parts.length - 1 || directory;
    if (entry.isSymbolicLink() || (needsDirectory ? !entry.isDirectory() : !entry.isFile()))
      throw new Error(`Unsafe notice file: ${file}`);
  }
  return path;
}

function text(bytes, source) {
  if (!isUtf8(bytes) || bytes.includes(0) || !bytes.toString('utf8').trim())
    throw new Error(`Missing or non-text notice: ${source}`);
  return bytes;
}

export async function generatePackageNotices({ archive, appOutDir, projectDir, entries }) {
  const paths = entries.map((entry) =>
    safeRelative(entry.replaceAll('\\', '/').replace(/^\//, '')),
  );
  const output = new Map();
  const add = (file, source, bytes, extra = {}) => {
    safeRelative(file);
    const record = { file, source, bytes: bytes.length, sha256: digest(bytes), ...extra };
    const previous = output.get(file);
    if (previous && previous.record.sha256 !== record.sha256)
      throw new Error(`Conflicting notice asset: ${file}`);
    if (!previous) output.set(file, { record, bytes });
    return record;
  };
  const readArchive = async (file, allowEmpty = false) => {
    const parts = file.split('/');
    let entry;
    for (let index = 1; index <= parts.length; index++) {
      entry = statFile(archive, normalize(parts.slice(0, index).join('/')), false);
      if (entry.link) throw new Error(`Linked ASAR notice: ${file}`);
    }
    if (entry.files) throw new Error(`Missing ASAR notice: ${file}`);
    if (entry.unpacked) await checkedPath(appOutDir, `resources/app.asar.unpacked/${file}`);
    const bytes = extractFile(archive, normalize(file), false);
    if (allowEmpty && isUtf8(bytes) && !bytes.includes(0) && !bytes.toString('utf8').trim())
      return null;
    return text(bytes, `app.asar:${file}`);
  };
  const packages = [];
  for (const path of paths.filter((file) => packageFile.test(file)).sort()) {
    const bytes = await readArchive(path);
    const metadata = JSON.parse(bytes.toString('utf8'));
    if (
      typeof metadata.name !== 'string' ||
      !metadata.name.trim() ||
      typeof metadata.version !== 'string' ||
      !metadata.version.trim()
    )
      throw new Error(`Package name/version missing in actual ASAR: ${path}`);
    packages.push({
      name: metadata.name,
      version: metadata.version,
      license: metadata.license ?? null,
      repository: metadata.repository ?? null,
      author: metadata.author ?? null,
      source:
        typeof metadata.repository === 'string'
          ? metadata.repository
          : (metadata.repository?.url ?? null),
      packagePath: path.slice(0, -'/package.json'.length),
      metadata: add(`metadata/${path}`, `app.asar:${path}`, bytes),
      licenses: [],
      supplements: [],
    });
  }
  if (!packages.length) throw new Error('No actual dependency packages found in ASAR.');
  const roots = packages
    .slice()
    .sort((left, right) => right.packagePath.length - left.packagePath.length);
  for (const path of paths.filter((file) => noticeFile.test(basename(file))).sort()) {
    const owner = roots.find((pkg) => path.startsWith(`${pkg.packagePath}/`));
    if (!owner || statFile(archive, normalize(path), false).files) continue;
    const bytes = await readArchive(path, true);
    if (bytes) owner.licenses.push(add(`licenses/${path}`, `app.asar:${path}`, bytes));
  }
  const manifest = JSON.parse(
    await readFile(await checkedPath(projectDir, 'scripts/licenses/manifest.json'), 'utf8'),
  );
  if (
    manifest.format !== 1 ||
    !Array.isArray(manifest.supplements) ||
    !Array.isArray(manifest.additional)
  )
    throw new Error('Unsupported supplemental license manifest.');
  const reviewIssues = manifest.reviewIssues === undefined ? [] : manifest.reviewIssues;
  if (
    !Array.isArray(reviewIssues) ||
    reviewIssues.some((issue) => typeof issue !== 'string' || !issue.trim())
  )
    throw new Error('Invalid supplemental license review issues.');
  const reviewStatus = reviewIssues.length ? 'pending' : 'file-checks-complete';
  const readAsset = async (asset) => {
    if (
      !asset ||
      typeof asset.file !== 'string' ||
      !asset.file.startsWith('assets/') ||
      !/^[a-f0-9]{64}$/.test(asset.sha256) ||
      typeof asset.description !== 'string' ||
      !asset.description.trim()
    )
      throw new Error('Invalid supplemental license asset.');
    const source = new URL(asset.source);
    if (source.protocol !== 'https:' || source.username || source.password)
      throw new Error(`Invalid supplemental license source: ${asset.file}`);
    const bytes = text(
      await readFile(await checkedPath(projectDir, `scripts/licenses/${safeRelative(asset.file)}`)),
      asset.file,
    );
    if (digest(bytes) !== asset.sha256)
      throw new Error(`Supplemental license digest mismatch: ${asset.file}`);
    return add(`supplements/${asset.file.slice('assets/'.length)}`, asset.source, bytes, {
      description: asset.description,
    });
  };
  for (const supplement of manifest.supplements) {
    if (
      !Array.isArray(supplement.packages) ||
      !supplement.packages.length ||
      !Array.isArray(supplement.assets) ||
      !supplement.assets.length
    )
      throw new Error('Supplement must name exact packages and provide license assets.');
    const owners = supplement.packages.flatMap(({ name, version }) => {
      const matches = packages.filter((pkg) => pkg.name === name && pkg.version === version);
      if (!matches.length)
        throw new Error(`Supplement package missing or wrong version: ${name}@${version}`);
      return matches;
    });
    const assets = [];
    for (const asset of supplement.assets) assets.push(await readAsset(asset));
    for (const owner of owners)
      for (const asset of assets)
        if (!owner.supplements.some((item) => item.file === asset.file))
          owner.supplements.push(asset);
  }
  const additional = [];
  for (const asset of manifest.additional) additional.push(await readAsset(asset));
  for (const pkg of packages) {
    if (
      !pkg.licenses.some((item) => licenseFile.test(basename(item.file))) &&
      !pkg.supplements.length
    )
      throw new Error(`License text missing: ${pkg.name}@${pkg.version} (${pkg.packagePath})`);
  }
  const runtime = [];
  for (const file of ['LICENSE.electron.txt', 'LICENSES.chromium.html']) {
    const bytes = text(await readFile(await checkedPath(appOutDir, file)), file);
    runtime.push(add(`licenses/runtime/${file}`, `app-root/${file}`, bytes));
  }
  const notice = '此清单仅核对实际打包文件、固定来源及摘要，不代表法律审查、功能或运行验收。';
  const index = {
    format: 1,
    notice,
    reviewStatus,
    reviewIssues,
    packages,
    runtime,
    additional,
    files: Array.from(output.values(), (item) => item.record),
  };
  add(
    'packages.json',
    'generated:actual-package-license-index',
    Buffer.from(JSON.stringify(index, null, 2) + '\n'),
  );
  add(
    'README.txt',
    'generated:third-party-notices',
    Buffer.from(
      [
        '拾知 / Study Companion 第三方许可与通知',
        '',
        notice,
        `许可审阅状态：${reviewStatus}`,
        ...reviewIssues.map((issue) => `待审阅：${issue}`),
        'packages.json 记录实际 ASAR 的包名、版本、原始许可表达式、作者、仓库来源、元数据摘要及全文相对位置。',
        'metadata/ 保留每个实际包的原始 package.json，便于核对完整作者和声明。',
        'licenses/ 保留包内及 Electron/Chromium 原始文本，supplements/ 保留固定摘要核对的补充文本。',
        '补充文本可供多个包引用，文件只保存一份；AUTHORS/NOTICE 本身不代替缺失的许可全文。',
        'additional 包含本地嵌入模型和原生依赖的补充通知；嵌入模型权重不随安装包分发。',
        '模型和外部服务的使用范围、费用与第三方条款仍需使用者自行核对。',
        '',
        ...packages.map(
          (pkg) =>
            `${pkg.name}@${pkg.version} | ${JSON.stringify(pkg.license)} | ${pkg.packagePath}`,
        ),
        '',
        ...runtime.map((item) => `${item.source} -> ${item.file} | SHA-256 ${item.sha256}`),
        '',
      ].join('\n'),
    ),
  );
  // The builder owns a new output. Refuse to replace any pre-existing notice directory or file.
  await checkedPath(appOutDir, 'resources', true);
  const destination = join(appOutDir, 'resources', 'third-party');
  await mkdir(destination);
  for (const [file, item] of output) {
    const parents = file.split('/').slice(0, -1);
    if (parents.length) await mkdir(join(destination, ...parents), { recursive: true });
    await writeFile(join(destination, file), item.bytes, { flag: 'wx' });
  }
  for (const [file, item] of output) {
    const bytes = await readFile(await checkedPath(destination, file));
    if (bytes.length !== item.record.bytes || digest(bytes) !== item.record.sha256)
      throw new Error(`Written notice failed verification: ${file}`);
  }
  return {
    packages: packages.length,
    licenseFiles: Array.from(output.keys()).filter((file) => file.startsWith('licenses/')).length,
    supplementalFiles: Array.from(output.keys()).filter((file) => file.startsWith('supplements/'))
      .length,
    metadataFiles: packages.length,
    runtimeFiles: runtime.length,
    directory: 'resources/third-party',
    files: Array.from(output.values(), (item) => item.record),
    status: 'static-copies-verified',
    reviewStatus,
    reviewIssues,
    legalAndRuntimeAcceptance: 'pending',
  };
}
