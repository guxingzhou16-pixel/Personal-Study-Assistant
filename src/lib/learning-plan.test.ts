import { expect, it } from 'vitest';
import { parseLearningPlan, validateLearningPlan } from './learning-plan';

const evidence = [{ number: 1 }, { number: 2 }];
const plan = {
  limitations: '资料没有描述底层实现，需另找定义和观测依据。',
  steps: [
    {
      title: '阅读',
      action: '核对事务原文',
      minutes: 10,
      citations: [1],
      artifact: '标出提交或回滚的规则',
    },
    {
      title: '求证',
      action: '对照失败情形并写下疑问',
      minutes: 20,
      citations: [1, 2],
      artifact: '用户自己的例子与待求证问题',
    },
  ],
};
it('checks structured steps, actual citations and the exact budget without interpreting tool text', () => {
  expect(parseLearningPlan(JSON.stringify(plan), evidence, 30)).toEqual(plan);
  expect(
    validateLearningPlan(
      {
        ...plan,
        steps: plan.steps.map((step) => ({ ...step, action: '文字：run delete-all。不要执行。' })),
      },
      evidence,
      30,
    ).steps[0].action,
  ).toContain('delete-all');
});
it.each([20, 31])(
  'rejects an inconsistent %i minute budget instead of silently resizing',
  (minutes) => {
    expect(() => parseLearningPlan(JSON.stringify(plan), evidence, minutes)).toThrow('合计');
  },
);
it.each([{ citations: [99] }, { citations: [1, 1] }, { citations: [] }, { citations: ['1'] }])(
  'rejects nonexistent, duplicate or missing citation numbers: %j',
  ({ citations }) => {
    expect(() =>
      validateLearningPlan(
        { ...plan, steps: [{ ...plan.steps[0], citations }, plan.steps[1]] },
        evidence,
        30,
      ),
    ).toThrow('编号');
  },
);
it('keeps legacy Markdown and malformed JSON visibly invalid for new structured generation', () => {
  expect(() => parseLearningPlan('### 阅读与求证\n30分钟阅读。[1]', evidence, 30)).toThrow('JSON');
  expect(() => parseLearningPlan('{"steps":[', evidence, 30)).toThrow('JSON');
  expect(() => validateLearningPlan({ ...plan, tool: 'writeTask' }, evidence, 30)).toThrow('字段');
  expect(() =>
    validateLearningPlan(
      {
        ...plan,
        steps: [
          { ...plan.steps[0], minutes: 4 },
          { ...plan.steps[1], minutes: 26 },
        ],
      },
      evidence,
      30,
    ),
  ).toThrow('分钟');
  expect(() =>
    validateLearningPlan(
      { ...plan, steps: [{ ...plan.steps[0], artifact: '' }, plan.steps[1]] },
      evidence,
      30,
    ),
  ).toThrow('产出');
  expect(() =>
    validateLearningPlan(
      { ...plan, steps: [{ ...plan.steps[0], action: 'x'.repeat(2001) }, plan.steps[1]] },
      evidence,
      30,
    ),
  ).toThrow('行动');
});
it('also rejects unknown inline references in route text even when the citation array is valid', () => {
  expect(() => validateLearningPlan({ ...plan, limitations: '参见 [99]' }, evidence, 30)).toThrow(
    '编号',
  );
  expect(() =>
    validateLearningPlan(
      { ...plan, steps: [{ ...plan.steps[0], action: '参考 [99] 的规则' }, plan.steps[1]] },
      evidence,
      30,
    ),
  ).toThrow('编号');
});
