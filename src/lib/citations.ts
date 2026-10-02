import type { Root } from 'mdast';

interface Node {
  type: string;
  value?: string;
  url?: string;
  children?: Node[];
}
export function remarkEvidence() {
  return (root: Root): void => {
    function visit(node: Node) {
      if (!node.children || ['link', 'image', 'code', 'inlineCode', 'html'].includes(node.type))
        return;
      node.children = node.children.flatMap((child) => {
        if (child.type !== 'text' || !child.value) {
          visit(child);
          return [child];
        }
        const output: Node[] = [];
        let start = 0;
        for (const match of child.value.matchAll(/\[(\d{1,3})\]/g)) {
          if (match.index > start)
            output.push({ type: 'text', value: child.value.slice(start, match.index) });
          output.push({
            type: 'link',
            url: `evidence:${match[1]}`,
            children: [{ type: 'text', value: match[0] }],
          });
          start = match.index + match[0].length;
        }
        if (start < child.value.length)
          output.push({ type: 'text', value: child.value.slice(start) });
        return output.length ? output : [child];
      });
    }
    visit(root as unknown as Node);
  };
}
export function citationNumber(
  url: string | undefined,
  evidence: { number: number }[],
): number | null {
  const match = /^evidence:(\d{1,3})$/.exec(url ?? '');
  const number = match ? Number(match[1]) : NaN;
  return evidence.some((hit) => hit.number === number) ? number : null;
}
