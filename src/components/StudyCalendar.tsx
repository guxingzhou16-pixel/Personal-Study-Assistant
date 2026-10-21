import { useEffect, useRef, useState } from 'react';
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Leaf,
  LoaderCircle,
  Pause,
  Play,
  Sun,
} from 'lucide-react';
import { adjacentMonth, localDayKey, monthDays } from '../lib/calendar';
import { desktop, errorMessage, isDesktop } from '../lib/desktop';
import type { StudyOverview } from '../lib/types';

function duration(seconds: number): string {
  return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
    .map((part) => String(part).padStart(2, '0'))
    .join(':');
}

export function StudyCalendar({
  dailyGoalMinutes,
  encouragement,
}: {
  dailyGoalMinutes: number;
  encouragement: string;
}) {
  const now = new Date();
  const [selected, setSelected] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 });
  const [overview, setOverview] = useState<StudyOverview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');
  const [monthDirection, setMonthDirection] = useState('forward');
  const requestId = useRef(0);
  const busyRef = useRef(false);

  useEffect(() => {
    if (!isDesktop) return;
    let cancelled = false;
    setOverview(null);
    async function refresh() {
      if (busyRef.current) return;
      const id = ++requestId.current;
      try {
        const data = await desktop.studyOverview(selected.year, selected.month);
        if (!cancelled && id === requestId.current) {
          setOverview(data);
          setError(null);
        }
      } catch (reason) {
        if (!cancelled && id === requestId.current) setError(errorMessage(reason));
      }
    }
    void refresh();
    const interval = setInterval(() => void refresh(), 1000);
    return () => {
      cancelled = true;
      ++requestId.current;
      clearInterval(interval);
    };
  }, [selected.year, selected.month]);

  const today = overview?.today.day ?? localDayKey(now);
  const signed = new Set(overview?.days.filter((day) => day.checkedIn).map((day) => day.day));
  const currentMonth = `${selected.year}-${String(selected.month).padStart(2, '0')}`;
  const showingCurrentMonth = today.startsWith(currentMonth);
  const weeks = monthDays(selected.year, selected.month);

  async function action(kind: 'check-in' | 'timer' | 'retry') {
    if ((!overview && kind !== 'retry') || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    const id = ++requestId.current;
    try {
      const data =
        kind === 'check-in'
          ? await desktop.checkIn(selected.year, selected.month)
          : await desktop.setStudyRunning(
              kind === 'timer' && !overview?.running,
              selected.year,
              selected.month,
            );
      if (id === requestId.current) {
        setOverview(data);
        setFeedback(
          kind === 'check-in'
            ? '签到成功，今天也向前一步。'
            : kind === 'retry'
              ? '学习记录已重新读取。'
              : data.running
                ? '学习计时已开始。'
                : '学习时间已保存。',
        );
      }
    } catch (reason) {
      if (id === requestId.current) setError(errorMessage(reason));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  return (
    <section
      className="daily-section"
      aria-labelledby="study-calendar-heading"
      data-motion="reveal"
      data-motion-delay="80"
    >
      <div className="section-heading">
        <h2 id="study-calendar-heading">学习日历</h2>
        <Leaf size={17} />
      </div>
      <div className="calendar-panel">
        <div className="calendar-toolbar">
          <h3 aria-live="polite">
            <CalendarDays size={17} />
            {selected.year} 年 {selected.month} 月
          </h3>
          <div className="calendar-navigation">
            <button
              type="button"
              className="calendar-today"
              disabled={showingCurrentMonth || busy}
              onClick={() => {
                const [year, month] = today.split('-').map(Number);
                setMonthDirection(currentMonth > today.slice(0, 7) ? 'back' : 'forward');
                setSelected({ year, month });
              }}
            >
              本月
            </button>
            <button
              type="button"
              className="calendar-arrow"
              aria-label="上个月"
              disabled={busy || (selected.year === 1970 && selected.month === 1)}
              onClick={() => {
                setMonthDirection('back');
                setSelected(adjacentMonth(selected.year, selected.month, -1));
              }}
            >
              <ChevronLeft size={17} />
            </button>
            <button
              type="button"
              className="calendar-arrow"
              aria-label="下个月"
              disabled={busy || (selected.year === 2100 && selected.month === 12)}
              onClick={() => {
                setMonthDirection('forward');
                setSelected(adjacentMonth(selected.year, selected.month, 1));
              }}
            >
              <ChevronRight size={17} />
            </button>
          </div>
        </div>
        <table
          className="month-calendar"
          aria-label={`${selected.year}年${selected.month}月学习日历`}
        >
          <thead>
            <tr>
              {['一', '二', '三', '四', '五', '六', '日'].map((weekday, index) => (
                <th key={weekday} scope="col" className={index > 4 ? 'weekend' : undefined}>
                  <span aria-label={`星期${weekday}`}>{weekday}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody
            data-motion="month"
            data-motion-key={currentMonth}
            data-motion-direction={monthDirection}
          >
            {weeks.map((week) => (
              <tr key={week[0].key}>
                {week.map((date) => (
                  <td key={date.key} className={date.inMonth ? undefined : 'outside-month'}>
                    <span
                      className={`calendar-day ${date.key === today ? 'is-today' : ''} ${signed.has(date.key) ? 'is-signed' : ''}`}
                      aria-current={date.key === today ? 'date' : undefined}
                      data-motion={date.key === today ? 'state' : undefined}
                      data-motion-key={date.key === today ? signed.has(date.key) : undefined}
                      aria-label={`${date.key}${date.key === today ? ' 今天' : ''}${signed.has(date.key) ? ' 已签到' : ''}`}
                    >
                      <span>{date.day}</span>
                      {signed.has(date.key) && <span className="check-in-dot" aria-hidden="true" />}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="calendar-legend">
          <span>
            <i className="today-dot" />
            今天
          </span>
          <span>
            <i className="signed-dot" />
            已签到
          </span>
          <span className="month-check-ins">本月已签到 {overview ? signed.size : '—'} 天</span>
        </div>
        <div className="check-in-panel">
          <span className="check-in-copy">
            <span className="daily-label">每日签到</span>
            <span className="daily-hint">给今天留个脚印</span>
          </span>
          <button
            type="button"
            className={`check-in-button ${overview?.today.checkedIn ? 'checked-in' : ''}`}
            data-motion="state"
            data-motion-key={overview?.today.checkedIn}
            disabled={!overview || busy || overview.today.checkedIn}
            onClick={() => void action('check-in')}
          >
            {busy ? <LoaderCircle size={17} className="spin" /> : <Check size={17} />}
            {overview?.today.checkedIn ? '今日已签到' : '今日签到'}
          </button>
        </div>
      </div>
      <div className="study-time-panel" aria-label="今日学习时间">
        <span className="daily-label">
          <Sun size={18} aria-hidden="true" />
          今日学习时间
          {overview?.running && <span className="timer-running" aria-label="计时中" />}
        </span>
        <strong className="study-duration" data-testid="study-duration">
          {overview ? duration(overview.today.studySeconds) : isDesktop ? '— — : — —' : '00:00:00'}
        </strong>
        <span className="daily-hint">给眼前的这一页，一点完整的时间。</span>
        <div className="study-time-controls">
          <button
            type="button"
            className="study-timer-button"
            data-motion="state"
            data-motion-key={overview?.running}
            disabled={!overview || busy}
            onClick={() => void action('timer')}
          >
            {overview?.running ? <Pause size={15} /> : <Play size={15} />}
            {overview?.running ? '暂停计时' : '开始学习'}
          </button>
        </div>
        <span className="daily-hint study-time-goal">
          每日目标 {dailyGoalMinutes} 分钟 · 累计计时
        </span>
      </div>
      {error && (
        <div className="study-error" role="alert" data-motion="fade" data-motion-key={error}>
          {error}
          <button
            className="text-button"
            type="button"
            disabled={busy}
            onClick={() => void action('retry')}
          >
            重试
          </button>
        </div>
      )}
      {!isDesktop && <p className="field-hint">桌面版可保存签到与学习时间。</p>}
      <p className="sr-only" role="status">
        {feedback}
      </p>
      <div className="encouragement">
        <span>给今天的你</span>
        <p>{encouragement}</p>
      </div>
    </section>
  );
}
