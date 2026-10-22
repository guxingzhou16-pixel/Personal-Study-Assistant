import { readFile } from 'node:fs/promises';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import { toString } from 'mdast-util-to-string';
import type { Heading, Root } from 'mdast';
import type { ParsedDocument, OutlineEntry, SourceSegment } from '../../src/lib/types';
import { AppError } from './errors';

export interface MarkdownSelectionMap {
  anchor: string;
  legacyText: string;
  spans: { start: number; end: number; legacyStart: number }[];
}
export type ParserResult = ParsedDocument & { markdownSelections?: MarkdownSelectionMap[] };
interface MarkdownNode {
  type: string;
  value?: string;
  alt?: string | null;
  position?: Root['position'];
  children?: MarkdownNode[];
}
interface Token {
  text: string;
  literal: boolean;
  legacyUnsafe?: boolean;
  sourceStart?: number;
  sourceEnd?: number;
}
function literalToken(node: MarkdownNode): Token {
  return {
    text: toString(node),
    literal: true,
    sourceStart: node.position?.start.offset,
    sourceEnd: node.position?.end.offset,
  };
}
function legacyTokens(node: MarkdownNode): Token[] {
  if (node.value !== undefined || node.alt) return [literalToken(node)];
  return (node.children ?? []).flatMap(legacyTokens);
}
function visibleTokens(node: MarkdownNode): Token[] {
  if (node.type === 'html' || node.type === 'image' || node.type === 'imageReference')
    return [{ text: '', literal: false, legacyUnsafe: true }];
  if (node.type === 'break') return [{ text: '\n', literal: false }];
  if (node.value !== undefined) return [literalToken(node)];
  const separator =
    node.type === 'tableRow'
      ? '\t'
      : ['table', 'list', 'listItem', 'blockquote'].includes(node.type)
        ? '\n'
        : '';
  return (node.children ?? []).flatMap((child, index) => [
    ...(index && separator ? [{ text: separator, literal: false }] : []),
    ...visibleTokens(child),
  ]);
}
function markdownSections(tree: Root, render: (node: MarkdownNode) => Token[]) {
  const outline: OutlineEntry[] = [];
  const sections: { segment: SourceSegment; tokens: Token[] }[] = [];
  let current: SourceSegment = {
    anchor: 'md-line-1',
    title: '文档开头',
    depth: 1,
    line: 1,
    text: '',
  };
  let tokens: Token[] = [];
  const save = () => {
    if (current.text.trim()) sections.push({ segment: current, tokens });
  };
  for (const node of tree.children) {
    if (node.type === 'heading') {
      save();
      const heading = node as Heading;
      const line = heading.position!.start.line;
      const entry = {
        anchor: `md-line-${line}`,
        title: toString(heading).slice(0, 200) || '无标题章节',
        depth: heading.depth,
        line,
      };
      outline.push(entry);
      current = { ...entry, text: '' };
      tokens = [];
    }
    if (node.type !== 'html') {
      const content = [...render(node), { text: '\n', literal: false }];
      tokens.push(...content);
      current.text += content.map((token) => token.text).join('');
    }
  }
  save();
  if (!outline.length) outline.push({ anchor: 'md-line-1', title: '文档开头', depth: 1, line: 1 });
  return { outline, sections };
}

export function parseMarkdown(data: Uint8Array): ParserResult {
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(data);
  } catch {
    throw new AppError('markdownEncoding', 'Markdown 需要 UTF-8 编码，请转换编码后导入。');
  }
  if (!text.trim() || text.includes('\0'))
    throw new AppError('markdownContent', 'Markdown 为空或包含二进制内容。');
  const legacy = markdownSections(unified().use(remarkParse).parse(text), (node) => {
    const tokens = legacyTokens(node);
    const original = toString(node);
    return tokens.map((token) => token.text).join('') === original
      ? tokens
      : [{ text: original, literal: true }];
  });
  const current = markdownSections(
    unified().use(remarkParse).use(remarkGfm).parse(text),
    visibleTokens,
  );
  const markdownSelections: MarkdownSelectionMap[] = [];
  for (const { segment, tokens } of current.sections) {
    // Legacy text includes HTML and image alt text; text search cannot prove the visible occurrence.
    if (tokens.some((token) => token.legacyUnsafe)) continue;
    const old = legacy.sections.find((entry) => entry.segment.anchor === segment.anchor);
    if (!old) continue;
    const spans: MarkdownSelectionMap['spans'] = [];
    let offset = 0,
      legacyOffset = 0,
      legacyIndex = 0;
    let mapped = true;
    for (const token of tokens) {
      if (token.literal && token.text) {
        const { sourceStart, sourceEnd } = token;
        if (sourceStart === undefined || sourceEnd === undefined) {
          mapped = false;
          break;
        }
        while (
          legacyIndex < old.tokens.length &&
          (old.tokens[legacyIndex].sourceEnd ?? -1) <= sourceStart
        ) {
          legacyOffset += old.tokens[legacyIndex].text.length;
          legacyIndex++;
        }
        const original = old.tokens[legacyIndex];
        const oldStart = original?.sourceStart;
        const oldEnd = original?.sourceEnd;
        if (
          oldStart === undefined ||
          oldEnd === undefined ||
          oldStart > sourceStart ||
          oldEnd < sourceEnd
        ) {
          mapped = false;
          break;
        }
        const sameNode =
          oldStart === sourceStart && oldEnd === sourceEnd && original.text === token.text;
        // A split GFM leaf maps only when both values preserve their exact source text.
        const rawSlice =
          text.slice(oldStart, oldEnd) === original.text &&
          text.slice(sourceStart, sourceEnd) === token.text;
        if (!sameNode && !rawSlice) {
          mapped = false;
          break;
        }
        const start = legacyOffset + (sameNode ? 0 : sourceStart - oldStart);
        spans.push({ start: offset, end: offset + token.text.length, legacyStart: start });
      }
      offset += token.text.length;
    }
    if (mapped)
      markdownSelections.push({ anchor: segment.anchor, legacyText: old.segment.text, spans });
  }
  const segments = current.sections.map((entry) => entry.segment);
  return {
    pageCount: 1,
    textStatus: segments.length ? 'ready' : 'none',
    outline: current.outline,
    segments,
    markdownSelections,
  };
}

export async function parsePdf(
  path: string,
  maxPages: number,
  progress: (message: string) => void,
): Promise<ParsedDocument> {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task = getDocument({
    data: new Uint8Array(await readFile(path)),
    useSystemFonts: true,
    disableFontFace: true,
    useWasm: false,
    stopAtErrors: true,
    enableXfa: false,
    verbosity: 0,
  });
  try {
    const pdf = await task.promise;
    if (pdf.numPages > maxPages)
      throw new AppError('pageLimit', 'PDF 超过 1000 页，请拆分后导入。');
    const segments: SourceSegment[] = [];
    let totalText = 0;
    for (let number = 1; number <= pdf.numPages; number++) {
      const page = await pdf.getPage(number);
      const content = await page.getTextContent();
      const text = content.items
        .map((item) => ('str' in item ? `${item.str}${item.hasEOL ? '\n' : ' '}` : ''))
        .join('')
        .trim();
      totalText += text.length;
      if (totalText > 5_000_000) throw new AppError('textLimit', 'PDF 文字量过大，请拆分后导入。');
      segments.push({
        anchor: `page-${number}`,
        title: `第 ${number} 页`,
        depth: 1,
        page: number,
        text,
      });
      page.cleanup();
      progress(`提取文字：${number} / ${pdf.numPages} 页`);
    }
    const outline: OutlineEntry[] = [];
    type PdfOutline = NonNullable<Awaited<ReturnType<typeof pdf.getOutline>>>;
    async function visit(items: PdfOutline, depth: number) {
      for (const item of items) {
        if (outline.length >= 2000 || depth > 10) return;
        let dest = item.dest;
        if (typeof dest === 'string') dest = await pdf.getDestination(dest);
        if (Array.isArray(dest) && dest.length) {
          const ref = dest[0];
          const index = typeof ref === 'number' ? ref : await pdf.getPageIndex(ref);
          if (index >= 0 && index < pdf.numPages)
            outline.push({
              anchor: `page-${index + 1}`,
              title: item.title.slice(0, 200),
              depth,
              page: index + 1,
            });
        }
        if (item.items?.length) await visit(item.items, depth + 1);
      }
    }
    // Invalid bookmarks must not make otherwise readable pages unusable.
    try {
      const bookmarks = await pdf.getOutline();
      if (bookmarks) await visit(bookmarks, 1);
    } catch {
      progress('部分目录无法定位，使用页码目录。');
    }
    if (!outline.length) outline.push(...segments.map(({ text: _text, ...entry }) => entry));
    const textPages = segments.filter((segment) => segment.text.trim()).length;
    return {
      pageCount: pdf.numPages,
      textStatus: textPages === 0 ? 'none' : textPages === pdf.numPages ? 'ready' : 'partial',
      outline,
      segments,
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (error instanceof Error && error.name === 'PasswordException')
      throw new AppError('pdfPassword', '此 PDF 需要密码，请解锁后导入。');
    throw new AppError('pdfInvalid', 'PDF 无法解析，请检查文件是否损坏或格式不正确。');
  } finally {
    await task.destroy();
  }
}
