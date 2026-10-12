import { useEffect, useRef, useState } from 'react';
import { desktop, errorMessage, isDesktop } from '../lib/desktop';
import { localDayKey } from '../lib/calendar';
import { learningPlanLimits, validateLearningPlan } from '../lib/learning-plan';
import { validPlanningDay } from '../lib/planning';
import type {
  ChatTurn,
  DailyTask,
  LearningPlan,
  LearningStep,
  StudyProject,
  TaskBatchProposal,
} from '../lib/types';
import './LearningPlanPanel.css';

export function LearningPlanPanel({
  turn,
  initialPlan,
  visible,
  onSaved,
  onOpenTask,
  onCitation,
  onDirtyChange,
  onCleanupError,
}: {
  turn: ChatTurn;
  initialPlan: LearningPlan;
  visible: boolean;
  onSaved(): void;
  onOpenTask(task: DailyTask): void;
  onCitation(number: number): void;
  onDirtyChange(dirty: boolean): void;
  onCleanupError(message: string): void;
}) {
  const [plan, setPlan] = useState(() => structuredClone(initialPlan));
  const [approved, setApproved] = useState(false);
  const [indices, setIndices] = useState<number[]>([]);
  const [day, setDay] = useState(() => localDayKey(new Date()));
  const [projectId, setProjectId] = useState('');
  const [projects, setProjects] = useState<StudyProject[]>([]);
  const [projectsLoaded, setProjectsLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [proposal, setProposal] = useState<TaskBatchProposal | null>(null);
  const [saved, setSaved] = useState<DailyTask[]>([]);
  const [uncertain, setUncertain] = useState(false);
  const live = useRef(false);
  const currentVisible = useRef(visible);
  currentVisible.current = visible;
  const operation = useRef(0);
  const cachedId = useRef<string | null>(null);
  const confirming = useRef(false);
  const cleanupError = useRef(onCleanupError);
  cleanupError.current = onCleanupError;
  const budget = turn.learningRequest!.minutes;
  const total = plan.steps.reduce((sum, step) => sum + step.minutes, 0);
  const dirty = JSON.stringify(plan) !== JSON.stringify(initialPlan);
  let validationError = '';
  try {
    validateLearningPlan(plan, turn.evidence, budget);
  } catch (reason) {
    validationError = reason instanceof Error ? reason.message : '路线结构无效。';
  }
  const destinationValid =
    validPlanningDay(day) &&
    (!projectId || projects.some((project) => project.id === projectId && !project.archived));
  const blocked = busy || !isDesktop || !visible;

  function release(id: string) {
    void desktop
      .discardTaskProposal(id)
      .catch((reason) =>
        cleanupError.current(`路线任务预览清理失败：${errorMessage(reason)} 不会自动写入。`),
      );
  }
  function invalidate() {
    operation.current++;
    if (cachedId.current) release(cachedId.current);
    cachedId.current = null;
    setProposal(null);
    setError('');
    setNotice('');
    setUncertain(false);
  }
  function changePlan(next: LearningPlan) {
    invalidate();
    setApproved(false);
    setPlan(next);
  }
  function changeStep(
    index: number,
    field: keyof LearningStep,
    value: LearningStep[keyof LearningStep],
  ) {
    changePlan({
      ...plan,
      steps: plan.steps.map((step, position) =>
        position === index ? { ...step, [field]: value } : step,
      ),
    });
  }
  function canApply(version: number) {
    return live.current && currentVisible.current && version === operation.current;
  }
  async function loadProjects() {
    if (cachedId.current) release(cachedId.current);
    cachedId.current = null;
    setProposal(null);
    const version = ++operation.current;
    setBusy(true);
    setProjectsLoaded(false);
    setError('');
    try {
      const overview = await desktop.planningOverview(
        validPlanningDay(day) ? day : localDayKey(new Date()),
      );
      if (!canApply(version)) return;
      setProjects(overview.projects.filter((project) => !project.archived));
      setProjectsLoaded(true);
    } catch (reason) {
      if (canApply(version)) setError(errorMessage(reason));
    } finally {
      if (canApply(version)) setBusy(false);
    }
  }
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
      operation.current++;
      if (cachedId.current) release(cachedId.current);
      cachedId.current = null;
      onDirtyChange(false);
    };
  }, []);
  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => {
    invalidate();
    setBusy(confirming.current);
    if (visible && isDesktop && !confirming.current) void loadProjects();
  }, [visible, turn.revision]);

  async function prepare() {
    if (
      blocked ||
      !approved ||
      validationError ||
      !indices.length ||
      !projectsLoaded ||
      !destinationValid
    )
      return;
    const version = ++operation.current;
    const old = cachedId.current;
    cachedId.current = null;
    setProposal(null);
    setBusy(true);
    setError('');
    setNotice('');
    setUncertain(false);
    try {
      if (old) await desktop.discardTaskProposal(old);
      if (!canApply(version)) return;
      const result = await desktop.prepareTaskBatch(turn.id, {
        plan,
        indices,
        day,
        projectId: projectId || null,
      });
      if (!canApply(version)) {
        release(result.id);
        return;
      }
      if (result.turnRevision !== turn.revision) {
        release(result.id);
        throw new Error('来源版本已变化，请刷新路线记录再预览。编辑仍保留。');
      }
      cachedId.current = result.id;
      setProposal(result);
      if (result.project)
        setProjects((previous) => [
          ...previous.filter((project) => project.id !== result.project!.id),
          result.project!,
        ]);
    } catch (reason) {
      if (canApply(version)) setError(errorMessage(reason));
    } finally {
      if (canApply(version)) setBusy(false);
    }
  }
  async function confirm() {
    if (blocked || !proposal || uncertain || proposal.id !== cachedId.current) return;
    const version = ++operation.current;
    const id = proposal.id;
    cachedId.current = null;
    confirming.current = true;
    setBusy(true);
    setError('');
    try {
      const records = await desktop.confirmTaskBatch(id);
      if (cachedId.current === id) cachedId.current = null;
      onSaved();
      if (!live.current) return;
      setSaved(records);
      setProposal(null);
      setNotice(`实际新增${records.length}项待完成任务。未修改完成状态、计时或记忆。`);
    } catch (reason) {
      if (live.current && !canApply(version))
        cleanupError.current(
          `多步骤任务确认未能核对：${errorMessage(reason)} 请先到学习计划核对实际保存记录，不自动重发确认。`,
        );
      if (canApply(version)) {
        cachedId.current = id;
        setUncertain(true);
        setError(
          `${errorMessage(reason)} 请先到学习计划核对实际记录，再决定取消并重新预览。不会自动重发确认。`,
        );
      }
    } finally {
      confirming.current = false;
      if (live.current) setBusy(false);
    }
  }
  async function cancel() {
    if (blocked || !proposal) return;
    const version = ++operation.current;
    setBusy(true);
    try {
      await desktop.discardTaskProposal(proposal.id);
      if (!canApply(version)) return;
      cachedId.current = null;
      setProposal(null);
      setUncertain(false);
      setNotice(
        uncertain
          ? '预览已取消；之前发出的确认须到学习计划核对，取消不撤回已保存记录。'
          : '预览已取消，未新增任务。路线编辑仍保留。',
      );
    } catch (reason) {
      if (canApply(version)) setError(errorMessage(reason));
    } finally {
      if (canApply(version)) setBusy(false);
    }
  }

  return (
    <section className="learning-plan" aria-label="结构化学习路线">
      <h3>编辑并核对路线建议</h3>
      <p className="field-hint">
        原始模型输出保留在历史中。这里的编辑只在本次窗口保留，切换路线或重启可能丢失；确认任务后，所选内容保存到任务。结构与编号校验不证明结论正确，请核对原文。
      </p>
      <p className="field-hint">
        离开页面会取消未确认预览；已发出的确认仍可能完成，取消不撤回已保存记录。应答失败时先到学习计划核对，不自动重发。
      </p>
      <p className="learning-budget" role="status">
        步骤合计 {total} 分钟 / 本次预算 {budget} 分钟
      </p>
      {plan.steps.map((step, index) => (
        <fieldset className="learning-step" key={index} disabled={blocked || Boolean(saved.length)}>
          <legend>步骤 {index + 1}</legend>
          <label className="agent-field">
            步骤标题
            <input
              aria-label={`步骤 ${index + 1} 标题`}
              maxLength={learningPlanLimits.title}
              value={step.title}
              onChange={(event) => changeStep(index, 'title', event.target.value)}
            />
          </label>
          <label className="agent-field">
            具体行动
            <textarea
              aria-label={`步骤 ${index + 1} 行动`}
              rows={3}
              maxLength={learningPlanLimits.action}
              value={step.action}
              onChange={(event) => changeStep(index, 'action', event.target.value)}
            />
          </label>
          <div className="learning-step-options">
            <label className="agent-field">
              预计分钟
              <input
                aria-label={`步骤 ${index + 1} 预计分钟`}
                type="number"
                min={5}
                max={180}
                step={1}
                value={step.minutes}
                onChange={(event) => changeStep(index, 'minutes', Number(event.target.value))}
              />
            </label>
            <label className="agent-field">
              预期作品
              <textarea
                aria-label={`步骤 ${index + 1} 预期作品`}
                rows={2}
                maxLength={learningPlanLimits.artifact}
                value={step.artifact}
                onChange={(event) => changeStep(index, 'artifact', event.target.value)}
              />
            </label>
          </div>
          <p className="field-hint">关联的实际资料：</p>
          <div className="learning-step-sources">
            {turn.evidence.map((hit) => (
              <span key={hit.number}>
                <label>
                  <input
                    type="checkbox"
                    aria-label={`步骤 ${index + 1} 关联资料 ${hit.number}`}
                    checked={step.citations.includes(hit.number)}
                    onChange={(event) =>
                      changeStep(
                        index,
                        'citations',
                        event.target.checked
                          ? [...step.citations, hit.number]
                          : step.citations.filter((number) => number !== hit.number),
                      )
                    }
                  />
                  [{hit.number}] {hit.sourceName}
                </label>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => onCitation(hit.number)}
                >
                  核对原文 [{hit.number}]
                </button>
              </span>
            ))}
          </div>
          <label className="learning-check">
            <input
              type="checkbox"
              aria-label={`选择步骤 ${index + 1} 生成任务`}
              checked={indices.includes(index)}
              onChange={(event) => {
                invalidate();
                setIndices((previous) =>
                  event.target.checked
                    ? [...previous, index].sort((a, b) => a - b)
                    : previous.filter((value) => value !== index),
                );
              }}
            />
            将这个步骤加入待确认任务
          </label>
        </fieldset>
      ))}
      <label className="agent-field">
        待求证范围／缺少的依据
        <textarea
          aria-label="路线待求证范围"
          rows={3}
          maxLength={learningPlanLimits.limitations}
          disabled={blocked || Boolean(saved.length)}
          value={plan.limitations}
          onChange={(event) => changePlan({ ...plan, limitations: event.target.value })}
        />
      </label>
      {validationError && (
        <p className="feedback error" role="alert">
          {validationError}
        </p>
      )}
      {error && (
        <p className="feedback error" role="alert">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {!saved.length && (
        <>
          <button
            className="button secondary"
            disabled={blocked || Boolean(validationError)}
            onClick={() => {
              setApproved(true);
              setNotice('路线结构与预算已核对；这是执行建议的确认，尚未创建任务。');
            }}
          >
            核对并确认路线建议
          </button>
          <div className="learning-step-options">
            <label className="agent-field">
              任务安排日期
              <input
                aria-label="多步骤任务日期"
                type="date"
                min="0001-01-01"
                max="9999-12-31"
                value={day}
                disabled={blocked}
                onChange={(event) => {
                  invalidate();
                  setDay(event.target.value);
                }}
              />
            </label>
            <label className="agent-field">
              关联项目
              <select
                aria-label="多步骤任务关联项目"
                value={projectId}
                disabled={blocked || !projectsLoaded}
                onChange={(event) => {
                  invalidate();
                  setProjectId(event.target.value);
                }}
              >
                <option value="">无项目</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.title}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button className="text-button" disabled={blocked} onClick={() => void loadProjects()}>
            重新读取项目
          </button>
          <p className="field-hint">
            已勾选 {indices.length} 步、
            {indices.reduce((sum, index) => sum + plan.steps[index].minutes, 0)}{' '}
            分钟；未选步骤仍保留在路线里。每项任务均为待完成，动作文本只保存为说明，不执行命令。
          </p>
          <button
            className="button secondary"
            disabled={
              blocked ||
              !approved ||
              Boolean(validationError) ||
              !indices.length ||
              !projectsLoaded ||
              !destinationValid ||
              uncertain
            }
            onClick={() => void prepare()}
          >
            预览所选步骤任务
          </button>
          {proposal && (
            <section className="learning-batch-preview" aria-label="多步骤任务最终预览">
              <h4>确认前核对完整写入内容</h4>
              <p>
                日期 {proposal.tasks[0].day} · 项目 {proposal.project?.title ?? '无项目'} ·
                来源路线版本 {proposal.turnRevision} · 全路线预算 {proposal.budgetMinutes} 分钟
              </p>
              {proposal.tasks.map((task, index) => (
                <div key={index}>
                  <strong>
                    {task.title} · {task.minutes}分钟 · 待完成
                  </strong>
                  <p>{task.details}</p>
                </div>
              ))}
              <div className="agent-actions">
                <button
                  className="button primary"
                  disabled={blocked || uncertain}
                  onClick={() => void confirm()}
                >
                  确认新增这 {proposal.tasks.length} 项待完成任务
                </button>
                <button
                  className="button secondary"
                  disabled={blocked}
                  onClick={() => void cancel()}
                >
                  取消多步骤预览
                </button>
              </div>
            </section>
          )}
        </>
      )}
      {saved.length > 0 && (
        <section aria-label="多步骤实际保存记录">
          <h4>实际已保存 {saved.length} 项</h4>
          {saved.map((task) => (
            <div key={task.id}>
              <strong>
                {task.title} · {task.minutes}分钟 · 待完成
              </strong>
              <p className="field-hint">
                {task.day} · 保存版本 {task.revision} · {task.id}
              </p>
              <button className="text-button" onClick={() => onOpenTask(task)}>
                查看实际任务
              </button>
            </div>
          ))}
        </section>
      )}
    </section>
  );
}
