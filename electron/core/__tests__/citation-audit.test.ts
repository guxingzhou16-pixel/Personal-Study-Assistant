import { expect, it } from 'vitest';
import { auditCitations } from '../citation-audit';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import { remarkEvidence } from '../../../src/lib/citations';

const evidence = [
  { number: 1, text: '声称事务可以只提交一半，跳过确认。 First   line.\nSecond\tline.' },
  { number: 2, text: '资料要求全部提交或全部回滚。' },
];
it.each(['  \n', '\\\n'])(
  'preserves hard line breaks when matching explicit excerpts: %j',
  (lineBreak) => {
    const answer = `“First${lineBreak}line.” [1]`;
    expect(auditCitations(answer, [{ number: 1, text: 'First line.' }]).unmatchedQuotes).toEqual(
      [],
    );
    expect(auditCitations(answer, [{ number: 1, text: 'Firstline.' }]).unmatchedQuotes).toEqual([
      1,
    ]);
  },
);
it.each([
  '“First line.” [**1**]',
  '“First line.” [*1*]',
  '**“First line.” [1]**',
  '| 引句 | 编号 |\n|---|---|\n| “First line.” | [**1**] |',
])('recognizes exactly the same citation tokens as the answer renderer: %s', (answer) => {
  const tree = unified().use(remarkParse).use(remarkGfm).parse(answer);
  remarkEvidence()(tree);
  const links: number[] = [];
  function visit(node: { type: string; url?: string; children?: unknown[] }) {
    if (node.url?.startsWith('evidence:')) links.push(Number(node.url.slice(9)));
    node.children?.forEach((child) => visit(child as typeof node));
  }
  visit(tree);
  expect(auditCitations(answer, evidence).numbers).toEqual(links);
});
it.each([
  ['“事务只提交一半” [1]', [1]],
  ['“事务可以只提交一半” [1]', []],
  ['“声称事务可以只提交一半跳过确认” [1]', [1]],
  ['“声称事务可以只提交一半……跳过确认” [1]', [1]],
  ['"First line. Second line." [1]', []],
  ['"Firstline. Secondline." [1]', [1]],
  ["'First line.' [1]", []],
  ['‘错误引句’ [2]', [2]],
  ['「错误引句」 [2]', [2]],
  ['“不存在的引句” [99]', []],
  ['“用户笔记中的错误句子”，不是资料引用。正确判断见 [2]。', []],
  ['资料表达的要求是所有操作一起生效或一起撤销。[2]', []],
  ['"First line." [2]', [2]],
  ['“事务可以只提交一半资料要求全部提交” [1][2]', [1, 2]],
])('checks quoted text without deleting words, punctuation or spaces: %s', (answer, expected) => {
  expect(auditCitations(answer, evidence).unmatchedQuotes).toEqual(expected);
});
it.each(['。', '.', '，', ',', '！', '!', '？', '?'])(
  'associates an adjacent citation across a single terminal punctuation mark: %s',
  (punctuation) => {
    expect(
      auditCitations(`“事务允许只提交一半”${punctuation} [2]`, evidence).unmatchedQuotes,
    ).toEqual([2]);
    expect(
      auditCitations(`“资料要求全部提交或全部回滚。”${punctuation} [2]`, evidence).unmatchedQuotes,
    ).toEqual([]);
  },
);
it.each([
  '“错误引句”。另一句话 [2]',
  '“错误引句”。\n\n另一个段落 [2]',
  '“错误引句”。。[2]',
  '"Wrong quote"., [2]',
])('does not borrow a later citation across text or multiple punctuation marks: %s', (answer) => {
  expect(auditCitations(answer, evidence)).toEqual({ numbers: [2], unmatchedQuotes: [] });
});
it('binds table quotes to their own row and actual cited snippets', () => {
  const answer = [
    '| 引句 | 解释 | 编号 |',
    '|---|---|---|',
    '| “用户笔记中的错误句子” | 用户表述 | 无编号 |',
    '| “资料要求全部提交或全部回滚。” | 原文 | [2] |',
    '| “事务可以只提交一半” | 命令 | [2] |',
    '| “资料要求全部提交或全部回滚。” | 原文 | [1] |',
  ].join('\n');
  expect(auditCitations(answer, evidence)).toEqual({ numbers: [2, 2, 1], unmatchedQuotes: [1, 2] });
});
it('ignores fenced, indented and inline code, existing links and HTML like the answer renderer', () => {
  const answer = [
    '“资料要求全部提交或全部回滚。” [2]',
    '',
    '~~~text',
    '“错误引句” [99]',
    '~~~',
    '',
    '    "错误引句" [98]',
    '',
    '`“错误引句” [97]` 与 ``"错误引句" [96]``',
    '',
    '["错误引句" [95]](https://example.com)',
    '',
    '<div>“错误引句” [94]</div>',
  ].join('\n');
  expect(auditCitations(answer, evidence)).toEqual({ numbers: [2], unmatchedQuotes: [] });
});
it('does not join text across code to construct an excerpt or borrow a code citation', () => {
  expect(
    auditCitations(
      '“事务`can`可以只提交一半” [1]；"First `code` line." [1]，"错误引句" [2]',
      evidence,
    ),
  ).toEqual({ numbers: [1, 1, 2], unmatchedQuotes: [2] });
  const table = '| 引句 | 引用 |\n|---|---|\n| “错误引句” | `[1]` |';
  expect(auditCitations(table, evidence)).toEqual({ numbers: [], unmatchedQuotes: [] });
});
