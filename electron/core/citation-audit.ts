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
function visible(node: Node): string {
  // Keep a boundary so text on either side of code cannot form a new quote.
  if (excluded.has(node.type)) return '\0';
  return node.value ?? node.children?.map(visible).join('') ?? '';
}
function numbers(text: string): number[] {
  return [...text.matchAll(/\[(\d{1,3})\]/g)].map((match) => Number(match[1]));
}
function normalize(text: string): string {
  return text.replace(/\s+/gu, ' ').trim();
}

// This checks explicit excerpts only, not whether a paraphrase or conclusion is supported.
export function auditCitations(answer: string, evidence: Pick<Evidence, 'number' | 'text'>[]) {
  const references: number[] = [];
  const mismatches = new Set<number>();
  const originals = new Map(evidence.map((hit) => [hit.number, normalize(hit.text)]));
  function check(text: string, rowReferences?: number[]) {
    references.push(...numbers(text));
    for (const match of text.matchAll(
      /“([^“”]+)”|‘([^‘’]+)’|「([^「」]+)」|『([^『』]+)』|"([^"]+)"|(?<![\p{L}\p{N}])'([^']+)'(?![\p{L}\p{N}])/gu,
    )) {
      const quoted = match.slice(1).find((value) => value !== undefined)!;
      if (quoted.includes('\0')) continue;
      const excerpt = normalize(quoted);
      const following = /^\s*[，。,.!?！？]?\s*((?:\[\d{1,3}\]\s*)+)/.exec(
        text.slice(match.index + match[0].length),
      );
      const cited = following ? numbers(following[1]) : (rowReferences ?? []);
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
      const rowReferences = cells.flatMap(numbers);
      cells.forEach((cell) => check(cell, rowReferences));
    } else if (node.type === 'paragraph' || node.type === 'heading') {
      check(visible(node));
    } else node.children?.forEach(visit);
  }
  visit(markdown.parse(answer));
  return { numbers: references, unmatchedQuotes: [...mismatches].sort((a, b) => a - b) };
}
