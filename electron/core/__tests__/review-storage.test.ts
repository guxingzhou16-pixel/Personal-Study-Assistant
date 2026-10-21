import { expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Storage } from '../storage';
import { StudyStorage } from '../study-storage';
import { readManifest, verifyBackup, writeBackup } from '../backup-files';
import {
  createLegacyDatabase,
  fixtureIds,
  fixtureTurn,
  fixtureSourceId,
  fixtureText,
} from '../../../tests/fixtures/legacy-databases';
import { inspectDatabases } from '../backup-data';
import {
  createRestoreDirectory,
  scheduleRestore,
  pendingRestore,
  activateRestore,
  learningLocation,
} from '../data-location';

export function seedQuiz(storage: Storage) {
  const turn = fixtureTurn(fixtureIds.chat, {
    id: randomUUID(),
    practiceRequest: { kind: 'quiz', topic: '事务', sourceId: fixtureSourceId },
    answer: JSON.stringify({
      items: [1, 2, 3].map((index) => ({
        question: `事务回忆问题 ${index}`,
        answer: '事务要么全部提交，要么全部回滚。',
        citations: [1],
      })),
    }),
  });
  storage.chat.addTurn(turn);
  return turn;
}
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'study-review-'));
  const path = join(root, 'study-companion.sqlite3');
  createLegacyDatabase(path, 11);
  const storage = new Storage(path);
  const turn = seedQuiz(storage);
  const draft = {
    turnId: turn.id,
    itemIndex: 0,
    revision: 0,
    response: '先自己回忆，再去核对。',
    hasQuestion: true,
    reviewDay: '2026-10-13',
  };
  return { root, path, storage, turn, draft };
}
it('saves only user-selected answers, checks revision and date, and retains exact reference snapshots after restart', () => {
  const { path, storage, turn, draft } = fixture();
  expect(storage.reviews.list(null)).toEqual([]);
  expect(() => storage.reviews.save({ ...draft, reviewDay: '2026-02-30' })).toThrow('复习日期');
  expect(() => storage.reviews.save({ ...draft, itemIndex: 4 })).toThrow('格式');
  const saved = storage.reviews.save(draft);
  expect(saved.evidence).toEqual(turn.evidence);
  expect(saved.question).toBe('事务回忆问题 1');
  expect(() => storage.reviews.save(draft)).toThrow('已更新');
  expect(storage.reviews.list(null)).toHaveLength(1);
  storage.close();
  const reopened = new Storage(path);
  try {
    expect(reopened.reviews.get(saved.id)).toEqual(saved);
  } finally {
    reopened.close();
  }
});
it('keeps saved recall independent of the source conversation and never changes tasks or memories', () => {
  const { path, storage, draft } = fixture();
  try {
    const saved = storage.reviews.save(draft);
    const db = new DatabaseSync(path);
    db.exec('PRAGMA foreign_keys=ON;');
    db.prepare('DELETE FROM conversations WHERE id=?').run(fixtureIds.chat);
    db.close();
    expect(storage.reviews.get(saved.id).response).toBe(draft.response);
    expect(
      storage.reviews.save({ ...draft, revision: saved.revision, response: '这次另一个解释。' })
        .revision,
    ).toBe(2);
    expect(storage.planning.overview('2026-10-13').tasks).toEqual([]);
  } finally {
    storage.close();
  }
});
it('migrates actual v12 data with an original backup and accepts old backup manifests without fabricated review counts', async () => {
  const { root, path, storage } = fixture();
  storage.close();
  const old = new DatabaseSync(path);
  old.exec('DROP TABLE practice_reviews; PRAGMA user_version=12;');
  old.close();
  new StudyStorage(join(root, 'study-activity.sqlite3')).close();
  mkdirSync(join(root, 'sources'));
  writeFileSync(join(root, 'sources', `${fixtureSourceId}.md`), fixtureText);
  expect(inspectDatabases(root).mainVersion).toBe(12);
  const backupRoot = mkdtempSync(join(tmpdir(), 'study-review-v12-backup-'));
  const manifest = await writeBackup(root, backupRoot, () => {});
  // writeBackup normally runs after migration; preserve this genuinely older snapshot's version.
  manifest.mainVersion = 12;
  delete (manifest.counts as Partial<typeof manifest.counts>).reviews;
  writeFileSync(join(backupRoot, 'manifest.json'), JSON.stringify(manifest));
  expect(readManifest(manifest).counts.reviews).toBe(0);
  expect((await verifyBackup(backupRoot, () => {})).mainVersion).toBe(12);
  const activationRoot = mkdtempSync(join(tmpdir(), 'study-review-old-activation-'));
  const restoreId = randomUUID();
  const stage = await createRestoreDirectory(activationRoot, restoreId);
  await verifyBackup(backupRoot, () => {}, stage);
  await scheduleRestore(activationRoot, restoreId, null);
  // Match startup: verify older data, open/migrate the candidate, then change the active pointer.
  const candidate = new Storage(join(stage, 'study-companion.sqlite3'));
  expect(candidate.schemaVersion).toBe(13);
  candidate.close();
  await activateRestore(activationRoot, (await pendingRestore(activationRoot))!);
  expect((await learningLocation(activationRoot)).directory).toBe(stage);
  const migrated = new Storage(path);
  try {
    expect(migrated.schemaVersion).toBe(13);
    expect(migrated.chat.get(fixtureIds.chat).turns.length).toBeGreaterThan(0);
    expect(migrated.reviews.list(null)).toEqual([]);
    expect(readdirSync(root).some((name) => name.includes('before-v13-'))).toBe(true);
  } finally {
    migrated.close();
  }
});
it('includes saved answers and dates in a checked complete backup and restores them into a fresh directory', async () => {
  const { root, storage, draft } = fixture();
  const saved = storage.reviews.save(draft);
  storage.close();
  new StudyStorage(join(root, 'study-activity.sqlite3')).close();
  mkdirSync(join(root, 'sources'));
  writeFileSync(join(root, 'sources', `${fixtureSourceId}.md`), fixtureText);
  const destination = mkdtempSync(join(tmpdir(), 'study-review-backup-'));
  const manifest = await writeBackup(root, destination, () => {});
  expect(manifest.mainVersion).toBe(13);
  expect(manifest.counts.reviews).toBe(1);
  const restored = mkdtempSync(join(tmpdir(), 'study-review-restored-'));
  await verifyBackup(destination, () => {}, restored);
  const reopened = new Storage(join(restored, 'study-companion.sqlite3'));
  try {
    expect(reopened.reviews.get(saved.id)).toEqual(saved);
  } finally {
    reopened.close();
  }
  const corrupted = new DatabaseSync(join(destination, 'study-companion.sqlite3'));
  corrupted
    .prepare('UPDATE practice_reviews SET review_day=? WHERE id=?')
    .run('2026-02-30', saved.id);
  corrupted.close();
  expect(() => inspectDatabases(destination)).toThrow('作答记录格式损坏');
});
