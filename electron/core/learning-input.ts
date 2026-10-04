import type { LearningRequest } from '../../src/lib/types';
import { learningLimits } from '../../src/lib/learning';
import { AppError } from './errors';
import { record, string } from './settings';
import { sourceId } from './documents';

// The same boundary validates IPC input and persisted request snapshots.
export function readLearningRequest(input: unknown): LearningRequest {
  const value = record(input);
  if (Object.keys(value).some((key) => !['goal', 'query', 'sourceId', 'minutes'].includes(key)))
    throw new AppError('validation', '学习目标包含不支持的字段。');
  const goal = string(value.goal, '学习目标', learningLimits.goal);
  const query = string(value.query, '检索概念或问题', learningLimits.query);
  if (!goal || !query)
    throw new AppError('learningInput', '请填写学习目标和用于查找资料的具体概念。');
  if (
    typeof value.minutes !== 'number' ||
    !Number.isInteger(value.minutes) ||
    value.minutes < learningLimits.minMinutes ||
    value.minutes > learningLimits.maxMinutes
  )
    throw new AppError('learningInput', '本次学习时间须为 10 到 180 分钟的整数。');
  return {
    goal,
    query,
    sourceId: value.sourceId === null ? null : sourceId(value.sourceId),
    minutes: value.minutes,
  };
}
