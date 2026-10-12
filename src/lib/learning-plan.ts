import type { Evidence, LearningPlan, LearningStep } from './types';

export const learningPlanLimits = {
  steps: 8,
  title: 120,
  action: 2000,
  artifact: 500,
  limitations: 2000,
  output: 24000,
} as const;

function fields(input: unknown, keys: string[]): Record<string, unknown> {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    Object.keys(input).length !== keys.length ||
    keys.some((key) => !Object.hasOwn(input, key))
  )
    throw new Error('路线结构不完整或含不支持的字段。');
  return input as Record<string, unknown>;
}
function text(input: unknown, label: string, limit: number, empty = false): string {
  if (
    typeof input !== 'string' ||
    (!empty && !input.trim()) ||
    input.includes('\0') ||
    input.length > limit
  )
    throw new Error(`${label}为空或超过长度限制。`);
  return input.trim();
}

// Shape and budget checks do not prove that a source supports a model's statements.
export function validateLearningPlan(
  input: unknown,
  evidence: Pick<Evidence, 'number'>[],
  budget: number,
): LearningPlan {
  const root = fields(input, ['steps', 'limitations']);
  if (
    !Array.isArray(root.steps) ||
    root.steps.length < 2 ||
    root.steps.length > learningPlanLimits.steps
  )
    throw new Error('路线须包含2～8个步骤，没有自动补齐或截断。');
  const steps = root.steps.map((value): LearningStep => {
    const step = fields(value, ['title', 'action', 'minutes', 'citations', 'artifact']);
    if (
      typeof step.minutes !== 'number' ||
      !Number.isSafeInteger(step.minutes) ||
      step.minutes < 5 ||
      step.minutes > 180
    )
      throw new Error('每个步骤须为5～180之间的整数分钟，不能静默调整。');
    if (
      !Array.isArray(step.citations) ||
      !step.citations.length ||
      step.citations.length > evidence.length ||
      step.citations.some(
        (number) => !Number.isSafeInteger(number) || !evidence.some((hit) => hit.number === number),
      ) ||
      new Set(step.citations).size !== step.citations.length
    )
      throw new Error('每个步骤须关联实际证据编号，不能缺失、重复或虚构编号。');
    const title = text(step.title, '步骤标题', learningPlanLimits.title);
    if (/[\r\n]/.test(title)) throw new Error('步骤标题须为单行。');
    return {
      title,
      action: text(step.action, '步骤行动', learningPlanLimits.action),
      minutes: step.minutes,
      citations: step.citations,
      artifact: text(step.artifact, '预期产出', learningPlanLimits.artifact),
    };
  });
  const total = steps.reduce((sum, step) => sum + step.minutes, 0);
  if (!Number.isSafeInteger(budget) || budget < 10 || budget > 180 || total !== budget)
    throw new Error(
      `步骤合计${total}分钟，与本次预算${budget}分钟不一致。请手动修改，没有自动重分配。`,
    );
  const limitations = text(root.limitations, '待求证范围', learningPlanLimits.limitations, true);
  for (const content of [
    limitations,
    ...steps.flatMap((step) => [step.title, step.action, step.artifact]),
  ])
    for (const match of content.matchAll(/\[(\d+)\]/g))
      if (!evidence.some((hit) => hit.number === Number(match[1])))
        throw new Error('路线文字包含不存在的引用编号，请核对实际资料。');
  return { steps, limitations };
}

export function parseLearningPlan(
  answer: string,
  evidence: Pick<Evidence, 'number'>[],
  budget: number,
): LearningPlan {
  if (answer.length > learningPlanLimits.output) throw new Error('路线输出超过结构校验上限。');
  let value: unknown;
  try {
    value = JSON.parse(answer);
  } catch {
    throw new Error('模型未返回完整的路线JSON。原始输出保留，不自动重试。');
  }
  return validateLearningPlan(value, evidence, budget);
}
