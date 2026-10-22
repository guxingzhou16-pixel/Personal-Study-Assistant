import { build } from 'esbuild';
import { PDFDocument, PDFName, PDFString, StandardFonts } from 'pdf-lib';
import { createHash } from 'node:crypto';
import {
  mkdirSync,
  mkdtempSync,
  openSync,
  closeSync,
  ftruncateSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createReadingFiles } from '../../../tests/fixtures/reading-files';
import { Documents, sourceId } from '../documents';
import { parseMarkdown, parsePdf } from '../document-parser';
import { Storage } from '../storage';

const directories: string[] = [];
const databases: Storage[] = [];
let workerDirectory: string;
let workerPath: string;
beforeAll(async () => {
  const cacheRoot = resolve('node_modules/.cache');
  mkdirSync(cacheRoot, { recursive: true });
  workerDirectory = mkdtempSync(join(cacheRoot, 'reading-test-'));
  workerPath = join(workerDirectory, 'worker.mjs');
  await build({
    entryPoints: ['electron/document-worker.ts'],
    outfile: workerPath,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node24',
    external: ['pdfjs-dist/*'],
  });
});
afterAll(() => {
  if (workerDirectory?.startsWith(resolve('node_modules/.cache')))
    rmSync(workerDirectory, { recursive: true, force: true });
});
afterEach(() => {
  for (const storage of databases.splice(0)) storage.close();
  for (const path of directories.splice(0)) {
    if (!path.startsWith(tmpdir())) throw new Error('Invalid test cleanup directory');
    rmSync(path, { recursive: true, force: true });
  }
});
function context() {
  const directory = mkdtempSync(join(tmpdir(), 'document-core-'));
  directories.push(directory);
  const storage = new Storage(join(directory, 'test.sqlite3'));
  databases.push(storage);
  const sources = join(directory, 'sources');
  return { directory, storage, sources, documents: new Documents(storage, sources, workerPath) };
}
it('returns exact selected source offsets, preserves literal punctuation and rejects invented or cross-section text', async () => {
  const { storage, documents, sources } = context();
  const text = '# 原文\n\n第一行 (x.y)[1]。\n第二行继续。\n\n## 下一节\n另一节。';
  const id = createHash('sha256').update(text).digest('hex');
  storage.addSource({
    id,
    name: '选文.md',
    kind: 'markdown',
    bytes: Buffer.byteLength(text),
    ...parseMarkdown(Buffer.from(text)),
  });
  mkdirSync(sources, { recursive: true });
  writeFileSync(join(sources, `${id}.md`), text);
  const selection = await documents.selection(id, 'md-line-1', '(x.y)[1]。 第二行继续。');
  const segment = storage.getSegment(id, selection.anchor)!;
  expect(segment.text.slice(selection.start, selection.end)).toBe(selection.text);
  expect(selection.text).toContain('\n');
  expect(selection.sourceId).toBe(id);
  await expect(documents.selection(id, 'md-line-1', '(xay)[1]。')).rejects.toThrow(
    '同一页或同一章节',
  );
  await expect(documents.selection(id, 'md-line-1', '继续。 另一节。')).rejects.toThrow(
    '同一页或同一章节',
  );
});
const utf8 = (value: string) => new TextEncoder().encode(value);

it('uses visible GFM boundaries for new Markdown evidence and maps old selections without changing stored offsets', async () => {
  const { storage, documents, sources } = context();
  const original =
    '# 版式验收\n\n| 方法 | 行动 |\n|---|---|\n| 主动回忆 | 独立回答 |\n\n- 先阅读\n- 再复述\n';
  const id = createHash('sha256').update(original).digest('hex');
  const parsed = parseMarkdown(utf8(original));
  expect(parsed.segments[0].text).toContain('主动回忆\t独立回答');
  expect(parsed.segments[0].text).toContain('先阅读\n再复述');
  const legacyText =
    '版式验收\n| 方法 | 行动 |\n|---|---|\n| 主动回忆 | 独立回答 |\n先阅读再复述\n';
  storage.addSource({
    id,
    name: '旧版资料',
    kind: 'markdown',
    bytes: Buffer.byteLength(original),
    ...parsed,
    segments: [{ ...parsed.segments[0], text: legacyText }],
  });
  mkdirSync(sources, { recursive: true });
  writeFileSync(join(sources, `${id}.md`), original);
  const before = storage.getSegment(id, 'md-line-1');
  for (const quote of ['主动回忆\t独立回答\n', '先阅读\n再复述']) {
    const selected = await documents.selection(id, 'md-line-1', quote);
    expect(legacyText.slice(selected.start, selected.end)).toBe(selected.text);
    expect(selected.sourceId).toBe(id);
    expect(selected.text).toContain(quote.startsWith('主动') ? '主动回忆' : '先阅读');
    expect(selected.text).toContain(quote.startsWith('主动') ? '独立回答' : '再复述');
  }
  expect(storage.getSegment(id, 'md-line-1')).toEqual(before);
  await expect(
    Promise.resolve().then(() => documents.selection(id, 'md-line-1', '先阅读 伪造 再复述')),
  ).rejects.toThrow('同一页或同一章节');
});

it('rejects ambiguous legacy Markdown selections when an image alt duplicates visible table text', async () => {
  const { storage, documents, sources } = context();
  const original =
    '# 图片同文\n\n| 方法 | 行动 |\n|---|---|\n| ![主动回忆](local.png)主动回忆 | 独立回答 |\n';
  const id = createHash('sha256').update(original).digest('hex');
  const parsed = parseMarkdown(utf8(original));
  expect(parsed.segments[0].text).toContain('主动回忆\t独立回答');
  const legacyText = '图片同文\n| 方法 | 行动 |\n|---|---|\n| 主动回忆主动回忆 | 独立回答 |\n';
  storage.addSource({
    id,
    name: '旧版图片资料.md',
    kind: 'markdown',
    bytes: Buffer.byteLength(original),
    ...parsed,
    segments: [{ ...parsed.segments[0], text: legacyText }],
  });
  mkdirSync(sources, { recursive: true });
  writeFileSync(join(sources, `${id}.md`), original);
  const before = storage.getSegment(id, 'md-line-1');

  await expect(documents.selection(id, 'md-line-1', '主动回忆\t独立回答')).rejects.toMatchObject({
    code: 'citation',
  });
  expect(storage.getSegment(id, 'md-line-1')).toEqual(before);
});

describe('document parsing and stable evidence locations', () => {
  it('keeps duplicate Chinese headings distinct and ignores headings inside fenced code', () => {
    const parsed = parseMarkdown(
      utf8(
        '# 标题\n开头内容\n\n## 标题\n章节内容\n\n```md\n# 不是目录\n```\n\n<script>secret()</script>',
      ),
    );
    expect(parsed.outline.map((item) => item.anchor)).toEqual(['md-line-1', 'md-line-4']);
    expect(parsed.segments[1].text).toContain('章节内容');
    expect(parsed.segments[1].text).not.toContain('secret()');
    expect(parsed.textStatus).toBe('ready');
  });
  it('preserves paragraphs without headings and rejects binary, empty and non-UTF8 files', () => {
    expect(parseMarkdown(utf8('只有段落。')).outline[0].anchor).toBe('md-line-1');
    expect(parseMarkdown(utf8('只有段落。')).segments[0].text).toContain('只有段落');
    expect(() => parseMarkdown(utf8(' \n'))).toThrow('为空');
    expect(() => parseMarkdown(utf8('hello\0'))).toThrow('二进制');
    expect(() => parseMarkdown(new Uint8Array([0xff]))).toThrow('UTF-8');
    expect(parseMarkdown(utf8('<script>x()</script>')).textStatus).toBe('none');
  });
  it('extracts actual PDF page text and distinguishes scans, corruption and page limits', async () => {
    const { directory } = context();
    const files = await createReadingFiles(directory);
    const progress: string[] = [];
    const parsed = await parsePdf(files.pdf, 1000, (text) => progress.push(text));
    expect(parsed.pageCount).toBe(2);
    expect(parsed.segments[1]).toMatchObject({ anchor: 'page-2', page: 2 });
    expect(parsed.segments[1].text).toContain('Evidence matters');
    expect(progress.at(-1)).toContain('2 / 2');
    expect((await parsePdf(files.scan, 1000, () => {})).textStatus).toBe('none');
    await expect(parsePdf(files.corrupt, 1000, () => {})).rejects.toThrow('无法解析');
    await expect(parsePdf(files.pdf, 1, () => {})).rejects.toThrow('1000 页');
  });
  it('resolves PDF bookmarks to stable pages and identifies partially scanned documents', async () => {
    const { directory, storage } = context();
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    pdf.addPage().drawText('First page evidence.', { x: 40, y: 700, font });
    const scanned = pdf.addPage();
    const outlineRef = pdf.context.nextRef();
    const itemRef = pdf.context.nextRef();
    pdf.context.assign(
      itemRef,
      pdf.context.obj({
        Title: PDFString.of('Scanned appendix'),
        Parent: outlineRef,
        Dest: [scanned.ref, PDFName.of('Fit')],
      }),
    );
    pdf.context.assign(
      outlineRef,
      pdf.context.obj({ Type: PDFName.of('Outlines'), First: itemRef, Last: itemRef, Count: 1 }),
    );
    pdf.catalog.set(PDFName.of('Outlines'), outlineRef);
    const path = join(directory, 'bookmarks.pdf');
    writeFileSync(path, await pdf.save());
    const parsed = await parsePdf(path, 1000, () => {});
    expect(parsed.textStatus).toBe('partial');
    expect(parsed.outline).toEqual([
      { anchor: 'page-2', title: 'Scanned appendix', depth: 1, page: 2 },
    ]);
    expect(parsed.segments[0].text).toContain('First page evidence');
    expect(parsed.segments[1].text).toBe('');
    const id = createHash('sha256').update(readFileSync(path)).digest('hex');
    storage.addSource({
      id,
      name: 'Appendix',
      kind: 'pdf',
      bytes: readFileSync(path).length,
      ...parsed,
    });
    expect(storage.getSource(id)?.position).toMatchObject({ page: 1, anchor: 'page-1' });
  });
});

describe('local document import, storage and provenance', () => {
  it('copies real files, deduplicates by content and keeps failed files out of the library', async () => {
    const { directory, documents, storage, sources } = context();
    const files = await createReadingFiles(directory);
    expect(
      await documents.import([files.markdown, files.pdf, files.scan, files.corrupt], () => {}),
    ).toMatchObject({ added: 3, duplicates: 0, failures: [{ file: 'broken.pdf' }] });
    expect(await documents.import([files.markdown], () => {})).toMatchObject({
      added: 0,
      duplicates: 1,
    });
    expect(storage.listSources()).toHaveLength(3);
    expect(readdirSync(sources).filter((name) => name.startsWith('.import-'))).toHaveLength(0);
    const markdown = storage.listSources().find((source) => source.kind === 'markdown')!;
    const pdf = storage.listSources().find((source) => source.name === 'Learning Notes')!;
    expect((await documents.open(markdown.id)).text).toContain('阅读与提问');
    expect((await documents.open(pdf.id)).data?.length).toBe(pdf.bytes);
    expect(storage.getSource(pdf.id)?.openedAt).not.toBeNull();
    expect(readFileSync(files.markdown, 'utf8')).toContain('学习方法');
    await expect(documents.citation(pdf.id, 'page-2', 'Evidence matters.')).resolves.toContain(
      '第 2 页',
    );
    await expect(
      documents.citation(markdown.id, markdown.outline[1].anchor, '阅读之后，写下一个具体的问题'),
    ).resolves.toContain('阅读与提问');
    await expect(documents.citation(pdf.id, 'page-1', 'invented')).rejects.toThrow('原文');
    await expect(documents.citation(pdf.id, 'page-90', 'Evidence')).rejects.toThrow('位置');
    await expect(documents.citation(pdf.id, 'page-1', 'x'.repeat(10_001))).rejects.toThrow('过长');
    const position = { page: 2, anchor: 'page-2', offset: 0, zoom: 1.25, tone: 'warm' };
    storage.saveReadingPosition(pdf.id, position);
    expect(storage.getSource(pdf.id)?.position).toEqual(position);
    for (const invalid of [
      { ...position, page: 3 },
      { ...position, page: 1.5 },
      { ...position, zoom: 5 },
      { ...position, anchor: '../../secrets' },
      { ...position, offset: -1 },
      { ...position, offset: Infinity },
      { ...position, tone: 'invalid' },
      { ...position, secret: 'ignored?' },
    ])
      expect(() => storage.saveReadingPosition(pdf.id, invalid)).toThrow('阅读位置');
    expect(() => sourceId('../../credentials.enc.json')).toThrow('标识');
    await expect(documents.open('0'.repeat(64))).rejects.toThrow('不存在');
    await expect(documents.citation('0'.repeat(64), 'page-1', 'text')).rejects.toThrow('不存在');
    expect(() => storage.saveReadingPosition('0'.repeat(64), position)).toThrow('不存在');
    await expect(documents.verify(markdown.id)).resolves.toBeUndefined();
    writeFileSync(join(sources, `${markdown.id}.md`), 'changed');
    await expect(documents.verify(markdown.id)).rejects.toThrow('已被修改');
    await expect(documents.open(markdown.id)).rejects.toThrow('已被修改');
    rmSync(join(sources, `${pdf.id}.pdf`));
    await expect(documents.verify(pdf.id)).rejects.toThrow('无法读取');
    await expect(documents.open(pdf.id)).rejects.toThrow('无法读取');
  });
  it('rejects oversized, empty and unsupported files without touching originals', async () => {
    const { directory, documents, storage } = context();
    const large = join(directory, 'large.md');
    const fd = openSync(large, 'w');
    ftruncateSync(fd, 5 * 1024 * 1024 + 1);
    closeSync(fd);
    const empty = join(directory, 'empty.md');
    writeFileSync(empty, '');
    const wrong = join(directory, 'notes.exe');
    writeFileSync(wrong, 'safe fixture');
    const report = await documents.import([large, empty, wrong], () => {});
    expect(report.failures.map((item) => item.message)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('5 MB'),
        expect.stringContaining('为空'),
        expect.stringContaining('只支持'),
      ]),
    );
    expect(storage.listSources()).toHaveLength(0);
    await expect(documents.import(Array(21).fill(empty), () => {})).rejects.toThrow('20 份');
  });
  it('cancels parsing cleanly, retains completed records and prevents overlapping imports', async () => {
    const { directory, documents, storage, sources } = context();
    const files = await createReadingFiles(directory);
    const completed = await documents.import([files.markdown], () => {});
    expect(completed.added).toBe(1);
    const first = documents.import([files.pdf], (event) => {
      if (event.message.includes('提取文字')) documents.cancel();
    });
    await expect(documents.import([files.pdf], () => {})).rejects.toThrow('正在进行');
    expect(await first).toMatchObject({ added: 0, cancelled: true, failures: [] });
    expect(storage.listSources()).toHaveLength(1);
    expect(readdirSync(sources).some((name) => name.startsWith('.import-'))).toBe(false);
    expect((await documents.import([files.pdf], () => {})).added).toBe(1);
  });
  it('rolls back a failed record transaction and preserves older records', () => {
    const { storage } = context();
    const id = createHash('sha256').update('transaction test').digest('hex');
    const parsed = parseMarkdown(utf8('# Hello\nEvidence.'));
    expect(() =>
      storage.addSource({
        id,
        name: 'Test',
        kind: 'markdown',
        bytes: 10,
        ...parsed,
        segments: [parsed.segments[0], parsed.segments[0]],
      }),
    ).toThrow();
    expect(storage.getSource(id)).toBeUndefined();
    storage.addSource({ id, name: 'Test', kind: 'markdown', bytes: 10, ...parsed });
    expect(storage.getSource(id)?.name).toBe('Test');
    expect(storage.getSegment(id, parsed.segments[0].anchor)?.text).toContain('Evidence');
  });
});
