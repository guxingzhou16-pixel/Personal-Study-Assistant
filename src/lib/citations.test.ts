import { expect, it } from 'vitest';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { citationNumber, remarkEvidence } from './citations';

it('creates citation links in text without changing inline code, fenced code or existing links', () => {
  const tree = unified()
    .use(remarkParse)
    .parse(
      '原文 [1] 和未知 [99]。\n\n`代码 [1]`\n\n```ts\nconst marker = "[1]";\n```\n\n[链接](https://example.com)',
    );
  remarkEvidence()(tree);
  const json = JSON.stringify(tree);
  expect(json).toContain('evidence:1');
  expect(json).toContain('evidence:99');
  expect(json).toContain('代码 [1]');
  expect(json).toContain('https://example.com');
  expect(tree.children.find((node) => node.type === 'code')?.value).toBe('const marker = "[1]";');
});
it('only accepts citation numbers from the actual retrieved evidence', () => {
  const references = [{ number: 1 }];
  expect(citationNumber('evidence:1', references)).toBe(1);
  for (const url of [
    'evidence:99',
    'https://example.com',
    'javascript:alert(1)',
    'evidence:1/extra',
    undefined,
  ])
    expect(citationNumber(url, references)).toBeNull();
});
