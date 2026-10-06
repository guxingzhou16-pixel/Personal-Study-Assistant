import type { Evidence, PracticeItem, PracticeKind } from './types';

export const practiceLimits = {
  items: 3,
  topic: 1000,
  question: 500,
  answer: 2000,
  output: 10_000,
} as const;
export const practiceLabels: Record<PracticeKind, string> = { cards: '知识卡片', quiz: '短测验' };

function fields(input: unknown, keys: string[]): Record<string, unknown> {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    Object.keys(input).length !== keys.length ||
    keys.some((key) => !Object.hasOwn(input, key))
  )
    throw new Error('练习结构不完整或包含不支持的字段。');
  return input as Record<string, unknown>;
}
function text(value: unknown, limit: number): string {
  if (typeof value !== 'string' || !value.trim() || value.length > limit)
    throw new Error('练习问题或参考答案为空或超过长度限制。');
  return value.trim();
}

// Shared by generation completion, restored views and backup validation. No execution or grading.
export function parsePractice(
  answer: string,
  evidence: Pick<Evidence, 'number'>[],
): PracticeItem[] {
  if (answer.length > practiceLimits.output) throw new Error('练习输出超过结构校验上限。');
  const raw = answer.trim().replace(/^```(?:json)?\s*\r?\n([\s\S]*?)\r?\n```$/i, '$1');
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('模型未返回完整的练习 JSON。');
  }
  const root = fields(parsed, ['items']);
  if (!Array.isArray(root.items) || root.items.length !== practiceLimits.items)
    throw new Error('需要恰好 3 个完整练习，未自动补题或截断。');
  const items = root.items.map((input): PracticeItem => {
    const item = fields(input, ['question', 'answer', 'citations']);
    if (
      !Array.isArray(item.citations) ||
      !item.citations.length ||
      item.citations.length > evidence.length ||
      item.citations.some(
        (number) => !Number.isSafeInteger(number) || !evidence.some((hit) => hit.number === number),
      ) ||
      new Set(item.citations).size !== item.citations.length
    )
      throw new Error('每个练习须引用至少一个实际证据编号，不能重复或虚构编号。');
    return {
      question: text(item.question, practiceLimits.question),
      answer: text(item.answer, practiceLimits.answer),
      citations: item.citations,
    };
  });
  if (new Set(items.map((item) => item.question.toLocaleLowerCase())).size !== items.length)
    throw new Error('练习问题重复，请核对原文后重新准备。');
  return items;
}
