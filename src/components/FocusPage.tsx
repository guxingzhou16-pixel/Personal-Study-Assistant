import { useEffect, useRef, useState } from 'react';
import { Check, Pause, Play, Save, Square, Timer } from 'lucide-react';
import { localDayKey } from '../lib/calendar';
import { desktop, errorMessage, isDesktop } from '../lib/desktop';
import { focusLimits, focusReasonLabels, focusStatusLabels, focusTime } from '../lib/focus';
import { validPlanningDay } from '../lib/planning';
import type {
  FocusAction,
  FocusOverview,
  FocusReviewResult,
  FocusSession,
  PlanningOverview,
} from '../lib/types';
import './FocusPage.css';

interface Props {
  visible: boolean;
  presetTask: { id: string; day: string; sequence: number } | null;
  onOpenTask(id: string, day: string): void;
}
interface ReviewEditor {
  record: FocusSession;
  draft: string;
}

export function FocusPage({ visible, presetTask, onOpenTask }: Props) {
  const [overview, setOverview] = useState<FocusOverview | null>(null);
  const [taskDay, setTaskDay] = useState(() => localDayKey(new Date()));
  const [planning, setPlanning] = useState<PlanningOverview | null>(null);
  const [taskId, setTaskId] = useState('');
  const [minutes, setMinutes] = useState<number>(focusLimits.defaultMinutes);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [taskError, setTaskError] = useState('');
  const [readError, setReadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [review, setReview] = useState<ReviewEditor | null>(null);
  const [reviewLookup, setReviewLookup] = useState<FocusSession | null>(null);
  const [pendingReview, setPendingReview] = useState<FocusSession | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const mounted = useRef(false);
  const busyRef = useRef(false);
  const polling = useRef(false);
  const operation = useRef(0);
  const taskVersion = useRef(0);
  const acceptedVersion = useRef(-1);
  const lastActiveId = useRef<string | null>(null);
  const handledTarget = useRef(0);
  const pendingTask = useRef<{ id: string; day: string } | null>(null);
  const current = overview?.current ?? null;
  const tasks =
    planning?.day === taskDay ? planning.tasks.filter((task) => task.status === 'todo') : [];
  const selectedTask = tasks.find((task) => task.id === taskId);
  const selectedProject = planning?.projects.find(
    (project) => project.id === selectedTask?.projectId,
  );
  const validMinutes =
    Number.isInteger(minutes) &&
    minutes >= focusLimits.minMinutes &&
    minutes <= focusLimits.maxMinutes;
  const blocked = !isDesktop || busy;
  const dirtyReview = Boolean(review && review.draft !== review.record.review);
  const recentReview = overview?.recent.find((item) => item.id === review?.record.id);
  const lookupReview = reviewLookup?.id === review?.record.id ? reviewLookup : null;
  const latestReview =
    lookupReview && (!recentReview || lookupReview.revision > recentReview.revision)
      ? lookupReview
      : recentReview;
  const reviewConflict = Boolean(latestReview && latestReview.revision !== review?.record.revision);

  function accept(result: FocusOverview): boolean {
    if (!mounted.current || result.version < acceptedVersion.current) return false;
    acceptedVersion.current = result.version;
    const ended = result.current
      ? undefined
      : result.recent.find((item) => item.id === lastActiveId.current);
    lastActiveId.current = result.current?.id ?? null;
    setOverview(result);
    if (ended)
      setNotice(
        ended.reason ? focusReasonLabels[ended.reason] : '本轮已结束，可以查看实际记录和复盘。',
      );
    setReview((previous) => {
      if (previous && previous.draft !== previous.record.review) return previous;
      const newRecord = ended ?? (!previous ? result.recent[0] : undefined);
      if (newRecord) return { record: newRecord, draft: newRecord.review };
      if (!previous) return null;
      const record = result.recent.find((item) => item.id === previous.record.id);
      return record ? { record, draft: record.review } : previous;
    });
    return true;
  }

  async function pollOverview() {
    if (busyRef.current || polling.current) return;
    polling.current = true;
    const version = operation.current;
    try {
      const result = await desktop.focusOverview();
      if (!mounted.current || version !== operation.current) return;
      if (accept(result)) setReadError('');
    } catch (reason) {
      if (mounted.current && version === operation.current) setReadError(errorMessage(reason));
    } finally {
      polling.current = false;
    }
  }

  useEffect(() => {
    mounted.current = true;
    if (isDesktop) {
      void pollOverview();
      const interval = setInterval(() => void pollOverview(), 1000);
      return () => {
        mounted.current = false;
        operation.current += 1;
        taskVersion.current += 1;
        clearInterval(interval);
      };
    }
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (!visible || !presetTask || presetTask.sequence === handledTarget.current) return;
    handledTarget.current = presetTask.sequence;
    pendingTask.current = { id: presetTask.id, day: presetTask.day };
    taskVersion.current += 1;
    setPlanning(null);
    setTaskId(presetTask.id);
    setTaskDay(presetTask.day);
  }, [visible, presetTask]);
  useEffect(() => {
    if (visible && isDesktop) void loadTasks(taskDay);
  }, [visible, taskDay, presetTask?.sequence]);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (pendingReview && visible && !element.open) element.showModal();
    else if ((!pendingReview || !visible) && element.open) element.close();
  }, [pendingReview, visible]);

  async function loadTasks(day: string) {
    const version = ++taskVersion.current;
    const target = pendingTask.current?.day === day ? pendingTask.current : null;
    setTasksLoading(true);
    try {
      const result = await desktop.planningOverview(day);
      if (!mounted.current || version !== taskVersion.current) return;
      setPlanning(result);
      setTaskError('');
      setTaskId((previous) => {
        const id = target?.id ?? previous;
        return result.tasks.some((task) => task.id === id && task.status === 'todo') ? id : '';
      });
      if (target) {
        pendingTask.current = null;
        if (!result.tasks.some((task) => task.id === target.id && task.status === 'todo'))
          setTaskError('这项任务已完成、改期或删除。请在学习计划核对后，重新选择待完成任务。');
      }
    } catch (reason) {
      if (mounted.current && version === taskVersion.current) setTaskError(errorMessage(reason));
    } finally {
      if (mounted.current && version === taskVersion.current) setTasksLoading(false);
    }
  }

  async function reread() {
    if (busyRef.current || !isDesktop) return;
    busyRef.current = true;
    setBusy(true);
    const version = ++operation.current;
    try {
      const selectedId = review?.record.id;
      const [result, savedReview] = await Promise.all([
        desktop.focusOverview(),
        selectedId ? desktop.getFocusSession(selectedId) : Promise.resolve(null),
      ]);
      if (!mounted.current || version !== operation.current) return;
      if (accept(result)) {
        setReviewLookup(savedReview);
        setUncertain(false);
        setActionError('');
        setReadError('');
        setNotice('已重新读取实际专注记录。请核对当前状态和最近记录后继续。');
      }
    } catch (reason) {
      if (mounted.current && version === operation.current) setReadError(errorMessage(reason));
    } finally {
      if (mounted.current && version === operation.current) {
        busyRef.current = false;
        setBusy(false);
      }
    }
  }

  async function mutate(
    work: () => Promise<FocusOverview | FocusReviewResult>,
    message: string | ((result: FocusOverview) => string),
  ) {
    if (busyRef.current || uncertain || !isDesktop) return;
    busyRef.current = true;
    setBusy(true);
    setActionError('');
    setNotice('');
    const version = ++operation.current;
    try {
      const reply = await work();
      const result = 'overview' in reply ? reply.overview : reply;
      if (!mounted.current || version !== operation.current) return;
      if (!accept(result)) return;
      if ('session' in reply) {
        const saved = reply.session;
        setReviewLookup(saved);
        setReview((previous) =>
          previous?.record.id === saved.id ? { record: saved, draft: saved.review } : previous,
        );
      }
      setNotice(typeof message === 'function' ? message(result) : message);
    } catch (reason) {
      if (!mounted.current || version !== operation.current) return;
      setActionError(
        `${errorMessage(reason)} 请先重新读取专注记录，核对是否已保存，再决定下一步。`,
      );
      setUncertain(true);
    } finally {
      if (mounted.current && version === operation.current) {
        busyRef.current = false;
        setBusy(false);
      }
    }
  }
  function start() {
    if (!selectedTask || !validMinutes || current || tasksLoading || !overview) return;
    void mutate(
      () =>
        desktop.startFocus({
          taskId: selectedTask.id,
          taskRevision: selectedTask.revision,
          minutes,
        }),
      '本轮专注已开始。可以切换到资料阅读，计时仍会继续。',
    );
  }
  function control(action: FocusAction) {
    if (!current) return;
    void mutate(
      () => desktop.controlFocus(current.id, current.revision, action),
      (result) => {
        const actual =
          result.current?.id === current.id
            ? result.current
            : result.recent.find((item) => item.id === current.id);
        if (actual?.reason) return focusReasonLabels[actual.reason];
        return actual ? `本轮${focusStatusLabels[actual.status]}。` : '请核对本轮实际保存状态。';
      },
    );
  }
  function chooseReview(record: FocusSession) {
    if (blocked || review?.record.id === record.id) return;
    if (dirtyReview) setPendingReview(record);
    else setReview({ record, draft: record.review });
  }
  async function checkInToday() {
    if (busyRef.current || !isDesktop) return;
    busyRef.current = true;
    setBusy(true);
    setNotice('');
    const version = ++operation.current;
    const now = new Date();
    try {
      const result = await desktop.checkIn(now.getFullYear(), now.getMonth() + 1);
      if (!mounted.current || version !== operation.current) return;
      setNotice(
        result.today.checkedIn
          ? `今天（${result.today.day}）已签到。`
          : '未确认签到成功，请到首页核对。',
      );
    } catch (reason) {
      if (mounted.current && version === operation.current)
        setActionError(`${errorMessage(reason)} 请到学习首页核对今天的签到记录。`);
    } finally {
      if (mounted.current && version === operation.current) {
        busyRef.current = false;
        setBusy(false);
      }
    }
  }

  return (
    <section className="page focus-page" aria-label="专注时光">
      <div className="page-heading focus-toolbar">
        <div>
          <p className="eyebrow">ONE QUIET SESSION</p>
          <h1>专注时光</h1>
          <p className="muted">选一项任务，把注意力留给眼前的一小步。</p>
        </div>
        <button className="button secondary" disabled={blocked} onClick={() => void reread()}>
          重新读取记录
        </button>
      </div>
      {!isDesktop && <p className="field-hint">请启动桌面版使用本机番茄钟。</p>}
      {(readError || actionError) && (
        <div className="feedback error" role="alert">
          {actionError || readError}
        </div>
      )}
      {notice && (
        <p className="focus-notice" role="status">
          {notice}
        </p>
      )}
      {uncertain && (
        <p className="field-hint">本次操作结果尚未核对，请点击“重新读取记录”后继续。</p>
      )}
      <p className="field-hint">
        专注记录、任务完成、首页累计学习计时和签到分别保存。专注结束不会自动完成任务或签到。
      </p>
      <div className="focus-workspace">
        <div className="focus-main">
          {current ? (
            <section className="focus-card focus-timer" aria-labelledby="focus-current-title">
              <p className="small-label">{focusStatusLabels[current.status]}</p>
              <h2 id="focus-current-title">{current.taskTitle}</h2>
              <p className="muted">
                任务安排于{current.taskDay} · 开始时版本{current.taskRevision}
              </p>
              <div className="focus-countdown" aria-label="本轮剩余时间" aria-live="off">
                {focusTime(current.plannedMinutes * 60_000 - current.elapsedMs, true)}
              </div>
              <p>
                已实际计时 {focusTime(current.elapsedMs)} / 计划{current.plannedMinutes}分钟
              </p>
              <div className="focus-actions">
                <button
                  className="button primary"
                  disabled={blocked || uncertain}
                  onClick={() => control(current.status === 'paused' ? 'resume' : 'pause')}
                >
                  {current.status === 'paused' ? <Play size={16} /> : <Pause size={16} />}
                  {current.status === 'paused' ? '继续专注' : '暂停'}
                </button>
                <button
                  className="button secondary"
                  disabled={blocked || uncertain}
                  onClick={() => control('stop')}
                >
                  <Square size={15} /> 提前结束本轮
                </button>
                <button
                  className="text-button"
                  disabled={blocked}
                  onClick={() => onOpenTask(current.taskId, current.taskDay)}
                >
                  查看任务
                </button>
              </div>
              <p className="field-hint">
                时间来自已保存的计时状态。切页继续计时；睡眠、退出或长时间中断会结束本轮，不补算缺失时间。
              </p>
            </section>
          ) : (
            <section className="focus-card" aria-labelledby="focus-start-title">
              <h2 id="focus-start-title">
                <Timer size={18} /> 准备一轮专注
              </h2>
              <div className="focus-options">
                <label className="focus-field">
                  任务日期
                  <input
                    type="date"
                    min="0001-01-01"
                    max="9999-12-31"
                    value={taskDay}
                    disabled={blocked}
                    onChange={(event) => {
                      const day = event.target.value;
                      if (validPlanningDay(day)) {
                        setTaskId('');
                        setTaskDay(day);
                      }
                    }}
                  />
                </label>
                <button
                  className="text-button"
                  disabled={blocked || tasksLoading}
                  onClick={() => void loadTasks(taskDay)}
                >
                  刷新待完成任务
                </button>
              </div>
              <label className="focus-field">
                关联任务
                <select
                  value={taskId}
                  disabled={blocked || tasksLoading}
                  onChange={(event) => setTaskId(event.target.value)}
                >
                  <option value="">请选择保存的待完成任务</option>
                  {tasks.map((task) => (
                    <option key={task.id} value={task.id}>
                      {task.title}
                    </option>
                  ))}
                </select>
              </label>
              {tasksLoading && (
                <p className="muted" role="status">
                  正在读取实际任务…
                </p>
              )}
              {taskError && (
                <p className="feedback error" role="alert">
                  {taskError}
                </p>
              )}
              {!tasksLoading && planning?.day === taskDay && !tasks.length && (
                <p className="field-hint">这一天暂无待完成任务。请到学习计划创建或重新打开任务。</p>
              )}
              <label className="focus-field">
                本轮专注分钟
                <input
                  type="number"
                  min={focusLimits.minMinutes}
                  max={focusLimits.maxMinutes}
                  step={1}
                  value={minutes}
                  disabled={blocked}
                  onChange={(event) => setMinutes(Number(event.target.value))}
                />
              </label>
              {selectedTask && (
                <div className="focus-preview">
                  <h3>开始前核对</h3>
                  <strong>{selectedTask.title}</strong>
                  <p>{selectedTask.details || '无补充说明'}</p>
                  <p>
                    {selectedTask.day} · 待完成 · 任务版本{selectedTask.revision} · 任务预计
                    {selectedTask.minutes}分钟
                  </p>
                  <p>
                    项目：
                    {selectedProject
                      ? `${selectedProject.title}${selectedProject.archived ? '（已归档的原关联）' : ''}`
                      : selectedTask.projectId
                        ? '关联项目不可用'
                        : '无项目'}
                  </p>
                  <p>本轮计划：{validMinutes ? `${minutes}分钟` : '请填写5～120之间的整数分钟'}</p>
                  <button
                    className="button primary"
                    disabled={blocked || uncertain || tasksLoading || !overview || !validMinutes}
                    onClick={start}
                  >
                    <Play size={16} /> 确认并开始本轮
                  </button>
                </div>
              )}
            </section>
          )}
          {review && (
            <section className="focus-card" aria-labelledby="focus-review-title">
              <h2 id="focus-review-title">本轮复盘</h2>
              <strong>{review.record.taskTitle}</strong>
              <p>
                {focusStatusLabels[review.record.status]} · 实际计时
                {focusTime(review.record.elapsedMs)} · 计划{review.record.plannedMinutes}分钟
              </p>
              {review.record.reason && (
                <p className="focus-end-reason">{focusReasonLabels[review.record.reason]}</p>
              )}
              <p className="muted">
                开始于{new Date(review.record.startedAt).toLocaleString('zh-CN')}
                {review.record.endedAt &&
                  ` · 结束于${new Date(review.record.endedAt).toLocaleString('zh-CN')}`}
              </p>
              <p className="field-hint">
                来源任务安排于{review.record.taskDay} · 开始时任务版本{review.record.taskRevision}
                {' · '}专注记录版本{review.record.revision}
              </p>
              <label className="focus-field">
                一句收获、一个疑问或下一步
                <textarea
                  rows={5}
                  maxLength={focusLimits.review}
                  value={review.draft}
                  disabled={blocked}
                  onChange={(event) =>
                    setReview((previous) =>
                      previous ? { ...previous, draft: event.target.value } : previous,
                    )
                  }
                  placeholder="这段时间做了什么？哪些地方还需要继续？"
                />
              </label>
              <p className="field-hint" role="status">
                {dirtyReview ? '复盘有未保存修改' : '复盘与保存记录一致'} · 最多1000字符
              </p>
              {reviewConflict && latestReview && (
                <div className="focus-review-conflict">
                  <p className="field-hint">
                    保存版本已更新，当前草稿仍保留。请先复制需要保留的文字，再重新载入保存的复盘。
                  </p>
                  <button
                    className="text-button"
                    disabled={blocked}
                    onClick={() => {
                      if (dirtyReview) setPendingReview(latestReview);
                      else setReview({ record: latestReview, draft: latestReview.review });
                    }}
                  >
                    重新载入保存的复盘
                  </button>
                </div>
              )}
              <div className="focus-actions">
                <button
                  className="button primary"
                  disabled={blocked || uncertain || !dirtyReview}
                  onClick={() =>
                    void mutate(
                      () =>
                        desktop.saveFocusReview(
                          review.record.id,
                          review.record.revision,
                          review.draft,
                        ),
                      '复盘已保存到本机。',
                    )
                  }
                >
                  <Save size={15} /> 保存复盘
                </button>
                <button
                  className="button secondary"
                  disabled={blocked}
                  onClick={() => onOpenTask(review.record.taskId, review.record.taskDay)}
                >
                  查看任务／手动完成
                </button>
                <button
                  className="button secondary"
                  disabled={blocked}
                  onClick={() => void checkInToday()}
                >
                  <Check size={15} /> 签到今天
                </button>
              </div>
              <p className="field-hint">
                查看任务后可单独确认完成；签到只记录今天。复盘手动保存，切页保留草稿，关闭或重载可能丢失未保存内容。
              </p>
            </section>
          )}
        </div>
        <aside className="focus-card focus-history" aria-labelledby="focus-history-title">
          <h2 id="focus-history-title">最近结束的专注</h2>
          <p className="field-hint">最多显示最近20轮。选择一轮查看原因和复盘。</p>
          <div className="focus-history-list">
            {overview?.recent.map((session) => (
              <button
                key={session.id}
                className={`focus-history-item${review?.record.id === session.id ? ' selected' : ''}`}
                disabled={blocked}
                aria-pressed={review?.record.id === session.id}
                onClick={() => chooseReview(session)}
              >
                <strong>{session.taskTitle}</strong>
                <span>
                  {focusStatusLabels[session.status]} · {focusTime(session.elapsedMs)}
                </span>
                <small>{new Date(session.startedAt).toLocaleString('zh-CN')}</small>
              </button>
            ))}
          </div>
          {!overview ? (
            <p className="muted" role="status">
              专注记录尚未读取。
            </p>
          ) : (
            !overview.recent.length && <p className="muted">还没有已结束的专注记录。</p>
          )}
        </aside>
      </div>
      <dialog
        ref={dialog}
        className="focus-confirmation"
        aria-labelledby="focus-discard-title"
        onCancel={(event) => {
          if (busy) event.preventDefault();
          else setPendingReview(null);
        }}
      >
        <h2 id="focus-discard-title">放弃未保存的复盘？</h2>
        <p>取消可以继续编辑当前复盘；放弃后查看所选记录。</p>
        <div className="focus-actions">
          <button
            className="button secondary"
            autoFocus
            disabled={blocked}
            onClick={() => setPendingReview(null)}
          >
            继续编辑
          </button>
          <button
            className="button primary"
            disabled={blocked}
            onClick={() => {
              if (pendingReview) setReview({ record: pendingReview, draft: pendingReview.review });
              setPendingReview(null);
            }}
          >
            放弃并查看
          </button>
        </div>
      </dialog>
    </section>
  );
}
