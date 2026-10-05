import { useEffect, useRef, useState } from 'react';
import { CalendarDays, FolderOpen, Plus } from 'lucide-react';
import { localDayKey } from '../lib/calendar';
import { desktop, errorMessage, isDesktop } from '../lib/desktop';
import {
  emptyProjectDraft,
  emptyTaskDraft,
  planningLimits,
  validPlanningDay,
} from '../lib/planning';
import type {
  DailyTask,
  PlanningOverview,
  ProjectDraft,
  StudyProject,
  TaskDraft,
} from '../lib/types';
import { PlanningEditor, type PlanningEditorState } from './PlanningEditor';
import './PlanningPage.css';

type Action =
  | { kind: 'new-project' | 'new-task' | 'refresh' | 'close' | 'delete' }
  | { kind: 'project' | 'task'; id: string }
  | { kind: 'day'; day: string }
  | { kind: 'open-task'; id: string; day: string };

function projectDraft(project: ProjectDraft): ProjectDraft {
  return { title: project.title, goal: project.goal, archived: project.archived };
}
function taskDraft(task: TaskDraft): TaskDraft {
  return {
    title: task.title,
    details: task.details,
    projectId: task.projectId,
    day: task.day,
    minutes: task.minutes,
  };
}
function sortProjects(items: StudyProject[]): StudyProject[] {
  return items.sort(
    (a, b) =>
      Number(a.archived) - Number(b.archived) ||
      b.updatedAt.localeCompare(a.updatedAt) ||
      a.id.localeCompare(b.id),
  );
}
function sortTasks(items: DailyTask[]): DailyTask[] {
  return items.sort(
    (a, b) =>
      Number(a.status === 'completed') - Number(b.status === 'completed') ||
      a.createdAt.localeCompare(b.createdAt) ||
      a.id.localeCompare(b.id),
  );
}

export function PlanningPage({
  visible,
  refreshVersion,
  presetTask,
  onOpenLearningRoute,
}: {
  visible: boolean;
  refreshVersion: number;
  presetTask: { id: string; day: string; sequence: number } | null;
  onOpenLearningRoute: (id: string) => void;
}) {
  const [day, setDay] = useState(() => localDayKey(new Date()));
  const [overview, setOverview] = useState<PlanningOverview | null>(null);
  const [editor, setEditor] = useState<PlanningEditorState | null>(null);
  const [filter, setFilter] = useState('all');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pending, setPending] = useState<Action | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const titleInput = useRef<HTMLInputElement>(null);
  const mounted = useRef(false);
  const loadVersion = useRef(0);
  const refreshStamp = useRef<string | null>(null);
  const handledTaskTarget = useRef(0);
  const dirty = Boolean(editor && JSON.stringify(editor.draft) !== JSON.stringify(editor.original));
  const projects = overview?.projects ?? [];
  const tasks = overview?.day === day ? overview.tasks : [];
  const loaded = overview?.day === day;
  const blocked = !isDesktop || busy || loading;
  const selectedTasks = tasks.filter((task) =>
    filter === 'all'
      ? true
      : filter === 'none'
        ? task.projectId === null
        : task.projectId === filter,
  );
  const completed = selectedTasks.filter((task) => task.status === 'completed').length;
  const projectName = (id: string | null) =>
    id ? (projects.find((project) => project.id === id)?.title ?? '关联项目不可用') : '无项目';
  const latest = editor?.record
    ? editor.kind === 'project'
      ? projects.find((project) => project.id === editor.record?.id)
      : tasks.find((task) => task.id === editor.record?.id)
    : null;
  const changedElsewhere = Boolean(
    editor?.record &&
    loaded &&
    !(editor.kind === 'task' && editor.record.day !== day) &&
    (!latest || latest.revision !== editor.record.revision),
  );

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      loadVersion.current += 1;
    };
  }, []);
  useEffect(() => {
    if (!visible) {
      refreshStamp.current = null;
      return;
    }
    if (!isDesktop || busy || loading) return;
    const stamp = `${day}|${refreshVersion}`;
    if (refreshStamp.current === stamp) return;
    refreshStamp.current = stamp;
    void refresh(false);
  }, [visible, day, refreshVersion, busy, loading]);
  useEffect(() => {
    if (!visible || !presetTask || blocked || handledTaskTarget.current === presetTask.sequence)
      return;
    handledTaskTarget.current = presetTask.sequence;
    request({ kind: 'open-task', id: presetTask.id, day: presetTask.day });
  }, [visible, presetTask, busy, loading]);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (pending && visible && !element.open) element.showModal();
    else if ((!pending || !visible) && element.open) element.close();
  }, [pending, visible]);
  useEffect(() => {
    if (visible && editor) titleInput.current?.focus();
  }, [editor?.kind, editor?.record?.id]);

  async function refresh(reloadEditor: boolean) {
    const version = ++loadVersion.current;
    setLoading(true);
    try {
      const result = await desktop.planningOverview(day);
      if (!mounted.current || version !== loadVersion.current) return;
      setOverview(result);
      setError('');
      if (reloadEditor && editor) {
        if (editor.kind === 'project') {
          const record = result.projects.find((project) => project.id === editor.record?.id);
          const draft = record ? projectDraft(record) : emptyProjectDraft();
          setEditor(record ? { kind: 'project', record, draft, original: draft } : null);
        } else {
          const record = result.tasks.find((task) => task.id === editor.record?.id);
          const draft = record ? taskDraft(record) : emptyTaskDraft(day);
          setEditor(record ? { kind: 'task', record, draft, original: draft } : null);
        }
        setNotice('已刷新保存版本，未保存的修改已放弃。');
      }
    } catch (reason) {
      if (mounted.current && version === loadVersion.current) setError(errorMessage(reason));
    } finally {
      if (mounted.current && version === loadVersion.current) setLoading(false);
    }
  }

  function request(action: Action) {
    if (blocked) return;
    if (dirty || action.kind === 'delete') setPending(action);
    else void perform(action);
  }
  async function perform(action: Action) {
    setError('');
    setNotice('');
    if (action.kind === 'refresh') return refresh(true);
    if (action.kind === 'open-task') {
      const version = ++loadVersion.current;
      setLoading(true);
      try {
        const result = await desktop.planningOverview(action.day);
        if (!mounted.current || version !== loadVersion.current) return;
        const record = result.tasks.find((task) => task.id === action.id);
        if (!record) {
          setError('任务已改期或删除，请按安排日期查找最新任务。原编辑内容仍保留。');
          return;
        }
        const draft = taskDraft(record);
        refreshStamp.current = `${result.day}|${refreshVersion}`;
        setOverview(result);
        setDay(result.day);
        setFilter('all');
        setEditor({ kind: 'task', record, draft, original: draft });
        setNotice('已打开任务的最新保存版本。');
      } catch (reason) {
        if (mounted.current && version === loadVersion.current) setError(errorMessage(reason));
      } finally {
        if (mounted.current && version === loadVersion.current) setLoading(false);
      }
    } else if (action.kind === 'day') {
      loadVersion.current += 1;
      setEditor(null);
      setDay(action.day);
    } else if (action.kind === 'close') setEditor(null);
    else if (action.kind === 'new-project' || action.kind === 'project') {
      const record =
        action.kind === 'project'
          ? (projects.find((project) => project.id === action.id) ?? null)
          : null;
      const draft = record ? projectDraft(record) : emptyProjectDraft();
      setEditor({ kind: 'project', record, draft, original: draft });
    } else if (action.kind === 'new-task' || action.kind === 'task') {
      const record =
        action.kind === 'task' ? (tasks.find((task) => task.id === action.id) ?? null) : null;
      const selectedProject = projects.find(
        (project) => project.id === filter && !project.archived,
      );
      const draft = record ? taskDraft(record) : emptyTaskDraft(day, selectedProject?.id ?? null);
      setEditor({ kind: 'task', record, draft, original: draft });
    } else if (editor?.kind === 'task' && editor.record) {
      const record = editor.record;
      setBusy(true);
      loadVersion.current += 1;
      try {
        await desktop.deleteDailyTask(record.id, record.revision);
        if (!mounted.current) return;
        setOverview(
          (previous) =>
            previous && {
              ...previous,
              tasks: previous.tasks.filter((task) => task.id !== record.id),
            },
        );
        setEditor(null);
        setNotice('任务已删除。签到和累计学习时长未发生变化。');
      } catch (reason) {
        if (mounted.current) setError(errorMessage(reason));
      } finally {
        if (mounted.current) setBusy(false);
      }
    }
  }

  function changeProject<K extends keyof ProjectDraft>(key: K, value: ProjectDraft[K]) {
    setEditor((previous) =>
      previous?.kind === 'project'
        ? { ...previous, draft: { ...previous.draft, [key]: value } }
        : previous,
    );
    setNotice('');
  }
  function changeTask<K extends keyof TaskDraft>(key: K, value: TaskDraft[K]) {
    setEditor((previous) =>
      previous?.kind === 'task'
        ? { ...previous, draft: { ...previous.draft, [key]: value } }
        : previous,
    );
    setNotice('');
  }
  function updateTask(saved: DailyTask) {
    setOverview(
      (previous) =>
        previous && {
          ...previous,
          tasks: sortTasks([
            ...previous.tasks.filter((task) => task.id !== saved.id),
            ...(saved.day === previous.day ? [saved] : []),
          ]),
        },
    );
  }
  async function save(asNew = false) {
    if (!editor || blocked) return;
    if (!editor.draft.title.trim()) {
      setError('请填写标题。');
      titleInput.current?.focus();
      return;
    }
    if (editor.kind === 'task') {
      const { draft, record } = editor;
      if (
        !validPlanningDay(draft.day) ||
        !Number.isInteger(draft.minutes) ||
        draft.minutes < planningLimits.minMinutes ||
        draft.minutes > planningLimits.maxMinutes
      ) {
        setError('请填写有效日期，以及5～480之间的整数预计分钟。');
        return;
      }
      const project = projects.find((item) => item.id === draft.projectId);
      if (
        draft.projectId &&
        (!project || (project.archived && (asNew || record?.projectId !== project.id)))
      ) {
        setError('新任务或新的关联不能使用归档项目。请选择使用中的项目或无项目。');
        return;
      }
    }
    setBusy(true);
    setError('');
    setNotice('');
    loadVersion.current += 1;
    try {
      if (editor.kind === 'project') {
        const saved = await desktop.saveStudyProject({
          ...editor.draft,
          id: editor.record?.id ?? null,
          revision: editor.record?.revision ?? 0,
        });
        if (!mounted.current) return;
        const draft = projectDraft(saved);
        setEditor({ kind: 'project', record: saved, draft, original: draft });
        setOverview(
          (previous) =>
            previous && {
              ...previous,
              projects: sortProjects([
                saved,
                ...previous.projects.filter((item) => item.id !== saved.id),
              ]),
            },
        );
        setNotice(saved.archived ? '项目已保存并归档；原有任务仍保留。' : '项目已保存到本机。');
      } else {
        const saved = await desktop.saveDailyTask({
          ...editor.draft,
          id: asNew ? null : (editor.record?.id ?? null),
          revision: asNew ? 0 : (editor.record?.revision ?? 0),
        });
        if (!mounted.current) return;
        updateTask(saved);
        const draft = taskDraft(saved);
        setEditor({ kind: 'task', record: saved, draft, original: draft });
        if (saved.day !== day) setDay(saved.day);
        setNotice(
          saved.day === day ? '任务已保存到本机。' : `任务已保存，并切换到${saved.day}查看。`,
        );
      }
    } catch (reason) {
      if (mounted.current) setError(errorMessage(reason));
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  async function setCompleted() {
    if (editor?.kind !== 'task' || !editor.record || blocked) return;
    const record = editor.record;
    setBusy(true);
    setError('');
    setNotice('');
    loadVersion.current += 1;
    try {
      const saved = await desktop.setDailyTaskCompleted(
        record.id,
        record.revision,
        record.status !== 'completed',
      );
      if (!mounted.current) return;
      updateTask(saved);
      setEditor((previous) =>
        previous?.kind === 'task' && previous.record?.id === saved.id
          ? { ...previous, record: saved }
          : previous,
      );
      setNotice(
        saved.status === 'completed' ? '已手动标记完成；不表示知识已掌握。' : '任务已重新打开。',
      );
    } catch (reason) {
      if (mounted.current) setError(errorMessage(reason));
    } finally {
      if (mounted.current) setBusy(false);
    }
  }

  const taskEditor = editor?.kind === 'task' ? editor : null;
  return (
    <section className="page planning-page" aria-label="学习计划">
      <div className="page-heading planning-toolbar">
        <div>
          <p className="eyebrow">ONE STEP AT A TIME</p>
          <h1>学习计划</h1>
          <p className="muted">用项目收拢目标，为每一天安排可以动手完成的小任务。</p>
        </div>
        <div className="planning-actions">
          <button
            className="button secondary"
            disabled={blocked || !loaded || projects.length >= planningLimits.projects}
            onClick={() => request({ kind: 'new-project' })}
          >
            <FolderOpen size={16} />
            新建项目
          </button>
          <button
            className="button primary"
            disabled={blocked || !loaded}
            onClick={() => request({ kind: 'new-task' })}
          >
            <Plus size={16} />
            新建任务
          </button>
        </div>
      </div>
      {error && (
        <div className="feedback error" role="alert">
          {error}
          {editor &&
            (editor.kind === 'task'
              ? ' 草稿仍保留；版本冲突可另存新任务，或刷新保存版本。'
              : ' 草稿仍保留；刷新前可先复制修改内容，核对最新保存版本。')}
        </div>
      )}
      {notice && (
        <p className="planning-notice" role="status">
          {notice}
        </p>
      )}
      {!isDesktop && <p className="field-hint">请启动桌面版管理本机项目和任务。</p>}
      <div className="planning-datebar">
        <label className="planning-field">
          任务日期
          <input
            type="date"
            min="0001-01-01"
            max="9999-12-31"
            value={day}
            disabled={blocked}
            onChange={(event) => {
              const next = event.target.value;
              if (validPlanningDay(next) && next !== day) request({ kind: 'day', day: next });
            }}
          />
        </label>
        <button
          className="text-button"
          disabled={blocked}
          onClick={() => {
            const today = localDayKey(new Date());
            if (today !== day) request({ kind: 'day', day: today });
          }}
        >
          今天
        </button>
        <p className="muted" role="status">
          {loaded
            ? `${selectedTasks.length}项任务 · 已手动完成${completed}项 · 预计${selectedTasks.reduce((sum, task) => sum + task.minutes, 0)}分钟`
            : '所选日期尚未加载'}
        </p>
      </div>
      <p className="field-hint">
        预计分钟用于安排任务；手动完成、实际学习计时和签到分别记录，不自动联动。
      </p>
      <div className="planning-workspace">
        <aside className="planning-sidebar" aria-label="项目和每日任务列表">
          <div className="planning-list-heading">
            <h2>项目</h2>
            <button
              className="text-button"
              disabled={blocked}
              onClick={() => request({ kind: 'refresh' })}
            >
              刷新版本
            </button>
          </div>
          <label className="planning-check">
            <input
              type="checkbox"
              checked={includeArchived}
              onChange={(event) => setIncludeArchived(event.target.checked)}
            />
            显示归档项目
          </label>
          <div className="planning-project-list">
            {projects
              .filter((project) => includeArchived || !project.archived)
              .map((project) => (
                <button
                  key={project.id}
                  className={
                    'planning-list-item' +
                    (editor?.kind === 'project' && editor.record?.id === project.id
                      ? ' selected'
                      : '')
                  }
                  disabled={blocked}
                  onClick={() => request({ kind: 'project', id: project.id })}
                >
                  <strong>{project.title}</strong>
                  <small>
                    {project.archived ? '已归档' : '使用中'} · 版本{project.revision}
                  </small>
                </button>
              ))}
            {!projects.some((project) => includeArchived || !project.archived) && (
              <p className="muted">{overview ? '暂无可显示的项目。' : '项目未加载。'}</p>
            )}
          </div>
          <h2>每日任务</h2>
          <label className="planning-field">
            筛选项目
            <select value={filter} onChange={(event) => setFilter(event.target.value)}>
              <option value="all">全部项目</option>
              <option value="none">无项目</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.title}
                  {project.archived ? '（归档）' : ''}
                </option>
              ))}
            </select>
          </label>
          <div className="planning-task-list">
            {loading && (
              <p className="muted" role="status">
                正在读取计划…
              </p>
            )}
            {selectedTasks.map((task) => (
              <button
                key={task.id}
                className={
                  'planning-list-item' + (taskEditor?.record?.id === task.id ? ' selected' : '')
                }
                disabled={blocked}
                onClick={() => request({ kind: 'task', id: task.id })}
              >
                <strong>{task.title}</strong>
                <span>
                  {task.status === 'completed' ? '已手动完成' : '待完成'} · 预计{task.minutes}分钟
                </span>
                <small>{projectName(task.projectId)}</small>
              </button>
            ))}
            {!loading && !selectedTasks.length && (
              <p className="muted">
                {loaded ? '所选日期和项目没有任务。' : '请刷新加载所选日期。'}
              </p>
            )}
          </div>
        </aside>
        {editor ? (
          <PlanningEditor
            editor={editor}
            projects={projects}
            blocked={blocked}
            busy={busy}
            dirty={dirty}
            changedElsewhere={changedElsewhere}
            titleInput={titleInput}
            request={request}
            save={save}
            setCompleted={setCompleted}
            changeProject={changeProject}
            changeTask={changeTask}
            onOpenLearningRoute={onOpenLearningRoute}
          />
        ) : (
          <div className="planning-empty">
            <CalendarDays size={38} strokeWidth={1.3} />
            <h2>给今天一个清楚的起点</h2>
            <p>选择项目或任务查看，或新建一个小任务。不需要调用AI。</p>
          </div>
        )}
      </div>
      <dialog
        ref={dialog}
        className="planning-confirmation"
        aria-labelledby="planning-confirm-title"
        onCancel={(event) => {
          if (busy || loading) event.preventDefault();
          else setPending(null);
        }}
      >
        <h2 id="planning-confirm-title">
          {pending?.kind === 'delete' ? '确认删除这项任务' : '放弃未保存的修改？'}
        </h2>
        <p>
          {pending?.kind === 'delete'
            ? '将删除下面的保存版本，没有回收站，无法撤销。这个操作不会修改签到或累计学习时长。'
            : '当前编辑将被放弃，取消可以继续编辑。'}
        </p>
        {pending?.kind === 'delete' && taskEditor?.record && (
          <div className="planning-delete-preview">
            <strong>{taskEditor.record.title}</strong>
            <p>
              {taskEditor.record.day} · {projectName(taskEditor.record.projectId)} · 预计
              {taskEditor.record.minutes}分钟
            </p>
            <p>
              {taskEditor.record.status === 'completed' ? '已手动完成' : '待完成'} · 版本
              {taskEditor.record.revision}
            </p>
            {taskEditor.record.completedAt && (
              <p>完成于{new Date(taskEditor.record.completedAt).toLocaleString('zh-CN')}</p>
            )}
            <p>{taskEditor.record.details || '无补充说明'}</p>
            {dirty && <p className="field-hint">当前未保存的编辑也会被放弃。</p>}
          </div>
        )}
        <div className="planning-actions">
          <button
            className="button secondary"
            autoFocus
            disabled={blocked}
            onClick={() => setPending(null)}
          >
            取消
          </button>
          <button
            className="button primary"
            disabled={blocked}
            onClick={() => {
              if (!pending || blocked) return;
              const action = pending;
              setPending(null);
              void perform(action);
            }}
          >
            {pending?.kind === 'delete' ? '确认删除' : '放弃并继续'}
          </button>
        </div>
      </dialog>
    </section>
  );
}
