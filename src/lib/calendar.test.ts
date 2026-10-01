import { describe, expect, it } from 'vitest';
import { adjacentMonth, localDayKey, monthDays } from './calendar';

describe('monthly calendar', () => {
  it('starts weeks on Monday and includes all dates exactly once', () => {
    const weeks = monthDays(2026, 10);
    expect(weeks).toHaveLength(5);
    expect(weeks.every((week) => week.length === 7)).toBe(true);
    expect(weeks[0][0]).toEqual({ key: '2026-09-28', day: 28, inMonth: false });
    expect(
      weeks
        .flat()
        .filter((date) => date.inMonth)
        .map((date) => date.day),
    ).toEqual(Array.from({ length: 31 }, (_, index) => index + 1));
    expect(weeks.at(-1)?.at(-1)?.key).toBe('2026-11-01');
  });

  it('handles leap years and months requiring six rows', () => {
    expect(
      monthDays(2024, 2)
        .flat()
        .filter((day) => day.inMonth),
    ).toHaveLength(29);
    expect(
      monthDays(2025, 2)
        .flat()
        .filter((day) => day.inMonth),
    ).toHaveLength(28);
    expect(monthDays(2026, 3)).toHaveLength(6);
  });

  it('uses local dates and navigates across year boundaries', () => {
    expect(localDayKey(new Date(2026, 9, 1, 0, 1))).toBe('2026-10-01');
    expect(adjacentMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
    expect(adjacentMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
  });
});
