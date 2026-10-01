export interface CalendarDay {
  key: string;
  day: number;
  inMonth: boolean;
}

export function localDayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function monthDays(year: number, month: number): CalendarDay[][] {
  const first = new Date(year, month - 1, 1);
  const offset = (first.getDay() + 6) % 7;
  const length = new Date(year, month, 0).getDate();
  const count = Math.ceil((offset + length) / 7) * 7;
  const days = Array.from({ length: count }, (_, index) => {
    const date = new Date(year, month - 1, index - offset + 1);
    return { key: localDayKey(date), day: date.getDate(), inMonth: date.getMonth() === month - 1 };
  });
  return Array.from({ length: count / 7 }, (_, index) => days.slice(index * 7, index * 7 + 7));
}

export function adjacentMonth(year: number, month: number, offset: number) {
  const date = new Date(year, month - 1 + offset, 1);
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}
