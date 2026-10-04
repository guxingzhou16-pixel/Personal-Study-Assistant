import type { LearningRequest } from './types';

export const learningLimits = { goal: 1000, query: 1000, minMinutes: 10, maxMinutes: 180 };

export function sameLearningRequest(left: LearningRequest, right: LearningRequest): boolean {
  return (
    left.goal.trim() === right.goal.trim() &&
    left.query.trim() === right.query.trim() &&
    left.sourceId === right.sourceId &&
    left.minutes === right.minutes
  );
}
