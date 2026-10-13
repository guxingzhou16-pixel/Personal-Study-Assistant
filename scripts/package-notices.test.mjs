import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { createPackage, listPackage } from '@electron/asar';
import { generatePackageNotices } from './package-notices.mjs';

// Only synthetic package files are used. No app, installer, database or model is started.
async function fixture(packages, manifest = { format: 1, supplements: [], additional: [] }) {
  await mkdir('artifacts', { recursive: true });
  const projectDir = await mkdtemp(join(process.cwd(), 'artifacts', 'notice-fixture-'));
  const input = join(projectDir, 'input');
  const appOutDir = join(projectDir, 'app');
  await mkdir(join(appOutDir, 'resources'), { recursive: true });
  for (const [path, { name, version, licenseText }] of Object.entries(packages)) {
    await mkdir(join(input, path), { recursive: true });
    await writeFile(
      join(input, path, 'package.json'),
      JSON.stringify({ name, version, license: 'MIT' }),
    );
    if (licenseText) await writeFile(join(input, path, 'LICENSE'), licenseText);
  }
  for (const name of ['LICENSE.electron.txt', 'LICENSES.chromium.html'])
    await writeFile(join(appOutDir, name), 'Synthetic fixture notice, not a distribution license.');
  await mkdir(join(projectDir, 'scripts', 'licenses', 'assets'), { recursive: true });
  await writeFile(
    join(projectDir, 'scripts', 'licenses', 'manifest.json'),
    JSON.stringify(manifest),
  );
  const archive = join(appOutDir, 'resources', 'app.asar');
  await createPackage(input, archive);
  return {
    projectDir,
    appOutDir,
    archive,
    entries: listPackage(archive).map((path) => path.replaceAll('\\', '/').replace(/^\//, '')),
  };
}

test('indexes actual nested versions and keeps their notices separate', async () => {
  const context = await fixture({
    'node_modules/parent': {
      name: 'parent',
      version: '1.0.0',
      licenseText: 'Parent fixture notice.',
    },
    'node_modules/shared': {
      name: 'shared',
      version: '1.0.0',
      licenseText: 'Shared v1 fixture notice.',
    },
    'node_modules/parent/node_modules/shared': {
      name: 'shared',
      version: '2.0.0',
      licenseText: 'Shared v2 fixture notice.',
    },
  });
  const result = await generatePackageNotices(context);
  assert.equal(result.packages, 3);
  const output = JSON.parse(
    await readFile(join(context.appOutDir, 'resources', 'third-party', 'packages.json'), 'utf8'),
  );
  assert.equal(output.packages.filter((pkg) => pkg.name === 'shared').length, 2);
});

test('a nested dependency license cannot satisfy its parent missing license', async () => {
  const context = await fixture({
    'node_modules/parent': { name: 'parent', version: '1.0.0' },
    'node_modules/parent/node_modules/child': {
      name: 'child',
      version: '1.0.0',
      licenseText: 'Child fixture notice.',
    },
  });
  await assert.rejects(generatePackageNotices(context));
});

const text = 'Synthetic supplementary notice.';
const asset = {
  file: 'assets/supplement.txt',
  sha256: createHash('sha256').update(text).digest('hex'),
  source: 'https://example.invalid/fixture',
  description: 'Synthetic fixture only.',
};

test('preserves explicitly labelled Latin-1 notice bytes and rejects undeclared encoding', async () => {
  const bytes = Buffer.from('Synthetic author: Andr\xe9.', 'latin1');
  for (const encoding of [undefined, 'latin1', 'unknown']) {
    const legacy = { ...asset, sha256: createHash('sha256').update(bytes).digest('hex'), encoding };
    const context = await fixture(
      { 'node_modules/dep': { name: 'dep', version: '1.0.0', licenseText: 'Fixture license.' } },
      { format: 1, supplements: [], additional: [legacy] },
    );
    await writeFile(join(context.projectDir, 'scripts', 'licenses', asset.file), bytes);
    if (encoding !== 'latin1') {
      await assert.rejects(generatePackageNotices(context));
      continue;
    }
    const result = await generatePackageNotices(context);
    assert.ok(
      (
        await readFile(
          join(context.appOutDir, 'resources', 'third-party', 'supplements', 'supplement.txt'),
        )
      ).equals(bytes),
    );
    assert.equal(
      result.files.find((file) => file.file === 'supplements/supplement.txt').encoding,
      'latin1',
    );
  }
});

test('rejects stale supplementary package version and wrong asset hash', async () => {
  for (const [version, sha256] of [
    ['2.0.0', asset.sha256],
    ['1.0.0', '0'.repeat(64)],
  ]) {
    const context = await fixture(
      { 'node_modules/dep': { name: 'dep', version: '1.0.0' } },
      {
        format: 1,
        additional: [],
        supplements: [{ packages: [{ name: 'dep', version }], assets: [{ ...asset, sha256 }] }],
      },
    );
    await writeFile(join(context.projectDir, 'scripts', 'licenses', asset.file), text);
    await assert.rejects(generatePackageNotices(context));
  }
});

test('rejects supplementary path traversal', async () => {
  const context = await fixture(
    { 'node_modules/dep': { name: 'dep', version: '1.0.0' } },
    {
      format: 1,
      supplements: [],
      additional: [{ ...asset, file: '../outside.txt' }],
    },
  );
  await assert.rejects(generatePackageNotices(context));
});

test('writes the verified supplement and retains pending review issues', async () => {
  const context = await fixture(
    { 'node_modules/dep': { name: 'dep', version: '1.0.0' } },
    {
      format: 1,
      additional: [],
      supplements: [{ packages: [{ name: 'dep', version: '1.0.0' }], assets: [asset] }],
      reviewIssues: ['Fixture review remains pending.'],
    },
  );
  await writeFile(join(context.projectDir, 'scripts', 'licenses', asset.file), text);
  const result = await generatePackageNotices(context);
  assert.equal(result.packages, 1);
  assert.equal(result.reviewStatus, 'pending');
  assert.deepEqual(result.reviewIssues, ['Fixture review remains pending.']);
  assert.match(
    await readFile(join(context.appOutDir, 'resources', 'third-party', 'README.txt'), 'utf8'),
    /Fixture review remains pending/,
  );
});
