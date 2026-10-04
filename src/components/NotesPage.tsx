import { useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  Download,
  LoaderCircle,
  NotebookPen,
  Plus,
  Save,
  Search,
  Trash2,
} from 'lucide-react';
import { desktop, errorMessage, isDesktop } from '../lib/desktop';
import { emptyNoteDraft, noteDraft, noteLimits, noteSections, sameNoteDraft } from '../lib/notes';
import type { NoteDraft, NoteSummary, Source, StudyNote, Settings } from '../lib/types';
import { NoteFeedbackPanel } from './NoteFeedbackPanel';

type NoteAction =
  { type: 'new'; sourceId: string | null } | { type: 'open'; id: string } | { type: 'delete' };

export function NotesPage({
  visible,
  presetSource,
  onOpenSource,
  settings,
  onSettings,
  onOpenCitation,
}: {
  visible: boolean;
  presetSource: { id: string | null; sequence: number } | null;
  onOpenSource: (id: string) => void;
  settings: Settings;
  onSettings: () => void;
  onOpenCitation: (turnId: string, number: number) => Promise<void>;
}) {
  const [notes, setNotes] = useState<NoteSummary[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [current, setCurrent] = useState<StudyNote | null>(null);
  const [draft, setDraft] = useState<NoteDraft>(emptyNoteDraft);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(isDesktop);
  const [listLoaded, setListLoaded] = useState(!isDesktop);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  const [pendingAction, setPendingAction] = useState<NoteAction | null>(null);
  const confirmation = useRef<HTMLDialogElement>(null);
  const titleInput = useRef<HTMLInputElement>(null);
  const lastPreset = useRef(0);
  const dirty = editing && !sameNoteDraft(draft, current ?? emptyNoteDraft());

  useEffect(() => {
    if (!isDesktop) return;
    let cancelled = false;
    void Promise.allSettled([desktop.listNotes(), desktop.listSources()])
      .then(([items, documents]) => {
        if (cancelled) return;
        const failures: string[] = [];
        if (items.status === 'fulfilled') {
          setNotes(items.value);
          setListLoaded(true);
        } else failures.push(errorMessage(items.reason));
        if (documents.status === 'fulfilled') setSources(documents.value);
        else failures.push(errorMessage(documents.reason));
        if (failures.length) setError(failures.join(' '));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isDesktop || !visible) return;
    let cancelled = false;
    void desktop
      .listSources()
      .then((items) => {
        if (!cancelled) setSources(items);
      })
      .catch((reason) => {
        if (!cancelled) setError(errorMessage(reason));
      });
    return () => {
      cancelled = true;
    };
  }, [visible]);

  useEffect(() => {
    if (isDesktop)
      void desktop.setNoteDraftDirty(dirty).catch((reason) => setError(errorMessage(reason)));
  }, [dirty]);

  useEffect(() => {
    if (loading || busy || !presetSource || presetSource.sequence === lastPreset.current) return;
    lastPreset.current = presetSource.sequence;
    requestAction({ type: 'new', sourceId: presetSource.id });
  }, [loading, busy, presetSource]);

  useEffect(() => {
    const dialog = confirmation.current;
    if (!dialog) return;
    if (pendingAction && visible && !dialog.open) dialog.showModal();
    else if ((!pendingAction || !visible) && dialog.open) dialog.close();
  }, [pendingAction, visible]);

  function change<K extends keyof NoteDraft>(key: K, value: NoteDraft[K]) {
    setDraft((previous) => ({ ...previous, [key]: value }));
    setNotice('');
  }

  function requestAction(action: NoteAction) {
    if (busy || loading || !isDesktop) return;
    if (dirty || action.type === 'delete') setPendingAction(action);
    else void performAction(action);
  }

  async function performAction(action: NoteAction) {
    setError('');
    setNotice('');
    setBusy(true);
    try {
      if (action.type === 'new') {
        setCurrent(null);
        setDraft(emptyNoteDraft(action.sourceId));
        setEditing(true);
      } else if (action.type === 'open') {
        const note = await desktop.getNote(action.id);
        setCurrent(note);
        setDraft(noteDraft(note));
        setEditing(true);
      } else if (current) {
        await desktop.deleteNote(current.id, current.revision);
        setNotes((previous) => previous.filter((note) => note.id !== current.id));
        setCurrent(null);
        setDraft(emptyNoteDraft());
        setEditing(false);
        setNotice('笔记已删除。');
      }
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  async function save(asNew = false): Promise<StudyNote | null> {
    if (!draft.title.trim()) {
      setError('请先填写笔记标题。');
      titleInput.current?.focus();
      return null;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const note = await desktop.saveNote({
        ...draft,
        id: asNew ? null : (current?.id ?? null),
        revision: asNew ? 0 : (current?.revision ?? 0),
      });
      setCurrent(note);
      setDraft(noteDraft(note));
      const summary: NoteSummary = {
        id: note.id,
        title: note.title,
        sourceId: note.sourceId,
        updatedAt: note.updatedAt,
        sourceName: sources.find((source) => source.id === note.sourceId)?.name ?? null,
      };
      setNotes((previous) =>
        [summary, ...previous.filter((item) => item.id !== note.id)].sort(
          (left, right) =>
            right.updatedAt.localeCompare(left.updatedAt) || left.id.localeCompare(right.id),
        ),
      );
      setNotice('笔记已保存到本机。');
      return note;
    } catch (reason) {
      setError(errorMessage(reason));
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function confirmAction(saveFirst: boolean) {
    if (!pendingAction) return;
    const action = pendingAction;
    if (saveFirst && !(await save())) return;
    setPendingAction(null);
    await performAction(action);
  }

  async function exportMarkdown() {
    const note = dirty || !current ? await save() : current;
    if (!note) return;
    setBusy(true);
    setError('');
    try {
      const result = await desktop.exportNote(note.id, note.revision);
      setNotice(
        result.cancelled ? '导出已取消，笔记仍保存在本机。' : '已导出 ' + result.fileName + '。',
      );
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  async function refreshList() {
    setBusy(true);
    try {
      setNotes(await desktop.listNotes());
      setListLoaded(true);
      setError('');
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  const filtered = notes.filter((note) =>
    note.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  );
  return (
    <section className="page notes-page" aria-label="学习笔记">
      <div className="page-heading">
        <div>
          <p className="eyebrow">PUT KNOWLEDGE INTO YOUR OWN WORDS</p>
          <h1>学习笔记</h1>
          <p className="muted">写出理解，留下依据，找到下一步。</p>
        </div>
        <button
          className="button primary"
          disabled={!isDesktop || busy || loading}
          onClick={() => requestAction({ type: 'new', sourceId: null })}
        >
          <Plus size={16} />
          新建笔记
        </button>
      </div>
      {error && (
        <div className="feedback error" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <p className="note-notice" role="status">
          {notice}
        </p>
      )}
      {!isDesktop && <p className="field-hint">请启动桌面版，使用笔记保存与导出。</p>}
      <div className="notes-workspace">
        <aside className="notes-sidebar" aria-label="笔记列表">
          <label className="source-search">
            <Search size={16} />
            <input
              aria-label="搜索笔记标题"
              placeholder="搜索标题…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <div className="note-list-heading">
            <small>{listLoaded ? notes.length + ' 份笔记' : '笔记列表未加载'}</small>
            <button
              className="text-button"
              disabled={!isDesktop || busy || loading}
              onClick={() => void refreshList()}
            >
              刷新列表
            </button>
          </div>
          <div className="note-list">
            {loading ? (
              <p className="muted" role="status">
                正在读取笔记…
              </p>
            ) : (
              filtered.map((note) => (
                <button
                  key={note.id}
                  className={'note-list-item' + (current?.id === note.id ? ' selected' : '')}
                  aria-current={current?.id === note.id ? 'true' : undefined}
                  disabled={busy}
                  onClick={() => {
                    if (note.id !== current?.id) requestAction({ type: 'open', id: note.id });
                  }}
                >
                  <strong>{note.title}</strong>
                  <span>
                    {note.sourceName ?? (note.sourceId ? '关联资料暂不可用' : '独立笔记')}
                  </span>
                  <small>{new Date(note.updatedAt).toLocaleString('zh-CN')}</small>
                </button>
              ))
            )}
            {!loading && !filtered.length && (
              <p className="muted">
                {!listLoaded
                  ? '未能读取笔记列表，请刷新重试。'
                  : notes.length
                    ? '没有匹配的标题。'
                    : '还没有笔记。'}
              </p>
            )}
          </div>
        </aside>
        {editing ? (
          <div className="note-work">
            <form
              className="note-editor"
              onSubmit={(event) => {
                event.preventDefault();
                if (!busy) void save();
              }}
            >
              <div className="note-editor-toolbar">
                <span className={dirty ? 'note-unsaved' : 'muted'} role="status">
                  {busy
                    ? '正在处理…'
                    : dirty
                      ? '有未保存的修改'
                      : current
                        ? '已保存'
                        : '新笔记尚未保存'}
                </span>
                <div className="note-editor-actions">
                  <button
                    type="submit"
                    className="button primary"
                    disabled={busy || !draft.title.trim()}
                  >
                    <Save size={15} />
                    保存笔记
                  </button>
                  <button
                    type="button"
                    className="button secondary"
                    disabled={busy || !draft.title.trim()}
                    onClick={() => void exportMarkdown()}
                  >
                    <Download size={15} />
                    导出 Markdown
                  </button>
                  {current && (
                    <button
                      type="button"
                      className="icon-button note-delete"
                      aria-label="删除这份笔记"
                      disabled={busy}
                      onClick={() => requestAction({ type: 'delete' })}
                    >
                      <Trash2 size={17} />
                    </button>
                  )}
                </div>
              </div>
              <label className="note-title-field">
                笔记标题
                <input
                  ref={titleInput}
                  required
                  maxLength={noteLimits.title}
                  value={draft.title}
                  disabled={busy}
                  placeholder="这次想读懂什么？"
                  onChange={(event) => change('title', event.target.value)}
                />
              </label>
              <div className="note-source-field">
                <label>
                  关联资料
                  <select
                    value={draft.sourceId ?? ''}
                    disabled={busy}
                    onChange={(event) => change('sourceId', event.target.value || null)}
                  >
                    <option value="">不关联资料</option>
                    {draft.sourceId && !sources.some((source) => source.id === draft.sourceId) && (
                      <option value={draft.sourceId}>原关联资料暂不可用</option>
                    )}
                    {sources.map((source) => (
                      <option key={source.id} value={source.id}>
                        {source.name}
                      </option>
                    ))}
                  </select>
                </label>
                {draft.sourceId && (
                  <button
                    type="button"
                    className="button secondary"
                    disabled={busy}
                    onClick={() => onOpenSource(draft.sourceId!)}
                  >
                    <BookOpen size={15} />
                    查看资料
                  </button>
                )}
              </div>
              {noteSections.map(({ key, label, hint }) => (
                <label className="note-section" key={key}>
                  <strong>{label}</strong>
                  <span className="field-hint" id={'note-hint-' + key}>
                    {hint}
                  </span>
                  <textarea
                    aria-describedby={'note-hint-' + key}
                    rows={key === 'understanding' ? 7 : 4}
                    maxLength={noteLimits.section}
                    value={draft[key]}
                    disabled={busy}
                    onChange={(event) => change(key, event.target.value)}
                  />
                </label>
              ))}
              <div className="note-editor-footer">
                <small className="muted">手动保存。切换页面保留草稿；保存后重启可恢复。</small>
                {current && (
                  <div className="note-editor-actions">
                    <button
                      type="button"
                      className="text-button"
                      disabled={busy}
                      onClick={() => void save(true)}
                    >
                      另存为新笔记
                    </button>
                    <button
                      type="button"
                      className="text-button"
                      disabled={busy}
                      onClick={() => requestAction({ type: 'open', id: current.id })}
                    >
                      重新加载已保存版本
                    </button>
                  </div>
                )}
              </div>
            </form>
            {current ? (
              <NoteFeedbackPanel
                key={current.id}
                note={current}
                hasUnsavedChanges={dirty}
                disabled={busy}
                settings={settings}
                onSettings={onSettings}
                onOpenCitation={onOpenCitation}
              />
            ) : (
              <p className="field-hint">先保存笔记，再根据资料准备 AI 反馈。</p>
            )}
          </div>
        ) : (
          <div className="note-empty">
            {busy ? (
              <LoaderCircle className="spin" size={30} />
            ) : (
              <NotebookPen size={38} strokeWidth={1.3} />
            )}
            <h2>把读到的内容，写成自己的理解</h2>
            <p>新建一份笔记，或者从左侧继续编辑。无需调用 AI。</p>
          </div>
        )}
      </div>
      <dialog
        ref={confirmation}
        className="note-confirmation"
        aria-labelledby="note-confirm-title"
        aria-describedby="note-confirm-description"
        onCancel={(event) => {
          if (busy) event.preventDefault();
          else setPendingAction(null);
        }}
      >
        <h2 id="note-confirm-title">
          {pendingAction?.type === 'delete' ? '删除这份笔记？' : '先处理未保存的内容'}
        </h2>
        <p id="note-confirm-description">
          {pendingAction?.type === 'delete'
            ? '笔记及其关联的反馈记录都会删除，不能在应用内撤销，未保存修改也会放弃。需要保留笔记时，请先取消并导出。'
            : '可以保存后继续，或者明确放弃这次修改。取消会回到当前笔记。'}
        </p>
        {error && (
          <p className="feedback error" role="alert">
            {error}
          </p>
        )}
        <div className="note-confirm-actions">
          <button
            className="button secondary"
            disabled={busy}
            onClick={() => setPendingAction(null)}
          >
            取消
          </button>
          {pendingAction?.type !== 'delete' && (
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => void confirmAction(false)}
            >
              放弃修改并继续
            </button>
          )}
          <button
            className={'button ' + (pendingAction?.type === 'delete' ? 'danger' : 'primary')}
            disabled={busy}
            onClick={() => void confirmAction(pendingAction?.type !== 'delete')}
          >
            {pendingAction?.type === 'delete' ? '确认删除' : '保存并继续'}
          </button>
        </div>
      </dialog>
    </section>
  );
}
