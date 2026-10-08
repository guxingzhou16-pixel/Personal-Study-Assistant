import type { FocusEndReason, FocusStatus } from './types';

export const focusLimits = {
  defaultMinutes: 25,
  minMinutes: 5,
  maxMinutes: 120,
  review: 1000,
  sessions: 10000,
  recent: 20,
  historyPageSize: 20,
  heartbeatMs: 30000,
} as const;

export const focusStatusLabels: Record<FocusStatus, string> = {
  running: '专注中',
  paused: '已暂停',
  completed: '已计满',
  stopped: '提前结束',
  interrupted: '已中断',
};

export const focusReasonLabels: Record<FocusEndReason, string> = {
  elapsed: '本轮专注已计满，可以休息一下。',
  'user-stop': '本轮由你提前结束，保留实际计时时长。',
  sleep: '系统睡眠，本轮已中断。',
  'heartbeat-gap': '计时心跳中断，本轮停止，不补算缺失时间。',
  'app-exit': '应用退出，本轮已中断。',
  'app-restart': '上次未正常结束，重启后本轮记为中断。',
  'renderer-reload': '学习界面重载或退出，本轮已中断。',
  'storage-error': '保存遇到问题，本轮停止计时；请核对保存记录。',
};

export function focusTime(milliseconds: number, countdown = false): string {
  const seconds = Math.max(
    0,
    countdown ? Math.ceil(milliseconds / 1000) : Math.floor(milliseconds / 1000),
  );
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}
