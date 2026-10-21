import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { StudyStorage } from '../study-storage';
import { StudyTracker } from '../study';

const directories: string[] = [];
const trackers = new Set<StudyTracker>();
function setup(date = new Date(2026, 9, 1, 10)) {
  const directory = mkdtempSync(join(tmpdir(), 'study-calendar-core-'));
  directories.push(directory);
  const path = join(directory, 'activity.sqlite3');
  let wall = date.getTime();
  let tick = 0;
  function open() {
    const tracker = new StudyTracker(
      new StudyStorage(path),
      () => new Date(wall),
      () => tick,
    );
    trackers.add(tracker);
    return tracker;
  }
  return {
    tracker: open(),
    open,
    advance(ms: number, wallMs = ms) {
      tick += ms;
      wall += wallMs;
    },
    close(tracker: StudyTracker) {
      tracker.close();
      trackers.delete(tracker);
    },
  };
}
afterEach(() => {
  for (const tracker of trackers) tracker.close();
  trackers.clear();
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

describe('local check-in and study time', () => {
  it('signs only today, avoids duplicates and preserves records after restart', () => {
    const state = setup();
    expect(state.tracker.overview(2026, 10).today).toEqual({
      day: '2026-10-01',
      checkedIn: false,
      studySeconds: 0,
    });
    state.tracker.checkIn(2026, 9);
    state.tracker.checkIn(2026, 10);
    expect(state.tracker.overview(2026, 9).days).toEqual([]);
    expect(state.tracker.overview(2026, 10).days).toHaveLength(1);
    state.close(state.tracker);
    expect(state.open().overview(2026, 10).today.checkedIn).toBe(true);
  });

  it('counts elapsed time once, excludes paused time and reopens stopped', () => {
    const state = setup();
    const tracker = state.tracker;
    tracker.setRunning(true, 2026, 10);
    state.advance(1400);
    tracker.setRunning(true, 2026, 10);
    state.advance(1600);
    expect(tracker.overview(2026, 10).today.studySeconds).toBe(3);
    tracker.setRunning(false, 2026, 10);
    state.advance(20_000);
    expect(tracker.overview(2026, 10).today.studySeconds).toBe(3);
    tracker.setRunning(true, 2026, 10);
    state.advance(2500);
    state.close(tracker);
    state.advance(60_000);
    const reopened = state.open().overview(2026, 10);
    expect(reopened.running).toBe(false);
    expect(reopened.today.studySeconds).toBe(5);
  });

  it('splits time at local midnight and starts a new daily check-in', () => {
    const state = setup(new Date(2026, 9, 31, 23, 59, 57));
    const tracker = state.tracker;
    tracker.checkIn(2026, 10);
    tracker.setRunning(true, 2026, 10);
    state.advance(6000);
    const overview = tracker.overview(2026, 11);
    expect(overview.today).toEqual({ day: '2026-11-01', checkedIn: false, studySeconds: 3 });
    expect(tracker.overview(2026, 10).days).toEqual([
      { day: '2026-10-31', checkedIn: true, studySeconds: 3 },
    ]);
  });

  it('uses monotonic elapsed time and stops after a missing heartbeat', () => {
    const state = setup();
    const tracker = state.tracker;
    tracker.setRunning(true, 2026, 10);
    state.advance(1000, 3_601_000);
    expect(tracker.overview(2026, 10).today.studySeconds).toBe(1);
    state.advance(60_000);
    expect(tracker.overview(2026, 10)).toMatchObject({
      running: false,
      today: { studySeconds: 1 },
    });
  });

  it('rejects invalid IPC arguments and exposes interrupted storage errors', () => {
    const { tracker } = setup();
    expect(() => tracker.checkIn(2026, 13)).toThrow('月份');
    expect(() => tracker.overview('2026', 10)).toThrow('月份');
    expect(() => tracker.setRunning('true', 2026, 10)).toThrow('计时状态');
    expect(tracker.overview(2026, 10).days).toEqual([]);
    tracker.interrupt(new Error('disk unavailable'));
    expect(() => tracker.overview(2026, 10)).toThrow('disk unavailable');
    expect(tracker.setRunning(false, 2026, 10).running).toBe(false);
  });
});
