import { afterEach, expect, it, vi } from 'vitest';
import { randomUUID, createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  linkSync,
  symlinkSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Storage } from '../storage';
import { StudyStorage } from '../study-storage';
import { verifyBackup, writeBackup, externalDirectory } from '../backup-files';
import {
  learningLocation,
  createRestoreDirectory,
  scheduleRestore,
  activateRestore,
  pendingRestore,
  removeRestoreDirectory,
} from '../data-location';
import { BackupService } from '../backup';
import type { BackupRunner } from '../backup-runner';
import type { BackupManifest } from '../../../src/lib/types';
import {
  createLegacyDatabase,
  fixtureText,
  fixtureSourceId,
  fixtureIds,
  fixtureTurn,
  snapshotDatabase,
} from '../../../tests/fixtures/legacy-databases';

// Real SQLite snapshots can exceed the default 5s budget on hosted Windows runners.
vi.setConfig({ testTimeout: 30_000 });
afterEach(() => vi.restoreAllMocks());
const progress = () => {};
function temp() {
  return mkdtempSync(join(tmpdir(), 'study-backup-audit-'));
}
async function sample() {
  const root = temp();
  const main = join(root, 'study-companion.sqlite3');
  createLegacyDatabase(main, 11);
  const store = new Storage(main);
  try {
    store.chat.addTurn(
      fixtureTurn(fixtureIds.chat, {
        id: randomUUID(),
        practiceRequest: { kind: 'cards', topic: '事务', sourceId: fixtureSourceId },
        answer: JSON.stringify({
          items: [1, 2, 3].map((i) => ({
            question: `题${i}`,
            answer: '全部提交或回滚',
            citations: [1],
          })),
        }),
      }),
    );
  } finally {
    store.close();
  }
  mkdirSync(join(root, 'sources'));
  writeFileSync(join(root, 'sources', fixtureSourceId + '.md'), fixtureText);
  const activity = new StudyStorage(join(root, 'study-activity.sqlite3'));
  activity.checkIn('2026-10-01');
  activity.addStudyTime([{ day: '2026-10-01', milliseconds: 12345 }]);
  activity.close();
  for (const name of ['credentials.enc.json', 'search-index.sqlite3', 'unsaved-draft.txt'])
    writeFileSync(join(root, name), 'EXCLUDED_TEST_SENTINEL');
  mkdirSync(join(root, 'embedding-models'));
  writeFileSync(join(root, 'embedding-models', 'sentinel'), 'EXCLUDED_TEST_SENTINEL');
  const destination = temp();
  const manifest = await writeBackup(root, destination, progress);
  return { root, destination, manifest };
}
function rewriteManifest(directory: string, manifest: BackupManifest) {
  writeFileSync(join(directory, 'manifest.json'), JSON.stringify(manifest));
}
function mutate(directory: string, sql: string) {
  const db = new DatabaseSync(join(directory, 'study-companion.sqlite3'));
  try {
    db.exec(sql);
  } finally {
    db.close();
  }
}
function rehash(directory: string, manifest: BackupManifest) {
  const file = manifest.files.find((file) => file.path === 'study-companion.sqlite3')!;
  const bytes = readFileSync(join(directory, file.path));
  file.bytes = bytes.length;
  file.sha256 = createHash('sha256').update(bytes).digest('hex');
  rewriteManifest(directory, manifest);
}

it('roundtrips both databases, rowids, all snapshots and original source bytes, excluding credentials/index/model/drafts', async () => {
  const { root, destination, manifest } = await sample();
  const stage = temp();
  const copy = await verifyBackup(destination, progress, stage);
  expect(copy).toEqual(manifest);
  expect(readdirSync(destination).sort()).toEqual([
    'manifest.json',
    'sources',
    'study-activity.sqlite3',
    'study-companion.sqlite3',
  ]);
  for (const database of ['study-companion.sqlite3', 'study-activity.sqlite3'])
    expect(snapshotDatabase(join(stage, database))).toEqual(snapshotDatabase(join(root, database)));
  expect(readFileSync(join(stage, 'sources', fixtureSourceId + '.md'), 'utf8')).toBe(fixtureText);
  expect(manifest.counts).toMatchObject({
    sources: 1,
    notes: 1,
    conversations: 3,
    turns: 4,
    memories: 1,
    projects: 1,
    tasks: 1,
    focusSessions: 1,
    studyDays: 1,
  });
  expect(JSON.stringify(manifest)).not.toContain('EXCLUDED_TEST_SENTINEL');
});
it.each([
  ['extra table', 'CREATE TABLE hostile(x TEXT)'],
  ['extra trigger', 'CREATE TRIGGER hostile AFTER UPDATE ON notes BEGIN SELECT 1; END'],
  ['invalid memory', "UPDATE memories SET title=''"],
  ['invalid theme', "UPDATE app_settings SET value=json_set(value,'$.theme','unknown')"],
  ['invalid task date', "UPDATE daily_tasks SET day='2026-02-30'"],
  ['invalid focus UUID', "UPDATE focus_sessions SET task_id='invalid'"],
  ['invalid evidence', "UPDATE chat_turns SET evidence='{}'"],
  ['invalid position', "UPDATE sources SET position=json_set(position,'$.tone',json('[]'))"],
  ['invalid practice', "UPDATE chat_turns SET answer='{}' WHERE practice_request IS NOT NULL"],
  ['wrong purpose', "UPDATE conversations SET purpose='chat' WHERE purpose='note-feedback'"],
  ['wrong version', 'PRAGMA user_version=11'],
] as const)(
  'rejects %s after hashes are recalculated, leaving current learning data unchanged',
  async (_name, sql) => {
    const { root, destination, manifest } = await sample();
    const before = snapshotDatabase(join(root, 'study-companion.sqlite3'));
    mutate(destination, sql);
    rehash(destination, manifest);
    await expect(verifyBackup(destination, progress)).rejects.toThrow();
    expect(snapshotDatabase(join(root, 'study-companion.sqlite3'))).toEqual(before);
  },
);
it.each(['../outside', 'C:/outside', 'sources\\outside.md', 'sources/a.md:stream'])(
  'rejects unsafe manifest path %s',
  async (path) => {
    const { destination, manifest } = await sample();
    manifest.files[0].path = path;
    rewriteManifest(destination, manifest);
    await expect(verifyBackup(destination, progress)).rejects.toThrow();
  },
);
it('rejects extra files, hard links, directory junctions, app-root destinations and modified source content', async () => {
  const { root, destination } = await sample();
  writeFileSync(join(destination, 'extra.txt'), 'unexpected');
  await expect(verifyBackup(destination, progress)).rejects.toThrow();
  const clean = await sample();
  const hard = temp();
  linkSync(join(clean.destination, 'study-companion.sqlite3'), join(hard, 'link'));
  await expect(verifyBackup(clean.destination, progress)).rejects.toThrow();
  const alias = join(temp(), 'alias');
  symlinkSync(root, alias, 'junction');
  await expect(externalDirectory(alias, root)).rejects.toThrow();
  await expect(externalDirectory(root, root)).rejects.toThrow();
  const modified = await sample();
  writeFileSync(join(modified.destination, 'sources', fixtureSourceId + '.md'), 'changed');
  await expect(verifyBackup(modified.destination, progress)).rejects.toThrow();
});
it('allows old missing-theme JSON, rejects 11/1 folders and preserves strict 12/1 format', async () => {
  const { destination, manifest } = await sample();
  expect(await verifyBackup(destination, progress)).toEqual(manifest);
  const db = new DatabaseSync(join(destination, 'study-companion.sqlite3'));
  try {
    expect(
      JSON.parse(String(db.prepare('SELECT value FROM app_settings').get()!.value)),
    ).not.toHaveProperty('theme');
  } finally {
    db.close();
  }
  manifest.mainVersion = 11;
  rewriteManifest(destination, manifest);
  await expect(verifyBackup(destination, progress)).rejects.toThrow();
});
it('keeps exact old pointers across A/B restoration and refuses active/pending deletion or a missing active database', async () => {
  const { root, destination } = await sample();
  const original = snapshotDatabase(join(root, 'study-companion.sqlite3'));
  const a = randomUUID();
  const stageA = await createRestoreDirectory(root, a);
  await verifyBackup(destination, progress, stageA);
  await scheduleRestore(root, a, null);
  await expect(removeRestoreDirectory(root, a)).rejects.toThrow();
  await activateRestore(root, (await pendingRestore(root))!);
  const oldPointer = readFileSync(join(root, 'active-learning.json'), 'utf8');
  expect(readFileSync(join(root, 'before-restore-' + a + '.json'), 'utf8')).toBe('null');
  const b = randomUUID();
  const stageB = await createRestoreDirectory(root, b);
  await verifyBackup(destination, progress, stageB);
  await scheduleRestore(root, b, a);
  await activateRestore(root, (await pendingRestore(root))!);
  expect(readFileSync(join(root, 'before-restore-' + b + '.json'), 'utf8')).toBe(oldPointer);
  expect((await learningLocation(root)).id).toBe(b);
  expect(snapshotDatabase(join(root, 'study-companion.sqlite3'))).toEqual(original);
  await expect(removeRestoreDirectory(root, b)).rejects.toThrow();
  writeFileSync(join(root, 'active-learning.json'), oldPointer);
  expect((await learningLocation(root)).directory).toBe(stageA);
  const missing = randomUUID();
  mkdirSync(join(root, 'learning-restores', missing));
  writeFileSync(
    join(root, 'active-learning.json'),
    JSON.stringify({ format: 1, id: missing, previousId: a, restoredAt: new Date().toISOString() }),
  );
  await expect(learningLocation(root)).rejects.toThrow();
  expect(snapshotDatabase(join(root, 'study-companion.sqlite3'))).toEqual(original);
});
it('preserves previews after native cancel, schedules only once after confirmation, and refuses cancellation during commit/restart', async () => {
  const { root, destination } = await sample();
  let approve = false;
  const restart = vi.fn();
  const run = vi.fn(async (operation: string, source: string, target: string) =>
    operation === 'export'
      ? writeBackup(source, target, progress)
      : verifyBackup(source, progress, operation === 'inspect' ? target : undefined),
  );
  const runner = { run, cancel: vi.fn() } as unknown as BackupRunner;
  const service = new BackupService(root, await learningLocation(root), runner, {
    selectFolder: async () => destination,
    approveRestore: async () => approve,
    requireIdle: () => {},
    notify: () => {},
    restart,
  });
  const inspected = await service.inspect();
  expect(inspected.lastError).toBeNull();
  expect(inspected.preview).not.toBeNull();
  const id = inspected.preview!.id;
  expect((await service.confirm(id)).operation).toBe('idle');
  expect(await pendingRestore(root)).toBeUndefined();
  expect(service.snapshot().preview!.id).toBe(id);
  approve = true;
  expect((await service.confirm(id)).operation).toBe('restart');
  expect(restart).toHaveBeenCalledTimes(1);
  expect((await pendingRestore(root))!.id).toBe(id);
  expect(() => service.cancel()).toThrow();
  await expect(service.confirm(id)).rejects.toThrow();
  expect(restart).toHaveBeenCalledTimes(1);
});

it.each(['before-confirm', 'during-native-confirm', 'during-verification'] as const)(
  'refuses a restore at the exact expiry boundary %s without pending data or relaunch',
  async (phase) => {
    const { root, destination } = await sample();
    const before = snapshotDatabase(join(root, 'study-companion.sqlite3'));
    let now = Date.now();
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    let expiresAt = 0;
    const restart = vi.fn();
    const approveRestore = vi.fn(async () => {
      if (phase === 'during-native-confirm') now = expiresAt;
      return true;
    });
    const run = vi.fn(async (operation: string, source: string, target: string) => {
      const manifest = await verifyBackup(
        source,
        progress,
        operation === 'inspect' ? target : undefined,
      );
      if (operation === 'verify' && phase === 'during-verification') now = expiresAt;
      return manifest;
    });
    const service = new BackupService(
      root,
      await learningLocation(root),
      { run, cancel: vi.fn() } as unknown as BackupRunner,
      {
        selectFolder: async () => destination,
        approveRestore,
        requireIdle: () => {},
        notify: () => {},
        restart,
      },
    );
    const inspected = await service.inspect();
    expect(inspected.lastError).toBeNull();
    const preview = inspected.preview!;
    expiresAt = Date.parse(preview.expiresAt);
    if (phase === 'before-confirm') {
      now = expiresAt;
      await expect(service.confirm(preview.id)).rejects.toThrowError(
        expect.objectContaining({ code: 'restoreExpired' }),
      );
      expect(approveRestore).not.toHaveBeenCalled();
    } else {
      const result = await service.confirm(preview.id);
      expect(result).toMatchObject({ operation: 'idle', preview: { id: preview.id } });
      expect(result.lastError).toContain('过期');
      expect(approveRestore).toHaveBeenCalledTimes(1);
    }
    expect(run.mock.calls.filter(([operation]) => operation === 'verify')).toHaveLength(
      phase === 'during-verification' ? 1 : 0,
    );
    expect(service.snapshot().operation).toBe('idle');
    expect(await pendingRestore(root)).toBeUndefined();
    expect(restart).not.toHaveBeenCalled();
    expect(snapshotDatabase(join(root, 'study-companion.sqlite3'))).toEqual(before);
    expect((await learningLocation(root)).id).toBeNull();
  },
);
