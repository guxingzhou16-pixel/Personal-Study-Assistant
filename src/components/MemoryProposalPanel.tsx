import { useEffect, useRef, useState } from 'react';
import { Check, X } from 'lucide-react';
import { desktop, errorMessage, isDesktop } from '../lib/desktop';
import { memoryKindLabels, memoryLimits, memoryScopeLabels } from '../lib/memories';
import type {
  ChatTurn,
  MemoryProposal,
  MemoryProposalEdit,
  MemoryScope,
  StudyMemory,
} from '../lib/types';

export function MemoryProposalPanel({
  turn,
  visible,
  onSaved,
  onCleanupError,
}: {
  turn: ChatTurn;
  visible: boolean;
  onSaved: () => void;
  onCleanupError: (message: string) => void;
}) {
  const [edit, setEdit] = useState<MemoryProposalEdit | null>(null);
  const [proposal, setProposal] = useState<MemoryProposal | null>(null);
  const [saved, setSaved] = useState<StudyMemory | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const mounted = useRef(true);
  const currentVisible = useRef(visible);
  currentVisible.current = visible;
  const operationVersion = useRef(0);
  const cachedId = useRef<string | null>(null);
  const cleanupError = useRef(onCleanupError);
  cleanupError.current = onCleanupError;
  const previewCurrent = Boolean(
    proposal &&
    edit &&
    proposal.turnId === turn.id &&
    proposal.turnRevision === turn.revision &&
    proposal.draft.title === edit.title.trim() &&
    proposal.draft.content === edit.content.trim() &&
    proposal.draft.scope === edit.scope,
  );
  const editValid = Boolean(edit?.title.trim() && edit?.content.trim());

  function releaseCache(id: string) {
    void desktop.discardMemoryProposal(id).catch((reason) => {
      cleanupError.current(`记忆提议缓存未能清理：${errorMessage(reason)} 这不会自动写入记忆。`);
    });
  }

  useEffect(() => {
    mounted.current = true;
    operationVersion.current++;
    setEdit(null);
    setProposal(null);
    setSaved(null);
    setBusy(false);
    setError('');
    setNotice('');
    return () => {
      mounted.current = false;
      operationVersion.current++;
      const id = cachedId.current;
      cachedId.current = null;
      if (id) releaseCache(id);
    };
  }, [visible, turn.id, turn.revision]);

  function canApply(version: number) {
    return mounted.current && currentVisible.current && version === operationVersion.current;
  }

  function updateEdit(next: MemoryProposalEdit) {
    operationVersion.current++;
    const id = cachedId.current;
    cachedId.current = null;
    if (id) releaseCache(id);
    setEdit(next);
    setProposal(null);
    setError('');
    setNotice('内容已修改。请重新准备最终预览，确认后才会保存。');
  }

  async function prepare() {
    if (!visible || !isDesktop || busy || (edit && !editValid)) return;
    const version = ++operationVersion.current;
    const oldId = cachedId.current;
    cachedId.current = null;
    setBusy(true);
    setError('');
    setNotice('');
    setProposal(null);
    try {
      if (oldId) await desktop.discardMemoryProposal(oldId);
      if (!canApply(version)) return;
      const result = await desktop.prepareMemoryProposal(turn.id, edit ?? undefined);
      if (!canApply(version)) {
        releaseCache(result.id);
        return;
      }
      cachedId.current = result.id;
      setProposal(result);
      setEdit({
        title: result.draft.title,
        content: result.draft.content,
        scope: result.draft.scope,
      });
    } catch (reason) {
      if (canApply(version)) setError(errorMessage(reason));
    } finally {
      if (canApply(version)) setBusy(false);
    }
  }

  async function confirm() {
    if (!visible || busy || !proposal || !previewCurrent) return;
    const version = ++operationVersion.current;
    const id = proposal.id;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await desktop.confirmMemoryProposal(id);
      if (cachedId.current === id) cachedId.current = null;
      // A confirmed write remains real even if the user leaves before the reply arrives.
      onSaved();
      if (!canApply(version)) return;
      setSaved(result);
      setProposal(null);
      setEdit(null);
    } catch (reason) {
      if (canApply(version)) setError(errorMessage(reason));
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
      if (id) await desktop.discardMemoryProposal(id);
      if (!canApply(version)) return;
      cachedId.current = null;
      setProposal(null);
      setEdit(null);
      setNotice('已拒绝提议，未新增记忆。');
    } catch (reason) {
      if (canApply(version)) setError(errorMessage(reason));
    } finally {
      if (canApply(version)) setBusy(false);
    }
  }

  return (
    <section className="agent-memory-proposal" aria-label="学习意向记忆提议">
      <h3>为下一次学习留下意向</h3>
      <p className="field-hint">
        根据这条路线的目标起草学习意向，不推断已完成或已掌握，不额外请求模型。
        提议默认只供本机模型使用；编辑和预览都不会写入，确认后才新增记忆。
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
      {!saved && !edit && (
        <button
          type="button"
          className="button secondary"
          disabled={!isDesktop || busy || !visible}
          onClick={() => void prepare()}
        >
          起草记忆提议
        </button>
      )}
      {edit && !saved && (
        <>
          <label className="agent-field">
            提议标题
            <input
              value={edit.title}
              maxLength={memoryLimits.title}
              disabled={busy}
              onChange={(event) => updateEdit({ ...edit, title: event.target.value })}
            />
          </label>
          <label className="agent-field">
            提议内容
            <textarea
              value={edit.content}
              maxLength={memoryLimits.content}
              disabled={busy}
              onChange={(event) => updateEdit({ ...edit, content: event.target.value })}
            />
          </label>
          <label className="agent-field">
            允许使用的范围
            <select
              value={edit.scope}
              disabled={busy}
              onChange={(event) =>
                updateEdit({ ...edit, scope: event.target.value as MemoryScope })
              }
            >
              {Object.entries(memoryScopeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <div className="agent-actions">
            <button
              type="button"
              className="button secondary"
              disabled={busy || !editValid}
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
      {proposal && previewCurrent && (
        <div className="agent-memory-final-preview" role="region" aria-label="记忆最终写入预览">
          <h4>待新增的记忆（尚未保存）</h4>
          <strong>{proposal.draft.title}</strong>
          <p>{proposal.draft.content}</p>
          <p className="field-hint">
            {memoryKindLabels[proposal.draft.kind]} · {memoryScopeLabels[proposal.draft.scope]} ·
            来源：当前保存的学习路线
          </p>
          <p className="field-hint">
            预览有效至 {new Date(proposal.expiresAt).toLocaleTimeString('zh-CN')}。
          </p>
          <button
            type="button"
            className="button primary"
            disabled={busy || !visible}
            onClick={() => void confirm()}
          >
            <Check size={15} /> 确认新增这条记忆
          </button>
        </div>
      )}
      {saved && (
        <div className="agent-memory-written" role="status">
          <h4>实际已保存</h4>
          <strong>{saved.title}</strong>
          <p>{saved.content}</p>
          <p className="field-hint">
            {memoryKindLabels[saved.kind]} · {memoryScopeLabels[saved.scope]} · 来源：学习路线提议 ·
            第 {saved.revision} 版 · {new Date(saved.createdAt).toLocaleString('zh-CN')}
          </p>
          <p className="field-hint">
            可以在记忆页面查看、编辑、停用或删除。新记忆不会自动勾选到下一条路线。
          </p>
        </div>
      )}
      {busy && (
        <p className="field-hint" role="status">
          正在处理记忆提议…
        </p>
      )}
    </section>
  );
}
