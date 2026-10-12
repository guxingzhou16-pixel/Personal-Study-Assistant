import { test, expect, _electron as electron, type ElectronApplication } from '@playwright/test';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Storage } from '../electron/core/storage';
import { parseMarkdown } from '../electron/core/document-parser';
import { defaultSettings } from '../src/lib/types';

test('read, ask selected text, check the original and keep a note draft without page switching', async () => {
  const root = mkdtempSync(join(tmpdir(), 'study-reading-workspace-'));
  const text =
    '# 学习方法\n\n理解不等于照抄。先阅读原文，再用自己的话复述。\n\n## 自查\n\n比较自己的解释与原文，保留还没有依据的问题。';
  const id = createHash('sha256').update(text).digest('hex');
  mkdirSync(join(root, 'sources'));
  writeFileSync(join(root, 'sources', `${id}.md`), text);
  const requests: unknown[] = [];
  const server = createServer((request, response) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
    });
    request.on('end', () => {
      requests.push(JSON.parse(body));
      response.setHeader('Content-Type', 'application/x-ndjson');
      response.end(
        JSON.stringify({ message: { content: '选文建议先阅读，再自行复述。[1]' }, done: true }) +
          '\n',
      );
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as { port: number };
  const storage = new Storage(join(root, 'study-companion.sqlite3'));
  storage.saveSettings({
    ...defaultSettings,
    ollama: { baseUrl: `http://127.0.0.1:${address.port}`, model: 'fixture' },
  });
  storage.addSource({
    id,
    name: '学习方法',
    kind: 'markdown',
    bytes: Buffer.byteLength(text),
    ...parseMarkdown(Buffer.from(text)),
  });
  storage.close();
  let app: ElectronApplication | undefined;
  const { ELECTRON_RUN_AS_NODE: _ignored, ...env } = process.env;
  try {
    app = await electron.launch({ args: ['.'], env: { ...env, STUDY_COMPANION_DATA_DIR: root } });
    const page = await app.firstWindow();
    await page.getByRole('button', { name: '资料库', exact: true }).click();
    await page.getByRole('button', { name: '阅读 学习方法', exact: true }).click();
    await expect(page.locator('.markdown-reading')).toBeVisible();
    await page
      .locator('.markdown-reading p')
      .first()
      .evaluate((element) => {
        const range = document.createRange();
        range.selectNodeContents(element);
        const selection = window.getSelection()!;
        selection.removeAllRanges();
        selection.addRange(range);
      });
    await page.locator('.reader-scroll').dispatchEvent('mouseup');
    await page.getByRole('button', { name: '提问选中原文', exact: true }).click();
    await expect(page.getByRole('textbox', { name: '输入学习问题' })).toHaveValue(/这段原文/);
    await expect(page.getByRole('region', { name: '阅读 学习方法' })).toBeVisible();
    await page.getByRole('button', { name: '检索原文', exact: true }).click();
    await expect(page.getByText(/已加入你选中的确切原文/).first()).toBeVisible();
    await page.getByRole('button', { name: '发送问题', exact: true }).click();
    await expect(page.getByText('选文建议先阅读，再自行复述。', { exact: false })).toBeVisible();
    await page.getByRole('button', { name: '加入笔记草稿', exact: true }).click();
    await expect(page.locator('.note-section textarea').nth(1)).toHaveValue(/理解不等于照抄/);
    await page.locator('.note-section textarea').first().fill('我的理解：复述后需要与原文比较。');
    await page.getByRole('button', { name: '问答', exact: true }).click();
    await page.getByRole('textbox', { name: '输入学习问题' }).fill('这个问题先保留，尚未发送。');
    await page.getByRole('button', { name: '引用 1', exact: true }).click();
    await page.getByRole('button', { name: '返回选中原文', exact: true }).click();
    await expect(page.getByRole('textbox', { name: '输入学习问题' })).toHaveValue(
      '这个问题先保留，尚未发送。',
    );
    await page.getByRole('button', { name: '笔记草稿', exact: true }).click();
    await expect(page.locator('.note-section textarea').first()).toHaveValue(
      '我的理解：复述后需要与原文比较。',
    );
    expect(await page.evaluate(() => window.studyCompanion!.listNotes())).toEqual([]);
    await page.getByRole('button', { name: '保存笔记', exact: true }).click();
    await expect
      .poll(async () => (await page.evaluate(() => window.studyCompanion!.listNotes())).length)
      .toBe(1);
    await page.screenshot({ path: 'artifacts/reading-workspace.png' });
    expect(requests).toHaveLength(1);
    expect(JSON.stringify(requests[0])).toContain('理解不等于照抄');
    await app.close();
    app = undefined;
    const saved = new Storage(join(root, 'study-companion.sqlite3'));
    try {
      const note = saved.notes.get(saved.notes.list()[0].id);
      expect(note.understanding).toContain('复述后需要');
      expect(note.evidence).toContain(`study-companion://source/${id}#md-line-1`);
      expect(saved.getSource(id)?.position.anchor).toBe('md-line-1');
    } finally {
      saved.close();
    }
  } finally {
    await app?.close();
    await new Promise<void>((resolve) => {
      server.closeAllConnections();
      server.close(() => resolve());
    });
  }
});
