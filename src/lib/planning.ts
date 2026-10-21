import type { ProjectDraft, TaskDraft } from './types';

export const planningLimits = {
  title: 120,
  goal: 2000,
  details: 8000,
  projects: 200,
  tasks: 5000,
  minMinutes: 5,
  maxMinutes: 480,
};

export function validPlanningDay(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const length = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  return day <= length;
}

export function emptyProjectDraft(): ProjectDraft {
  return { title: '', goal: '', archived: false };
}

export function emptyTaskDraft(day: string, projectId: string | null = null): TaskDraft {
  return { title: '', details: '', projectId, day, minutes: 25 };
}
