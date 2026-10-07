import { useEffect, useState } from 'react';
import { ArrowRight, RotateCw } from 'lucide-react';
import { localDayKey } from '../lib/calendar';
import { desktop, errorMessage, isDesktop } from '../lib/desktop';
import type { DailyTask, PlanningOverview } from '../lib/types';
import './HomeStudy.css';

export function TodayTasks({
  refreshVersion,
  paused,
  onOpenDay,
  onOpenTask,
  onFocusTask,
}: {
  refreshVersion: number;
  paused: boolean;
  onOpenDay: (day: string) => void;
  onOpenTask: (task: DailyTask) => void;
  onFocusTask: (task: DailyTask) => void;
}) {
  const [day, setDay] = useState(() => localDayKey(new Date()));
  const [reload, setReload] = useState(0);
  const [overview, setOverview] = useState<PlanningOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const updateDay = () => setDay(localDayKey(new Date()));
    const resume = () => {
      if (document.visibilityState !== 'visible') return;
      updateDay();
      setReload((previous) => previous + 1);
    };
    // Check the local date only; database reads happen on a date change or explicit refresh.
    const timer = window.setInterval(updateDay, 30_000);
    window.addEventListener('focus', resume);
    document.addEventListener('visibilitychange', resume);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', resume);
      document.removeEventListener('visibilitychange', resume);
    };
  }, []);
  useEffect(() => {
    let cancelled = false;
    setOverview(null);
    setError('');
    setLoading(isDesktop && !paused);
    if (isDesktop && !paused)
      void desktop
        .planningOverview(day)
        .then((result) => {
          if (cancelled) return;
          const today = localDayKey(new Date());
          if (day !== today) {
            setDay(today);
            return;
          }
          setOverview(result);
        })
        .catch((reason) => {
          if (cancelled) return;
          const today = localDayKey(new Date());
          if (day !== today) setDay(today);
          else setError(errorMessage(reason));
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    return () => {
      cancelled = true;
    };
  }, [day, reload, refreshVersion, paused]);

  const saved = overview?.day === day && !paused ? overview : null;
  const tasks = saved?.tasks ?? [];
  const completed = tasks.filter((task) => task.status === 'completed').length;
  const blocked = !isDesktop || paused || loading || !saved;
  function refresh() {
    setDay(localDayKey(new Date()));
    setReload((previous) => previous + 1);
  }
  function open(task: DailyTask, focus: boolean) {
    const today = localDayKey(new Date());
    if (day !== today) {
      refresh();
      return;
    }
    if (!blocked) (focus ? onFocusTask : onOpenTask)(task);
  }

  return (
    <section className="today-tasks" aria-labelledby="today-tasks-title">
      <div className="section-heading">
        <div>
          <h2 id="today-tasks-title">今天的小任务</h2>
          <time dateTime={day}>{day}</time>
        </div>
        <div className="home-study-actions">
          <button
            type="button"
            className="text-button"
            disabled={!isDesktop || paused || loading}
            onClick={refresh}
          >
            <RotateCw size={14} />
            刷新今日任务
          </button>
          <button
            type="button"
            className="text-button"
            disabled={!isDesktop || paused}
            onClick={() => onOpenDay(localDayKey(new Date()))}
          >
            查看全部今日任务
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
      {!isDesktop ? (
        <p className="field-hint">请启动桌面版，读取保存在本机的今日任务。</p>
      ) : paused ? (
        <p role="status">备份处理结束后会重新加载今日任务。</p>
      ) : error ? (
        <p className="feedback error" role="alert">
          今日任务无法加载：{error}
        </p>
      ) : !saved || loading ? (
        <p role="status">正在读取今日任务…</p>
      ) : (
        <>
          <p className="field-hint">
            待完成 {tasks.length - completed} 项 · 已手动完成 {completed}{' '}
            项。预计分钟不是实际专注时长。
          </p>
          {tasks.length ? (
            <ul className="today-task-list">
              {tasks.slice(0, 5).map((task) => {
                const project = saved.projects.find((item) => item.id === task.projectId);
                return (
                  <li key={task.id}>
                    <div>
                      <strong>{task.title}</strong>
                      <p>
                        {task.status === 'completed' ? '已手动完成' : '待完成'} · 预计{' '}
                        {task.minutes} 分钟
                        {project
                          ? ` · ${project.title}${project.archived ? '（已归档）' : ''}`
                          : ''}
                      </p>
                    </div>
                    <div className="home-study-actions">
                      <button
                        type="button"
                        className="button secondary"
                        disabled={blocked}
                        aria-label={`查看任务：${task.title}`}
                        onClick={() => open(task, false)}
                      >
                        查看任务
                      </button>
                      {task.status === 'todo' && (
                        <button
                          type="button"
                          className="button secondary"
                          disabled={blocked}
                          aria-label={`准备专注：${task.title}`}
                          onClick={() => open(task, true)}
                        >
                          准备专注
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="today-tasks-empty">
              今天还没有安排任务。可以先在学习计划里写一个小目标，也可以直接读资料或写笔记。
            </p>
          )}
          {tasks.length > 5 && (
            <p className="field-hint">展示前 5 项，待完成优先；其余请查看全部今日任务。</p>
          )}
          <p className="field-hint">准备专注只打开任务选择；开始计时和标记完成仍需你明确操作。</p>
        </>
      )}
    </section>
  );
}
