import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import verifyPackage from './verify-package.mjs';

async function fixture() {
  await mkdir('artifacts', { recursive: true });
  const projectDir = await mkdtemp(join(process.cwd(), 'artifacts', 'project-license-fixture-'));
  const appOutDir = join(projectDir, 'app');
  await mkdir(join(appOutDir, 'resources'), { recursive: true });
  await writeFile(join(projectDir, 'LICENSE'), await readFile('LICENSE'));
  return { electronPlatformName: 'win32', appOutDir, packager: { projectDir } };
}

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
