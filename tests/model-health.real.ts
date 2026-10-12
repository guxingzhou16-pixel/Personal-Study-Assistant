import { test, expect, _electron as electron } from '@playwright/test';
import { mkdtempSync, cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { embeddingPath, verifyEmbeddingFiles } from '../electron/core/embedding-files';
import { Storage } from '../electron/core/storage';
import { defaultSettings } from '../src/lib/types';

test('explicit health probes run actual localhost generation and pinned CPU inference without saved conversations', async () => {
  const root = mkdtempSync(join(tmpdir(), 'study-health-real-'));
  const cached = embeddingPath(resolve('artifacts/embedding-model'));
  expect(await verifyEmbeddingFiles(cached)).toBe(true);
  cpSync(cached, embeddingPath(join(root, 'embedding-models')), { recursive: true });
  const storage = new Storage(join(root, 'study-companion.sqlite3'));
  storage.saveSettings({
    ...defaultSettings,
    ollama: { baseUrl: 'http://127.0.0.1:11434', model: 'qwen3.5:9b' },
  });
  storage.close();
  const { ELECTRON_RUN_AS_NODE: _ignored, ...env } = process.env;
  const app = await electron.launch({
    args: ['.'],
    env: { ...env, STUDY_COMPANION_DATA_DIR: root },
  });
  try {
    const page = await app.firstWindow();
    await expect(page.getByRole('heading', { name: '开始今天的小进步' })).toBeVisible();
    const result = await page.evaluate(async () => {
      const api = window.studyCompanion!;
      const generation = await api.probeGeneration('ollama|http://127.0.0.1:11434|qwen3.5:9b');
      const embedding = await api.probeEmbedding();
      return { generation, embedding, conversations: await api.listConversations() };
    });
    mkdirSync('artifacts/quality-improvements-2026-10-12', { recursive: true });
    writeFileSync(
      'artifacts/quality-improvements-2026-10-12/model-health-real.json',
      JSON.stringify(result, null, 2),
    );
    expect(result.generation.available).toBe(true);
    expect(result.generation.sample?.trim()).not.toBe('');
    expect(result.embedding.available).toBe(true);
    expect(result.embedding.message).toContain('512 维');
    expect(result.conversations).toEqual([]);
  } finally {
    await app.close();
  }
});
