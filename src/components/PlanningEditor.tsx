import type { RefObject } from 'react';
import { Save, Trash2 } from 'lucide-react';
import { planningLimits } from '../lib/planning';
import type { DailyTask, ProjectDraft, StudyProject, TaskDraft } from '../lib/types';

export type PlanningEditorState =
  | { kind: 'project'; record: StudyProject | null; draft: ProjectDraft; original: ProjectDraft }
  | { kind: 'task'; record: DailyTask | null; draft: TaskDraft; original: TaskDraft };

interface Props {
  editor: PlanningEditorState;
  projects: StudyProject[];
  blocked: boolean;
  busy: boolean;
  dirty: boolean;
  changedElsewhere: boolean;
  titleInput: RefObject<HTMLInputElement | null>;
  request(action: { kind: 'close' | 'delete' }): void;
  save(asNew?: boolean): Promise<void>;
  setCompleted(): Promise<void>;
  changeProject<K extends keyof ProjectDraft>(key: K, value: ProjectDraft[K]): void;
  changeTask<K extends keyof TaskDraft>(key: K, value: TaskDraft[K]): void;
}

export function PlanningEditor({
  editor,
  projects,
  blocked,
  busy,
  dirty,
  changedElsewhere,
  titleInput,
  request,
  save,
  setCompleted,
  changeProject,
  changeTask,
}: Props) {
  return (
    <form
      className="planning-editor"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <div className="planning-toolbar">
        <h2>{editor.kind === 'project' ? '学习项目' : '每日任务'}</h2>
        <button
          type="button"
          className="text-button"
          disabled={blocked}
          onClick={() => request({ kind: 'close' })}
        >
          关闭编辑
        </button>
      </div>
      <p className={dirty ? 'planning-unsaved' : 'muted'} role="status">
        {busy
          ? '正在处理…'
          : dirty
            ? '有未保存的修改'
            : editor.record
              ? '已保存'
              : '新内容尚未保存'}
      </p>
      {changedElsewhere && (
        <p className="field-hint" role="status">
          列表中没有相同版本。草稿保留，保存时会核对版本；也可能已改期至其他日期。
        </p>
      )}
      <label className="planning-field">
        标题
        <input
          ref={titleInput}
          required
          maxLength={planningLimits.title}
          value={editor.draft.title}
          disabled={blocked}
          onChange={(event) =>
            editor.kind === 'project'
              ? changeProject('title', event.target.value)
              : changeTask('title', event.target.value)
          }
        />
      </label>
      {editor.kind === 'project' ? (
        <>
          <label className="planning-field">
            学习目标
            <textarea
              rows={6}
              maxLength={planningLimits.goal}
              value={editor.draft.goal}
              disabled={blocked}
              placeholder="希望通过这个项目做出什么、理解什么？"
              onChange={(event) => changeProject('goal', event.target.value)}
            />
          </label>
          <label className="planning-check">
            <input
              type="checkbox"
              checked={editor.draft.archived}
              disabled={blocked}
              onChange={(event) => changeProject('archived', event.target.checked)}
            />
            归档项目
          </label>
          <p className="field-hint">归档后保留原有任务，不能新增关联。取消勾选并保存可恢复项目。</p>
        </>
      ) : (
        <>
          <div className="planning-options">
            <label className="planning-field">
              安排日期
              <input
                type="date"
                required
                min="0001-01-01"
                max="9999-12-31"
                value={editor.draft.day}
                disabled={blocked}
                onChange={(event) => changeTask('day', event.target.value)}
              />
            </label>
            <label className="planning-field">
              预计分钟
              <input
                type="number"
                required
                min={planningLimits.minMinutes}
                max={planningLimits.maxMinutes}
                step={1}
                value={editor.draft.minutes}
                disabled={blocked}
                onChange={(event) => changeTask('minutes', Number(event.target.value))}
              />
            </label>
          </div>
          <label className="planning-field">
            关联项目
            <select
              value={editor.draft.projectId ?? ''}
              disabled={blocked}
              onChange={(event) => changeTask('projectId', event.target.value || null)}
            >
              <option value="">无项目</option>
              {projects
                .filter((project) => !project.archived || editor.record?.projectId === project.id)
                .map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.title}
                    {project.archived ? '（原关联已归档）' : ''}
                  </option>
                ))}
            </select>
          </label>
          <label className="planning-field">
            具体行动与说明
            <textarea
              rows={7}
              maxLength={planningLimits.details}
              value={editor.draft.details}
              disabled={blocked}
              placeholder="例如：读完一节，写出一个小例子和一个待求证的问题。"
              onChange={(event) => changeTask('details', event.target.value)}
            />
          </label>
          {editor.record && (
            <div className="planning-task-status">
              <p>
                保存状态：{editor.record.status === 'completed' ? '已手动完成' : '待完成'}
                {editor.record.completedAt &&
                  ` · ${new Date(editor.record.completedAt).toLocaleString('zh-CN')}`}
              </p>
              <button
                type="button"
                className="button secondary"
                disabled={blocked}
                onClick={() => void setCompleted()}
              >
                {editor.record.status === 'completed' ? '重新打开任务' : '手动标记完成'}
              </button>
              <p className="field-hint">只修改已保存任务的状态；正文草稿不会随之保存。</p>
            </div>
          )}
        </>
      )}
      {editor.record && (
        <p className="field-hint">
          版本{editor.record.revision} · 更新于
          {new Date(editor.record.updatedAt).toLocaleString('zh-CN')}
        </p>
      )}
      <div className="planning-actions">
        <button
          type="submit"
          className="button primary"
          disabled={blocked || !editor.draft.title.trim()}
        >
          <Save size={15} />
          确认保存到本机
        </button>
        {editor.kind === 'task' && editor.record && (
          <>
            <button
              type="button"
              className="button secondary"
              disabled={blocked}
              onClick={() => void save(true)}
            >
              另存新任务
            </button>
            <button
              type="button"
              className="button secondary"
              disabled={blocked}
              onClick={() => request({ kind: 'delete' })}
            >
              <Trash2 size={15} />
              删除
            </button>
          </>
        )}
      </div>
      <p className="field-hint">手动保存；切换页面保留草稿，关闭应用或重载可能丢失未保存内容。</p>
    </form>
  );
}
