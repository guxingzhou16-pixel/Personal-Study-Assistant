import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { emptyNoteDraft, noteMarkdown } from '../../src/lib/notes';
import { noteFileName, writeNoteExport } from './note-export';

const directories: string[] = [];
function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'study-note-export-'));
  directories.push(directory);
  const data = join(directory, 'data');
  const outside = join(directory, 'exports');
  mkdirSync(data);
  mkdirSync(outside);
  return { directory, data, outside };
}
afterEach(() =>
  directories.splice(0).forEach((directory) => rmSync(directory, { recursive: true, force: true })),
);

it('exports UTF-8 sections and escaped metadata, replacing only the selected external file', async () => {
  const { data, outside } = fixture();
  const destination = join(outside, '改名.md');
  writeFileSync(destination, '旧版本');
  const note = {
    ...emptyNoteDraft('a'.repeat(64)),
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    revision: 1,
    title: '[理解](https://example.com)',
    understanding: '中文🙂\n```ts\ncommit();\n```',
    evidence: '手动原文 [1]',
    questions: '- 为什么？',
    nextStep: '练习回滚',
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-02T00:00:00.000Z',
  };
  const markdown = noteMarkdown(note, '# 来源\n![图片](https://example.com)');
  expect(markdown).toContain('# \\[理解\\]\\(https://example\\.com\\)');
  expect(markdown).toContain('- 关联资料：\\# 来源 \\!\\[图片\\]');
  for (const label of ['我的理解', '原文依据', '待解问题', '下一步练习'])
    expect(markdown).toContain('## ' + label);
  for (const content of [note.understanding, note.evidence, note.questions, note.nextStep])
    expect(markdown).toContain(content);
  await writeNoteExport(destination, markdown, data);
  expect(readFileSync(destination, 'utf8')).toBe(markdown);
  expect(readdirSync(outside)).toEqual(['改名.md']);
});

it.each(['CON', 'NUL.txt', 'com1', 'lpt9', 'aux'])('avoids Windows reserved name %s', (name) => {
  expect(noteFileName(name)).toBe('笔记-' + name + '.md');
});
it('sanitizes filename separators, trailing dots and long Unicode titles', () => {
  expect(noteFileName('a/b:c?  .')).toBe('a_b_c_.md');
  expect(noteFileName('...')).toBe('学习笔记.md');
  expect(noteFileName('🙂'.repeat(100))).toBe('🙂'.repeat(80) + '.md');
});

it('rejects non-Markdown paths and protected data directories including junction aliases', async () => {
  const { directory, data, outside } = fixture();
  const child = join(data, 'sources');
  mkdirSync(child);
  const alias = join(directory, 'data-alias');
  symlinkSync(data, alias, process.platform === 'win32' ? 'junction' : 'dir');
  for (const destination of [join(data, 'a.md'), join(child, 'a.md'), join(alias, 'a.md')]) {
    writeFileSync(destination, '受保护内容');
    await expect(writeNoteExport(destination, '新内容', data)).rejects.toThrow('数据目录以外');
    expect(readFileSync(destination, 'utf8')).toBe('受保护内容');
  }
  const invalid = join(outside, 'a.txt');
  writeFileSync(invalid, '旧内容');
  await expect(writeNoteExport(invalid, '新内容', data)).rejects.toThrow('.md');
  expect(readFileSync(invalid, 'utf8')).toBe('旧内容');
  expect(readdirSync(outside)).toEqual(['a.txt']);
});

it('reports failed writes and replacement, leaves the old target intact and cleans staging files', async () => {
  const { data, outside } = fixture();
  await expect(writeNoteExport(join(outside, 'missing', 'a.md'), '内容', data)).rejects.toThrow(
    '未能导出',
  );
  const blockedTarget = join(outside, 'blocked.md');
  mkdirSync(blockedTarget);
  writeFileSync(join(blockedTarget, 'keep'), '保留');
  await expect(writeNoteExport(blockedTarget, '内容', data)).rejects.toThrow('未能导出');
  expect(readFileSync(join(blockedTarget, 'keep'), 'utf8')).toBe('保留');
  expect(readdirSync(outside)).toEqual(['blocked.md']);
});
