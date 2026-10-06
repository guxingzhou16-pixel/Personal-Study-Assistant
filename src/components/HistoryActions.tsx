import { useEffect, useRef, useState } from 'react';
import { Download, Pencil, Trash2 } from 'lucide-react';
import { desktop, errorMessage, isDesktop } from '../lib/desktop';
import type { ConversationSummary, HistoryPreview, HistoryTarget } from '../lib/types';
import './HistoryActions.css';

export function HistoryActions({
  target,
  disabled,
  onRenamed,
  onDeleted,
  onBusyChange,
}: {
  target: HistoryTarget;
  disabled: boolean;
  onRenamed?: (saved: ConversationSummary) => void;
  onDeleted: (id: string) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<HistoryPreview | null>(null);
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const mounted = useRef(true);
  const pending = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  async function run(work: () => Promise<void>) {
    if (pending.current || disabled || !isDesktop) return;
    pending.current = true;
    setBusy(true);
    onBusyChange(true);
    setError('');
    setNotice('');
    try {
      await work();
    } catch (reason) {
      if (mounted.current)
        setError(`${errorMessage(reason)} 若删除应答丢失，请先刷新记录核对，勿重复确认。`);
    } finally {
      pending.current = false;
      onBusyChange(false);
      if (mounted.current) setBusy(false);
    }
  }

  async function startRename() {
    const saved = await desktop.previewHistory(target);
    if (!mounted.current) return;
    setEditing(saved);
    setTitle(saved.title);
  }
  async function rename() {
    if (!editing) return;
    const saved = await desktop.renameConversation(target.id, editing.version, title);
    onRenamed?.(saved);
    if (mounted.current) {
      setEditing(null);
      setNotice('会话标题已保存。');
    }
  }
  async function refreshRename() {
    const saved = await desktop.previewHistory(target);
    if (mounted.current) {
      setEditing(saved);
      setNotice('已重新读取保存记录，输入的标题仍保留。请核对后再保存。');
    }
  }
  async function remove() {
    const saved = await desktop.previewHistory(target);
    const result = await desktop.deleteHistory(saved.target, saved.version);
    // A successful write still updates the parent if the user has changed pages meanwhile.
    if (!result.cancelled) onDeleted(target.id);
    else if (mounted.current) setNotice('记录已保留。');
  }
  async function exportRecord() {
    const saved = await desktop.previewHistory(target);
    const result = await desktop.exportHistory(saved.target, saved.version);
    if (mounted.current)
      setNotice(result.cancelled ? '已取消导出。' : `已导出：${result.fileName}`);
  }

  return (
    <div
      className="history-management"
      aria-label={target.kind === 'conversation' ? '管理当前会话' : '管理当前路线'}
    >
      <div className="history-management-actions">
        {target.kind === 'conversation' && (
          <button
            type="button"
            className="text-button"
            disabled={disabled || busy || !isDesktop}
            onClick={() => void run(startRename)}
          >
            <Pencil size={14} /> 重命名
          </button>
        )}
        <button
          type="button"
          className="text-button"
          disabled={disabled || busy || !isDesktop}
          onClick={() => void run(exportRecord)}
        >
          <Download size={14} /> 导出 Markdown
        </button>
        <button
          type="button"
          className="text-button history-delete"
          disabled={disabled || busy || !isDesktop}
          onClick={() => void run(remove)}
        >
          <Trash2 size={14} /> 删除{target.kind === 'learning' ? '这份路线' : '会话'}
        </button>
      </div>
      {editing && (
        <form
          className="history-rename"
          onSubmit={(event) => {
            event.preventDefault();
            void run(rename);
          }}
        >
          <label>
            会话标题
            <input
              autoFocus
              value={title}
              maxLength={120}
              disabled={busy}
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>
          <small>当前保存标题：{editing.title}</small>
          <button
            type="button"
            className="text-button"
            disabled={disabled || busy}
            onClick={() => void run(refreshRename)}
          >
            重新核对记录
          </button>
          <button
            type="submit"
            className="button secondary"
            disabled={disabled || busy || !title.trim()}
          >
            保存标题
          </button>
          <button
            type="button"
            className="text-button"
            disabled={busy}
            onClick={() => setEditing(null)}
          >
            取消
          </button>
        </form>
      )}
      <p className="field-hint">
        导出只含已保存问答、原文与所选记忆快照，文件未加密；不包含密钥，不代替完整备份。
      </p>
      {notice && (
        <p className="field-hint" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className="feedback error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
