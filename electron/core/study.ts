import { performance } from 'node:perf_hooks';
import type { StudyOverview } from '../../src/lib/types';
import { localDayKey } from '../../src/lib/calendar';
import { AppError } from './errors';
import { StudyStorage } from './study-storage';

export function validateMonth(year: unknown, month: unknown): { year: number; month: number } {
  if (
    typeof year !== 'number' ||
    !Number.isInteger(year) ||
    year < 1970 ||
    year > 2100 ||
    typeof month !== 'number' ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12
  ) {
    throw new AppError('validation', '月份不正确，请选择 1970 到 2100 年之间的月份。');
  }
  return { year, month };
}

function splitTime(end: Date, elapsed: number): { day: string; milliseconds: number }[] {
  const parts: { day: string; milliseconds: number }[] = [];
  let start = end.getTime() - elapsed;
  while (start < end.getTime()) {
    const date = new Date(start);
    const midnight = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime();
    const until = Math.min(midnight, end.getTime());
    parts.push({ day: localDayKey(date), milliseconds: until - start });
    start = until;
  }
  return parts;
}

export class StudyTracker {
  private running = false;
  private lastTick = 0;
  private error: unknown;

  constructor(
    private readonly storage: StudyStorage,
    private readonly now = () => new Date(),
    private readonly monotonic = () => performance.now(),
  ) {}

  checkpoint(): void {
    if (!this.running) return;
    const tick = this.monotonic();
    const elapsed = Math.max(0, Math.floor(tick - this.lastTick));
    // A missing heartbeat is an interruption, never hours of presumed study.
    if (elapsed > 30_000) {
      this.running = false;
      return;
    }
    this.storage.addStudyTime(splitTime(this.now(), elapsed));
    this.lastTick += elapsed;
  }

  overview(year: unknown, month: unknown): StudyOverview {
    const selected = validateMonth(year, month);
    if (this.error) throw this.error;
    this.checkpoint();
    return {
      today: this.storage.studyDay(localDayKey(this.now())),
      days: this.storage.studyMonth(selected.year, selected.month),
      running: this.running,
    };
  }

  checkIn(year: unknown, month: unknown): StudyOverview {
    validateMonth(year, month);
    if (this.error) throw this.error;
    this.storage.checkIn(localDayKey(this.now()));
    return this.overview(year, month);
  }

  setRunning(running: unknown, year: unknown, month: unknown): StudyOverview {
    validateMonth(year, month);
    if (typeof running !== 'boolean') throw new AppError('validation', '计时状态不正确。');
    this.error = undefined;
    this.checkpoint();
    if (running !== this.running) {
      this.running = running;
      this.lastTick = this.monotonic();
    }
    return this.overview(year, month);
  }

  pause(): void {
    this.checkpoint();
    this.running = false;
  }

  interrupt(error: unknown): void {
    this.running = false;
    this.error = error;
  }

  close(): void {
    try {
      this.pause();
    } finally {
      this.storage.close();
    }
  }
}
