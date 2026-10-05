import { useEffect, useRef, useState } from 'react';
import { Check, ListTodo, X } from 'lucide-react';
import { localDayKey } from '../lib/calendar';
import { desktop, errorMessage, isDesktop } from '../lib/desktop';
import { planningLimits, validPlanningDay } from '../lib/planning';
import type {
  ChatTurn,
  DailyTask,
  StudyProject,
  TaskProposal,
  TaskProposalEdit,
} from '../lib/types';
import './TaskProposalPanel.css';

export function TaskProposalPanel({
  turn,
  visible,
  onSaved,
  onOpenTask,
  onCleanupError,
}: {
  turn: ChatTurn;
  visible: boolean;
  onSaved: () => void;
  onOpenTask: (task: DailyTask) => void;
  onCleanupError: (message: string) => void;
}) {
  const [day, setDay] = useState(() => localDayKey(new Date()));
  const [projectId, setProjectId] = useState('');
  const [projects, setProjects] = useState<StudyProject[]>([]);
  const [projectsLoaded, setProjectsLoaded] = useState(false);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectError, setProjectError] = useState('');
  const [edit, setEdit] = useState<TaskProposalEdit | null>(null);
  const [proposal, setProposal] = useState<TaskProposal | null>(null);
  const [saved, setSaved] = useState<DailyTask | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const mounted = useRef(true);
  const currentVisible = useRef(visible);
  currentVisible.current = visible;
  const operationVersion = useRef(0);
  const projectLoadVersion = useRef(0);
  const cachedId = useRef<string | null>(null);
  const currentProposal = useRef(proposal);
  currentProposal.current = proposal;
  const currentDay = useRef(day);
  currentDay.current = day;
  const cleanupError = useRef(onCleanupError);
  cleanupError.current = onCleanupError;
  const chosenProject = projects.find((project) => project.id === projectId);
  const destinationValid = validPlanningDay(day) && (!projectId || Boolean(chosenProject));
  const editValid = Boolean(
    edit?.title.trim() &&
    Number.isSafeInteger(edit.minutes) &&
    edit.minutes >= planningLimits.minMinutes &&
    edit.minutes <= planningLimits.maxMinutes,
  );
  const previewCurrent = Boolean(
    proposal &&
    edit &&
    proposal.turnId === turn.id &&
    proposal.turnRevision === turn.revision &&
    proposal.draft.day === day &&
    proposal.draft.projectId === (projectId || null) &&
    proposal.draft.title === edit.title.trim() &&
    proposal.draft.details === edit.details.trim() &&
    proposal.draft.minutes === edit.minutes &&
    JSON.stringify(proposal.project) === JSON.stringify(chosenProject ?? null),
  );

  function releaseCache(id: string) {
    void desktop.discardTaskProposal(id).catch((reason) => {
      cleanupError.current(`任务提议缓存未能清理：${errorMessage(reason)} 这不会自动新增任务。`);
    });
  }

  function invalidatePreview(message: string) {
    operationVersion.current++;
    const id = cachedId.current;
    cachedId.current = null;
    if (id) releaseCache(id);
    setProposal(null);
    setError('');
    setNotice(message);
  }

  function canApply(version: number) {
    return mounted.current && currentVisible.current && version === operationVersion.current;
  }

  async function refreshProjects() {
    const version = ++projectLoadVersion.current;
    setProjectsLoading(true);
    setProjectError('');
    try {
      const result = await desktop.planningOverview(
        validPlanningDay(currentDay.current) ? currentDay.current : localDayKey(new Date()),
      );
      if (!mounted.current || !currentVisible.current || version !== projectLoadVersion.current)
        return;
      const active = result.projects.filter((project) => !project.archived);
      const pending = currentProposal.current;
      if (
        pending &&
        JSON.stringify(pending.project) !==
          JSON.stringify(active.find((project) => project.id === pending.draft.projectId) ?? null)
      )
        invalidatePreview('关联项目已更新或归档。编辑内容已保留，请重新准备最终预览。');
      setProjects(active);
      setProjectsLoaded(true);
    } catch (reason) {
      if (mounted.current && currentVisible.current && version === projectLoadVersion.current)
        setProjectError(errorMessage(reason));
    } finally {
      if (mounted.current && currentVisible.current && version === projectLoadVersion.current)
        setProjectsLoading(false);
    }
  }

  useEffect(() => {
    mounted.current = true;
    operationVersion.current++;
    setDay(localDayKey(new Date()));
    setProjectId('');
    setEdit(null);
    setProposal(null);
    setSaved(null);
    setBusy(false);
    setError('');
    setNotice('');
    setProjectsLoaded(false);
    setProjectsLoading(false);
    if (visible && isDesktop) void refreshProjects();
    return () => {
      mounted.current = false;
      operationVersion.current++;
      projectLoadVersion.current++;
      const id = cachedId.current;
      cachedId.current = null;
      if (id) releaseCache(id);
    };
  }, [visible, turn.id, turn.revision]);

  async function prepare() {
    if (
      !visible ||
      !isDesktop ||
      busy ||
      projectsLoading ||
      !projectsLoaded ||
      !destinationValid ||
      (edit && !editValid)
    )
      return;
    const version = ++operationVersion.current;
    const oldId = cachedId.current;
    cachedId.current = null;
    setBusy(true);
    setError('');
    setNotice('');
    setProposal(null);
    try {
      if (oldId) await desktop.discardTaskProposal(oldId);
      if (!canApply(version)) return;
      const result = await desktop.prepareTaskProposal(turn.id, {
        day,
        projectId: projectId || null,
        ...(edit ? { edit } : {}),
      });
      if (!canApply(version)) {
        releaseCache(result.id);
        return;
      }
      cachedId.current = result.id;
      setProposal(result);
      setEdit({
        title: result.draft.title,
        details: result.draft.details,
        minutes: result.draft.minutes,
      });
      // Keep the main process's current project snapshot alongside its exact draft.
      const project = result.project;
      if (project)
        setProjects((previous) => [...previous.filter((item) => item.id !== project.id), project]);
    } catch (reason) {
      if (canApply(version)) setError(errorMessage(reason));
    } finally {
      if (canApply(version)) setBusy(false);
    }
  }

  async function confirm() {
    if (!visible || busy || projectsLoading || !proposal || !previewCurrent) return;
    const version = ++operationVersion.current;
    const id = proposal.id;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await desktop.confirmTaskProposal(id);
      if (cachedId.current === id) cachedId.current = null;
      // A dispatched confirmation may succeed after navigation; the write still needs refreshing.
      onSaved();
      if (!canApply(version)) return;
      setSaved(result);
      setProposal(null);
      setEdit(null);
    } catch (reason) {
      if (canApply(version))
        setError(`${errorMessage(reason)} 请先到学习计划核对是否已保存，再决定重新预览。`);
    } finally {
      if (canApply(version)) setBusy(false);
    }
  }

  async function discard() {
    if (!visible || busy) return;
    const version = ++operationVersion.current;
    setBusy(true);
    setError('');
    try {
      const id = cachedId.current;
      if (id) await desktop.discardTaskProposal(id);
      if (!canApply(version)) return;
      cachedId.current = null;
      setProposal(null);
      setEdit(null);
      setNotice('已拒绝提议，未新增任务。');
    } catch (reason) {
      if (canApply(version)) setError(errorMessage(reason));
    } finally {
      if (canApply(version)) setBusy(false);
    }
  }

  return (
    <section className="agent-task-proposal" aria-label="学习任务提议">
      <h3>把这条路线安排成一项任务</h3>
      <p className="field-hint">
        根据保存的学习目标和检索词起草一项任务，不自动拆分模型回答。请对照上面的完整路线编辑具体行动。
        全程在本机处理，不额外调用模型；只有明确确认后才新增待完成任务，不改变已有任务、签到或学习时长。
        切换路线或离开页面会放弃未确认的提议。
      </p>
      {error && (
        <p className="feedback error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="field-hint" role="status">
          {notice}
        </p>
      )}
      {!saved && (
        <>
          <div className="agent-task-destination">
            <label className="agent-field">
              安排日期
              <input
                type="date"
                min="0001-01-01"
                max="9999-12-31"
                value={day}
                disabled={busy || projectsLoading}
                onChange={(event) => {
                  setDay(event.target.value);
                  invalidatePreview('安排日期已修改，请重新准备最终预览。');
                }}
              />
            </label>
            <label className="agent-field">
              关联项目
              <select
                value={projectId}
                disabled={busy || projectsLoading || !projectsLoaded}
                onChange={(event) => {
                  setProjectId(event.target.value);
                  invalidatePreview('关联项目已修改，请重新准备最终预览。');
                }}
              >
                <option value="">独立任务（不关联项目）</option>
                {projectId && !chosenProject && (
                  <option value={projectId}>原项目已归档或不可用，请重新选择</option>
                )}
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.title}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button
            type="button"
            className="text-button"
            disabled={!isDesktop || busy || projectsLoading}
            onClick={() => void refreshProjects()}
          >
            刷新可关联项目
          </button>
          {projectError && (
            <p className="feedback error" role="alert">
              {projectError}
            </p>
          )}
          {!projectsLoaded && (
            <p className="field-hint">
              {projectsLoading ? '正在读取项目…' : '项目未加载，请刷新重试。'}
            </p>
          )}
          {!edit && (
            <button
              type="button"
              className="button secondary"
              disabled={
                !isDesktop || busy || projectsLoading || !projectsLoaded || !destinationValid
              }
              onClick={() => void prepare()}
            >
              起草任务提议
            </button>
          )}
          {edit && (
            <>
              <label className="agent-field">
                任务标题
                <input
                  value={edit.title}
                  maxLength={planningLimits.title}
                  disabled={busy || projectsLoading}
                  onChange={(event) => {
                    setEdit({ ...edit, title: event.target.value });
                    invalidatePreview('任务内容已修改，请重新准备最终预览。');
                  }}
                />
              </label>
              <label className="agent-field">
                任务详情
                <textarea
                  value={edit.details}
                  maxLength={planningLimits.details}
                  disabled={busy || projectsLoading}
                  onChange={(event) => {
                    setEdit({ ...edit, details: event.target.value });
                    invalidatePreview('任务内容已修改，请重新准备最终预览。');
                  }}
                />
              </label>
              <label className="agent-field">
                预计分钟（不是实际学习时长）
                <input
                  type="number"
                  min={planningLimits.minMinutes}
                  max={planningLimits.maxMinutes}
                  step={1}
                  inputMode="numeric"
                  value={edit.minutes || ''}
                  disabled={busy || projectsLoading}
                  onChange={(event) => {
                    setEdit({ ...edit, minutes: Number(event.target.value) });
                    invalidatePreview('预计分钟已修改，请重新准备最终预览。');
                  }}
                />
              </label>
              <p className="field-hint">
                预计时间需为 {planningLimits.minMinutes}～{planningLimits.maxMinutes} 分钟的整数。
              </p>
              <div className="agent-actions">
                <button
                  type="button"
                  className="button secondary"
                  disabled={busy || projectsLoading || !destinationValid || !editValid}
                  onClick={() => void prepare()}
                >
                  准备最终预览
                </button>
                <button
                  type="button"
                  className="text-button"
                  disabled={busy}
                  onClick={() => void discard()}
                >
                  <X size={14} /> 拒绝提议
                </button>
              </div>
            </>
          )}
        </>
      )}
      {proposal && previewCurrent && (
        <div className="agent-task-final-preview" role="region" aria-label="任务最终写入预览">
          <h4>待新增的任务（尚未保存）</h4>
          <strong>{proposal.draft.title}</strong>
          <p>{proposal.draft.details || '未填写详情。'}</p>
          <dl>
            <dt>安排日期</dt>
            <dd>{proposal.draft.day}</dd>
            <dt>预计时间</dt>
            <dd>{proposal.draft.minutes} 分钟（计划值）</dd>
            <dt>初始状态</dt>
            <dd>待完成</dd>
            <dt>关联项目</dt>
            <dd>{proposal.project?.title ?? '独立任务'}</dd>
            {proposal.project && (
              <>
                <dt>项目目标</dt>
                <dd>{proposal.project.goal || '未填写目标。'}</dd>
                <dt>项目版本</dt>
                <dd>第 {proposal.project.revision} 版</dd>
              </>
            )}
            <dt>来源路线版本</dt>
            <dd>
              第 {proposal.turnRevision} 版 · {proposal.turnId}
            </dd>
          </dl>
          <p className="field-hint">
            预览有效至 {new Date(proposal.expiresAt).toLocaleTimeString('zh-CN')}
            。确认只新增这一项任务。
          </p>
          <button
            type="button"
            className="button primary"
            disabled={busy || projectsLoading || !visible}
            onClick={() => void confirm()}
          >
            <Check size={15} /> 确认新增这项待完成任务
          </button>
        </div>
      )}
      {saved && (
        <div className="agent-task-written" role="status">
          <h4>实际已保存</h4>
          <strong>{saved.title}</strong>
          <p>{saved.details || '未填写详情。'}</p>
          <dl>
            <dt>安排日期</dt>
            <dd>{saved.day}</dd>
            <dt>预计时间</dt>
            <dd>{saved.minutes} 分钟（计划值）</dd>
            <dt>当前状态</dt>
            <dd>{saved.status === 'todo' ? '待完成' : '已完成'}</dd>
            <dt>关联项目</dt>
            <dd>
              {saved.projectId
                ? (projects.find((project) => project.id === saved.projectId)?.title ??
                  saved.projectId)
                : '独立任务'}
            </dd>
            <dt>来源</dt>
            <dd>{saved.origin === 'learning-route' ? '学习路线提议' : '手动创建'}</dd>
            <dt>来源路线</dt>
            <dd>
              {saved.originTurnId} · 第 {saved.originTurnRevision} 版
            </dd>
            <dt>任务版本</dt>
            <dd>第 {saved.revision} 版</dd>
            <dt>保存时间</dt>
            <dd>{new Date(saved.createdAt).toLocaleString('zh-CN')}</dd>
          </dl>
          <p className="field-hint">任务尚需你执行；保存不会开始计时或记录掌握。</p>
          <button type="button" className="button secondary" onClick={() => onOpenTask(saved)}>
            <ListTodo size={15} /> 查看这项任务
          </button>
        </div>
      )}
      {busy && (
        <p className="field-hint" role="status">
          正在处理任务提议…
        </p>
      )}
    </section>
  );
}
