import type { BackupCounts } from './types';

export const backupLimits = {
  format: 1,
  mainVersion: 13,
  activityVersion: 1,
  files: 10_002,
  databaseBytes: 2 * 1024 ** 3,
  totalBytes: 50 * 1024 ** 3,
  manifestBytes: 3 * 1024 ** 2,
  previewMs: 10 * 60_000,
  workerMs: 30 * 60_000,
} as const;

export const backupCountLabels: { key: keyof BackupCounts; label: string }[] = [
  { key: 'sources', label: '资料' },
  { key: 'notes', label: '笔记' },
  { key: 'conversations', label: '会话（含反馈和路线）' },
  { key: 'turns', label: '问答、路线与练习记录' },
  { key: 'memories', label: '长期记忆' },
  { key: 'projects', label: '学习项目' },
  { key: 'tasks', label: '每日任务' },
  { key: 'focusSessions', label: '专注记录' },
  { key: 'studyDays', label: '日历学习记录' },
  { key: 'reviews', label: '已保存作答与复习安排' },
];

export function backupSize(bytes: number): string {
  if (bytes < 1024 ** 2) return (bytes / 1024).toFixed(1) + ' KiB';
  if (bytes < 1024 ** 3) return (bytes / 1024 ** 2).toFixed(1) + ' MiB';
  return (bytes / 1024 ** 3).toFixed(1) + ' GiB';
}
