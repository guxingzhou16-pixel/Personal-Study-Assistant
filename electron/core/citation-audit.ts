import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import type { Evidence } from '../../src/lib/types';

interface Node {
  type: string;
  value?: string;
  children?: Node[];
}
const markdown = unified().use(remarkParse).use(remarkGfm);
const excluded = new Set([
  'code',
  'inlineCode',
  'html',
  'link',
  'image',
  'linkReference',
  'imageReference',
]);
interface VisibleText {
  text: string;
  citations: { number: number; start: number; end: number }[];
}
function visible(node: Node): VisibleText {
  // Keep a boundary so text on either side of code cannot form a new quote.
  if (excluded.has(node.type)) return { text: '\0', citations: [] };
  if (node.type === 'break') return { text: ' ', citations: [] };
  if (node.type === 'text') {
    const text = node.value ?? '';
    return {
      text,
      citations: [...text.matchAll(/\[(\d{1,3})\]/g)].map((match) => ({
        number: Number(match[1]),
        start: match.index,
        end: match.index + match[0].length,
      })),
    };
  }
  const result: VisibleText = { text: node.value ?? '', citations: [] };
  for (const child of node.children ?? []) {
    const content = visible(child);
    const offset = result.text.length;
    result.citations.push(
      ...content.citations.map((citation) => ({
        ...citation,
        start: citation.start + offset,
        end: citation.end + offset,
      })),
    );
    result.text += content.text;
  }
  return result;
}
function normalize(text: string): string {
  return text.replace(/\s+/gu, ' ').trim();
}

// This checks explicit excerpts only, not whether a paraphrase or conclusion is supported.
export function auditCitations(answer: string, evidence: Pick<Evidence, 'number' | 'text'>[]) {
  const references: number[] = [];
  const mismatches = new Set<number>();
  const originals = new Map(evidence.map((hit) => [hit.number, normalize(hit.text)]));
  function check({ text, citations }: VisibleText, rowReferences?: number[]) {
    references.push(...citations.map((citation) => citation.number));
    for (const match of text.matchAll(
      /“([^“”]+)”|‘([^‘’]+)’|「([^「」]+)」|『([^『』]+)』|"([^"]+)"|(?<![\p{L}\p{N}])'([^']+)'(?![\p{L}\p{N}])/gu,
    )) {
      const quoted = match.slice(1).find((value) => value !== undefined)!;
      if (quoted.includes('\0')) continue;
      const excerpt = normalize(quoted);
      const end = match.index + match[0].length;
      const following = /^\s*[，。,.!?！？]?\s*((?:\[\d{1,3}\]\s*)+)/.exec(text.slice(end));
      // Only whole tokens in actual text nodes can become clickable citations.
      const cited = following
        ? citations
            .filter(
              (citation) => citation.start >= end && citation.end <= end + following[0].length,
            )
            .map((citation) => citation.number)
        : (rowReferences ?? []);
      const actual = cited.filter((number) => originals.has(number));
      if (
        excerpt &&
        actual.length &&
        !actual.some((number) => originals.get(number)!.includes(excerpt))
      )
        actual.forEach((number) => mismatches.add(number));
    }
  }
  function visit(node: Node): void {
    if (excluded.has(node.type)) return;
    if (node.type === 'tableRow') {
      const cells = node.children!.map(visible);
      const rowReferences = cells.flatMap((cell) =>
        cell.citations.map((citation) => citation.number),
      );
      cells.forEach((cell) => check(cell, rowReferences));
    } else if (node.type === 'paragraph' || node.type === 'heading') {
      check(visible(node));
    } else node.children?.forEach(visit);
  }
  visit(markdown.parse(answer));
  return { numbers: references, unmatchedQuotes: [...mismatches].sort((a, b) => a - b) };
}
