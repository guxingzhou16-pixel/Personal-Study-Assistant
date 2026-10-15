import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { createPackage } from '@electron/asar';
import verifyPackage from './verify-package.mjs';

async function fixture() {
  await mkdir('artifacts', { recursive: true });
  const projectDir = await mkdtemp(join(process.cwd(), 'artifacts', 'project-license-fixture-'));
  const appOutDir = join(projectDir, 'app');
  await mkdir(join(appOutDir, 'resources'), { recursive: true });
  await writeFile(join(projectDir, 'LICENSE'), await readFile('LICENSE'));
  for (const [source, target] of [
    ['installation-terms.txt', 'INSTALLATION-TERMS.txt'],
    [
      'sharp-distribution-notice.txt',
      'app.asar.unpacked/node_modules/@img/sharp-win32-x64/lib/SOURCE-NOTICE.txt',
    ],
  ]) {
    const original = join('scripts', 'licenses', source);
    const fixtureSource = join(projectDir, original);
    const fixtureTarget = join(appOutDir, 'resources', target);
    await mkdir(join(projectDir, 'scripts', 'licenses'), { recursive: true });
    await mkdir(dirname(fixtureTarget), { recursive: true });
    const bytes = await readFile(original);
    await writeFile(fixtureSource, bytes);
    await writeFile(fixtureTarget, bytes);
  }
  return { electronPlatformName: 'win32', appOutDir, packager: { projectDir } };
}

test('rejects absent or altered installation terms and library source directions', async () => {
  for (const target of [
    'INSTALLATION-TERMS.txt',
    'app.asar.unpacked/node_modules/@img/sharp-win32-x64/lib/SOURCE-NOTICE.txt',
  ]) {
    for (const missing of [true, false]) {
      const context = await fixture();
      await writeFile(
        join(context.appOutDir, 'resources', 'LICENSE.txt'),
        await readFile('LICENSE'),
      );
      const path = join(context.appOutDir, 'resources', target);
      if (missing) await unlink(path);
      else await writeFile(path, 'Incomplete distribution material.');
      await assert.rejects(verifyPackage(context), /Distribution material/);
      await assert.rejects(readFile(join(context.packager.projectDir, 'package-audit.json')), {
        code: 'ENOENT',
      });
    }
  }
});

test('rejects a Chinese installer license without the required UTF-8 BOM', async () => {
  const context = await fixture();
  await writeFile(join(context.appOutDir, 'resources', 'LICENSE.txt'), await readFile('LICENSE'));
  const source = join(context.packager.projectDir, 'scripts/licenses/installation-terms.txt');
  const bytes = (await readFile(source)).subarray(3);
  await writeFile(source, bytes);
  await writeFile(join(context.appOutDir, 'resources/INSTALLATION-TERMS.txt'), bytes);
  await assert.rejects(verifyPackage(context), /UTF-8 BOM/);
  await assert.rejects(readFile(join(context.packager.projectDir, 'package-audit.json')), {
    code: 'ENOENT',
  });
});

test('rejects a package that omits the project license before writing a passed audit', async () => {
  const context = await fixture();
  await assert.rejects(verifyPackage(context), /LICENSE\.txt/);
  await assert.rejects(readFile(join(context.packager.projectDir, 'package-audit.json')), {
    code: 'ENOENT',
  });
});

test('rejects a copied project license whose bytes differ from the source license', async () => {
  const context = await fixture();
  await writeFile(
    join(context.appOutDir, 'resources', 'LICENSE.txt'),
    'Truncated fixture license.',
  );
  await assert.rejects(verifyPackage(context), /Project license does not match/);
  await assert.rejects(readFile(join(context.packager.projectDir, 'package-audit.json')), {
    code: 'ENOENT',
  });
});

test('rejects standalone browser dependencies even when nested in another package', async () => {
  for (const packagePath of [
    'node_modules/onnxruntime-web',
    'node_modules/unused/node_modules/guid-typescript',
  ]) {
    const context = await fixture();
    const source = join(context.packager.projectDir, 'source');
    await mkdir(join(source, packagePath), { recursive: true });
    await writeFile(join(source, packagePath, 'index.js'), 'export const fixture = true;');
    await writeFile(join(context.appOutDir, 'resources', 'LICENSE.txt'), await readFile('LICENSE'));
    await createPackage(source, join(context.appOutDir, 'resources', 'app.asar'));
    await assert.rejects(verifyPackage(context), /Unused standalone browser dependency/);
    await assert.rejects(readFile(join(context.packager.projectDir, 'package-audit.json')), {
      code: 'ENOENT',
    });
  }
});
