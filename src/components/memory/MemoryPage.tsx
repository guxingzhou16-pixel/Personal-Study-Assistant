import { useEffect, useRef, useState } from 'react';
import { Brain, Plus, Save, Search, Trash2 } from 'lucide-react';
import { desktop, errorMessage, isDesktop } from '../../lib/desktop';
import {
  emptyMemoryDraft,
  memoryKindLabels,
  memoryLimits,
  memoryScopeLabels,
} from '../../lib/memories';
import type { MemoryDraft, MemoryKind, MemoryScope, StudyMemory } from '../../lib/types';
import './MemoryPage.css';

type MemoryAction = { type: 'new' | 'refresh' | 'delete' } | { type: 'open'; id: string };

function memoryDraft(memory: MemoryDraft): MemoryDraft {
  return {
    title: memory.title,
    content: memory.content,
    kind: memory.kind,
    scope: memory.scope,
  };
}

function sameDraft(left: MemoryDraft, right: MemoryDraft): boolean {
  return (
    left.title === right.title &&
    left.content === right.content &&
    left.kind === right.kind &&
    left.scope === right.scope
  );
}

export function MemoryPage({ visible }: { visible: boolean }) {
  const [memories, setMemories] = useState<StudyMemory[]>([]);
  const [current, setCurrent] = useState<StudyMemory | null>(null);
  const [draft, setDraft] = useState<MemoryDraft>(emptyMemoryDraft);
  const [editing, setEditing] = useState(false);
  const [loaded, setLoaded] = useState(!isDesktop);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pendingAction, setPendingAction] = useState<MemoryAction | null>(null);
  const confirmation = useRef<HTMLDialogElement>(null);
  const titleInput = useRef<HTMLInputElement>(null);
  const loadVersion = useRef(0);
  const mounted = useRef(false);
  const dirty = editing && !sameDraft(draft, current ?? emptyMemoryDraft());
  const latest = current && memories.find((memory) => memory.id === current.id);
  const changedElsewhere = current && loaded && (!latest || latest.revision !== current.revision);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      loadVersion.current += 1;
    };
  }, []);

  useEffect(() => {
    if (visible && isDesktop && !busy) void refresh(false);
  }, [visible]);

  useEffect(() => {
    const dialog = confirmation.current;
    if (!dialog) return;
    if (pendingAction && visible && !dialog.open) dialog.showModal();
    else if ((!pendingAction || !visible) && dialog.open) dialog.close();
  }, [pendingAction, visible]);

  function change<K extends keyof MemoryDraft>(key: K, value: MemoryDraft[K]) {
    setDraft((previous) => ({ ...previous, [key]: value }));
    setNotice('');
  }

  async function refresh(reloadEditor: boolean) {
    const version = ++loadVersion.current;
    setLoading(true);
    try {
      const items = await desktop.listMemories();
      if (!mounted.current || version !== loadVersion.current) return;
      setMemories(items);
      setLoaded(true);
      setError('');
      if (reloadEditor && current) {
        const saved = items.find((memory) => memory.id === current.id);
        setCurrent(saved ?? null);
        setDraft(saved ? memoryDraft(saved) : emptyMemoryDraft());
        setEditing(Boolean(saved));
        setNotice(saved ? '已重新加载保存版本。' : '这条记忆已不存在，未恢复或重新创建。');
      } else if (reloadEditor && editing) {
        setDraft(emptyMemoryDraft());
        setNotice('已放弃未保存的修改并刷新列表。');
      }
    } catch (reason) {
      if (mounted.current && version === loadVersion.current) setError(errorMessage(reason));
    } finally {
      if (mounted.current && version === loadVersion.current) setLoading(false);
    }
  }

  function requestAction(action: MemoryAction) {
    if (busy || loading || !isDesktop) return;
    if (dirty || action.type === 'delete') setPendingAction(action);
    else void performAction(action);
  }

  async function performAction(action: MemoryAction) {
    setError('');
    setNotice('');
    if (action.type === 'refresh') {
      await refresh(true);
    } else if (action.type === 'new') {
      setCurrent(null);
      setDraft(emptyMemoryDraft());
      setEditing(true);
      titleInput.current?.focus();
    } else if (action.type === 'open') {
      const saved = memories.find((memory) => memory.id === action.id);
      if (!saved) {
        setError('这条记忆不在当前列表，请刷新后重试。');
        return;
      }
      setCurrent(saved);
      setDraft(memoryDraft(saved));
      setEditing(true);
    } else if (current) {
      setBusy(true);
      loadVersion.current += 1;
      try {
        await desktop.deleteMemory(current.id, current.revision);
        if (!mounted.current) return;
        setMemories((previous) => previous.filter((memory) => memory.id !== current.id));
        setCurrent(null);
        setDraft(emptyMemoryDraft());
        setEditing(false);
        setNotice('记忆已删除，后续路线不会再使用；既往路线快照和升级备份仍保留。');
      } catch (reason) {
        if (mounted.current) setError(errorMessage(reason));
      } finally {
        if (mounted.current) setBusy(false);
      }
    }
  }

  async function save(asNew = false) {
    if (!draft.title.trim() || !draft.content.trim()) {
      setError('请填写记忆标题和内容。');
      if (!draft.title.trim()) titleInput.current?.focus();
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    loadVersion.current += 1;
    try {
      const saved = await desktop.saveMemory({
        ...draft,
        id: asNew ? null : (current?.id ?? null),
        revision: asNew ? 0 : (current?.revision ?? 0),
      });
      if (!mounted.current) return;
      setCurrent(saved);
      setDraft(memoryDraft(saved));
      setMemories((previous) =>
        [saved, ...previous.filter((memory) => memory.id !== saved.id)].sort(
          (left, right) =>
            right.updatedAt.localeCompare(left.updatedAt) || left.id.localeCompare(right.id),
        ),
      );
      setNotice('已保存到本机。保存操作不会请求模型；以后起草路线时仍需手动选择这条记忆。');
    } catch (reason) {
      if (mounted.current) setError(errorMessage(reason));
    } finally {
      if (mounted.current) setBusy(false);
    }
  }

  async function confirmAction() {
    if (!pendingAction || busy || loading) return;
    const action = pendingAction;
    setPendingAction(null);
    await performAction(action);
  }

  const filtered = memories.filter((memory) =>
    (memory.title + '\n' + memory.content)
      .toLocaleLowerCase()
      .includes(query.trim().toLocaleLowerCase()),
  );

  return (
    <section className="page memory-page" aria-label="长期记忆">
      <div className="page-heading">
        <div>
          <p className="eyebrow">REMEMBER WITH YOUR PERMISSION</p>
          <h1>长期记忆</h1>
          <p className="muted">记录偏好与学习事实，由你决定哪些内容可用于学习路线。</p>
        </div>
        <button
          className="button primary"
          disabled={
            !isDesktop || busy || loading || !loaded || memories.length >= memoryLimits.count
          }
          onClick={() => requestAction({ type: 'new' })}
        >
          <Plus size={16} />
          新建记忆
        </button>
      </div>
      {error && (
        <div className="feedback error" role="alert">
          {error}
          {editing && ' 草稿保留在当前页面；版本冲突时可另存为手动新记忆，或重新加载保存版本。'}
        </div>
      )}
      {notice && (
        <p className="memory-notice" role="status">
          {notice}
        </p>
      )}
      {!isDesktop && <p className="field-hint">请启动桌面版，使用本机长期记忆。</p>}
      <p className="memory-guidance">
        学习意向与自述不代表知识已掌握。这里只保存你确认的内容，不会自动从签到、计时或模型评价推断进步。
      </p>
      <div className="memory-workspace">
        <aside className="memory-sidebar" aria-label="记忆列表">
          <label className="memory-search">
            <Search size={16} />
            <input
              aria-label="搜索记忆标题和内容"
              placeholder="搜索标题或内容…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <div className="memory-list-heading">
            <small>
              {loaded ? memories.length + ' / ' + memoryLimits.count + ' 条' : '列表未加载'}
            </small>
            <button
              className="text-button"
              disabled={!isDesktop || busy || loading}
              onClick={() => requestAction({ type: 'refresh' })}
            >
              刷新版本
            </button>
          </div>
          <div className="memory-list">
            {loading && (
              <p className="muted" role="status">
                正在读取记忆…
              </p>
            )}
            {filtered.map((memory) => (
              <button
                key={memory.id}
                className={'memory-list-item' + (current?.id === memory.id ? ' selected' : '')}
                aria-current={current?.id === memory.id ? 'true' : undefined}
                disabled={busy || loading}
                onClick={() => {
                  if (memory.id !== current?.id) requestAction({ type: 'open', id: memory.id });
                }}
              >
                <strong>{memory.title}</strong>
                <span>
                  {memoryKindLabels[memory.kind]} · {memoryScopeLabels[memory.scope]}
                </span>
                <small>{new Date(memory.updatedAt).toLocaleString('zh-CN')}</small>
              </button>
            ))}
            {!loading && !filtered.length && (
              <p className="muted">
                {!loaded
                  ? '读取失败，请刷新重试。'
                  : memories.length
                    ? '没有匹配的记忆。'
                    : '还没有长期记忆。'}
              </p>
            )}
          </div>
        </aside>
        {editing ? (
          <form
            className="memory-editor"
            onSubmit={(event) => {
              event.preventDefault();
              if (!busy && !loading) void save();
            }}
          >
            <div className="memory-toolbar">
              <span className={dirty ? 'memory-unsaved' : 'muted'} role="status">
                {busy
                  ? '正在处理…'
                  : dirty
                    ? '有未保存的修改'
                    : current
                      ? '已保存'
                      : '新记忆尚未保存'}
              </span>
              <div className="memory-actions">
                <button
                  type="submit"
                  className="button primary"
                  disabled={busy || loading || !draft.title.trim() || !draft.content.trim()}
                >
                  <Save size={15} />
                  确认保存到本机
                </button>
                {current && (
                  <button
                    type="button"
                    className="button secondary"
                    disabled={busy || loading}
                    onClick={() => requestAction({ type: 'delete' })}
                  >
                    <Trash2 size={15} />
                    删除
                  </button>
                )}
              </div>
            </div>
            {changedElsewhere && (
              <p className="memory-guidance" role="status">
                保存版本已变化或被删除。当前草稿仍保留，保存时会核对版本，不会覆盖其他修改。
              </p>
            )}
            <label className="memory-field">
              标题
              <input
                ref={titleInput}
                required
                maxLength={memoryLimits.title}
                value={draft.title}
                disabled={busy || loading}
                placeholder="例如：阅读时先给我一个小例子"
                onChange={(event) => change('title', event.target.value)}
              />
            </label>
            <div className="memory-options">
              <label className="memory-field">
                记忆类型
                <select
                  value={draft.kind}
                  disabled={busy || loading}
                  onChange={(event) => change('kind', event.target.value as MemoryKind)}
                >
                  {Object.entries(memoryKindLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="memory-field">
                允许使用范围
                <select
                  value={draft.scope}
                  disabled={busy || loading}
                  onChange={(event) => change('scope', event.target.value as MemoryScope)}
                >
                  {Object.entries(memoryScopeLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p className="field-hint">
              {draft.scope === 'remote'
                ? '允许在以后手动选中这条记忆并确认远程请求时，将内容发送到配置的模型服务。现在保存不会发送。'
                : draft.scope === 'local'
                  ? '仅允许发给本机模型；以后起草路线时还需手动选择。'
                  : '只在本机保存和查看，不参与新的学习路线。'}
            </p>
            <label className="memory-field">
              内容
              <textarea
                required
                rows={8}
                maxLength={memoryLimits.content}
                value={draft.content}
                disabled={busy || loading}
                placeholder="写下偏好或可核对的学习事实，保留尚待求证的地方。"
                onChange={(event) => change('content', event.target.value)}
              />
              <small className="muted">
                {draft.content.length} / {memoryLimits.content} 字符
              </small>
            </label>
            {current && (
              <dl className="memory-origin">
                <div>
                  <dt>来源</dt>
                  <dd>{current.origin === 'manual' ? '手动记录' : '学习路线提议，经用户确认'}</dd>
                </div>
                {current.originTurnId && (
                  <div>
                    <dt>来源轮次</dt>
                    <dd>{current.originTurnId}</dd>
                  </div>
                )}
                <div>
                  <dt>创建时间</dt>
                  <dd>{new Date(current.createdAt).toLocaleString('zh-CN')}</dd>
                </div>
                <div>
                  <dt>更新时间</dt>
                  <dd>
                    {new Date(current.updatedAt).toLocaleString('zh-CN')} · 版本 {current.revision}
                  </dd>
                </div>
              </dl>
            )}
            <div className="memory-footer">
              <p className="field-hint">
                手动保存；切换页面保留草稿，关闭应用或重载时未保存内容会丢失。
              </p>
              {current && (
                <div className="memory-actions">
                  <button
                    type="button"
                    className="text-button"
                    disabled={busy || loading || memories.length >= memoryLimits.count}
                    onClick={() => void save(true)}
                  >
                    另存为手动新记忆
                  </button>
                  <button
                    type="button"
                    className="text-button"
                    disabled={busy || loading}
                    onClick={() => requestAction({ type: 'refresh' })}
                  >
                    重新加载保存版本
                  </button>
                </div>
              )}
            </div>
          </form>
        ) : (
          <div className="memory-empty">
            <Brain size={38} strokeWidth={1.3} />
            <h2>记住你希望保留的内容</h2>
            <p>从左侧查看记忆，或手动新建。不需要调用 AI。</p>
          </div>
        )}
      </div>
      <dialog
        ref={confirmation}
        className="memory-confirmation"
        aria-labelledby="memory-confirm-title"
        aria-describedby="memory-confirm-description"
        onCancel={(event) => {
          if (busy || loading) event.preventDefault();
          else setPendingAction(null);
        }}
      >
        <h2 id="memory-confirm-title">
          {pendingAction?.type === 'delete' ? '确认删除这条记忆' : '放弃未保存的修改？'}
        </h2>
        <p id="memory-confirm-description">
          {pendingAction?.type === 'delete'
            ? '删除下面的保存版本后，后续路线不再使用它；既往路线快照和升级备份不会被改写。'
            : '当前草稿将被放弃。取消可以继续编辑，保存后再切换也可以保留修改。'}
        </p>
        {pendingAction?.type === 'delete' && current && (
          <div className="memory-delete-preview">
            <strong>{current.title}</strong>
            <p>{current.content}</p>
            <small>
              {memoryKindLabels[current.kind]} · {memoryScopeLabels[current.scope]} · 版本{' '}
              {current.revision}
            </small>
            {dirty && <p className="field-hint">当前尚未保存的编辑也会被放弃。</p>}
          </div>
        )}
        <div className="memory-actions">
          <button
            className="button secondary"
            disabled={busy || loading}
            autoFocus
            onClick={() => setPendingAction(null)}
          >
            取消
          </button>
          <button
            className="button primary"
            disabled={busy || loading}
            onClick={() => void confirmAction()}
          >
            {pendingAction?.type === 'delete' ? '确认删除' : '放弃并继续'}
          </button>
        </div>
      </dialog>
    </section>
  );
}
