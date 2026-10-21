import { useEffect, useRef, useState } from 'react';
import { ArchiveRestore, Download, HardDrive, LoaderCircle, RefreshCw, X } from 'lucide-react';
import { desktop, errorMessage, isDesktop } from '../../lib/desktop';
import { backupCountLabels, backupSize } from '../../lib/backup';
import type { BackupState } from '../../lib/types';
import './BackupPanel.css';

interface Props {
  state: BackupState | null;
  stateError: string | null;
  accept: (state: BackupState) => void;
  refresh: () => Promise<void>;
}

export function BackupPanel({ state, stateError, accept, refresh }: Props) {
  const [busy, setBusy] = useState(false);
  const working = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const preview = state?.preview;
  const disabled = !isDesktop || !state || state.operation !== 'idle' || busy;
  useEffect(() => setConfirmed(false), [preview?.id]);
  async function perform(operation: () => Promise<BackupState>) {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setError(null);
    try {
      accept(await operation());
    } catch (failure) {
      setError(errorMessage(failure));
      await refresh();
    } finally {
      working.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="settings-section backup-panel" aria-labelledby="backup-heading">
      <div className="section-heading">
        <h2 id="backup-heading">
          <HardDrive size={19} />
          学习数据备份
        </h2>
        <span>手动保存在本机</span>
      </div>
      <p>完整保存资料副本、阅读位置、笔记、会话与路线、记忆、计划、专注记录和日历。</p>
      <p className="field-hint">
        只备份已经保存的内容。API
        密钥、本机模型和检索缓存不随备份导出。备份未加密，请保存在你信任的位置。
      </p>
      <p className="field-hint">
        开始前请暂停首页计时、结束专注，并完成或取消导入、生成、检索与模型下载。处理期间其他学习操作会暂时锁定。
      </p>
      <div className="backup-actions">
        <button
          className="button primary"
          disabled={disabled}
          onClick={() => void perform(desktop.exportBackup)}
        >
          <Download size={16} />
          导出完整备份
        </button>
        <button
          className="button secondary"
          disabled={disabled}
          onClick={() => void perform(desktop.inspectBackup)}
        >
          <ArchiveRestore size={16} />
          选择备份并预览
        </button>
        <button
          className="button secondary"
          disabled={!isDesktop || busy}
          onClick={() => void refresh()}
        >
          <RefreshCw size={15} />
          重新读取状态
        </button>
      </div>
      {(error || stateError || state?.lastError) && (
        <p className="notice error" role="alert">
          {error || stateError || state?.lastError}
        </p>
      )}
      {!isDesktop && <p className="field-hint">请在桌面应用中备份和恢复数据。</p>}
      {state?.lastExport && (
        <div className="notice success" role="status">
          <strong>备份已导出</strong>
          <p>
            {new Date(state.lastExport.createdAt).toLocaleString()} ·{' '}
            {state.lastExport.counts.sources} 份资料
          </p>
          <p className="backup-path">{state.lastExport.directory}</p>
          <p>请保留整个文件夹。恢复时选择包含 manifest.json 的这一层。</p>
        </div>
      )}
      {preview && (
        <div className="backup-preview">
          <h3>恢复内容预览</h3>
          <p>{preview.folderName}</p>
          <p className="muted">
            备份于 {new Date(preview.createdAt).toLocaleString()} · {backupSize(preview.bytes)}
          </p>
          <dl className="backup-counts">
            {backupCountLabels.map(({ key, label }) => (
              <div key={key}>
                <dt>{label}</dt>
                <dd>{preview.counts[key]}</dd>
              </div>
            ))}
          </dl>
          <p className="field-hint">
            完整性已校验。预览有效至 {new Date(preview.expiresAt).toLocaleTimeString()}
            ，过期后重新选择。
          </p>
          <p>
            这是整份替换，不合并记录。恢复前的数据完整保留在原目录；本机密钥和模型保持原样，检索索引会按需重建。
          </p>
          <label className="backup-consent">
            <input
              type="checkbox"
              disabled={disabled}
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            我已保存需要保留的输入，理解应用会重启，尚未保存的内容会丢失。
          </label>
          <div className="backup-actions">
            <button
              className="button primary"
              disabled={disabled || !confirmed}
              onClick={() => void perform(() => desktop.confirmRestore(preview.id))}
            >
              <ArchiveRestore size={16} />
              恢复并重启
            </button>
            <button
              className="button secondary"
              disabled={disabled}
              onClick={() => void perform(() => desktop.discardRestore(preview.id))}
            >
              <X size={16} />
              放弃恢复
            </button>
          </div>
        </div>
      )}
      {state?.restoreReceipt && (
        <div className="notice info">
          <strong>已恢复学习数据</strong>
          <p>{new Date(state.restoreReceipt.restoredAt).toLocaleString()}</p>
          <p>恢复前的数据仍保存在：</p>
          <p className="backup-path">{state.restoreReceipt.preservedDirectory}</p>
          <p className="field-hint">
            不要删除这份保留数据；若需回退，可先退出应用，再按 README 的恢复说明处理。
          </p>
        </div>
      )}
      {state && (
        <p className="field-hint backup-path">当前学习数据目录：{state.learningDirectory}</p>
      )}
    </section>
  );
}

export function BackupBusyDialog({ state }: { state: BackupState | null }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const busy = state !== null && state.operation !== 'idle';
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  useEffect(() => {
    if (busy && !dialog.current?.open) dialog.current?.showModal();
    if (!busy) {
      dialog.current?.close();
      setError(null);
      setCancelling(false);
    }
  }, [busy]);
  async function cancel() {
    if (cancelling || state?.operation === 'restart' || state?.operation === 'commit') return;
    setCancelling(true);
    setError(null);
    try {
      await desktop.cancelBackup();
    } catch (failure) {
      setError(errorMessage(failure));
      setCancelling(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className="backup-progress-dialog"
      aria-labelledby="backup-progress-heading"
      onCancel={(event) => {
        event.preventDefault();
        void cancel();
      }}
    >
      <h2 id="backup-progress-heading">
        <LoaderCircle size={19} className="spin" />
        {state?.operation === 'restart' ? '正在重启' : '正在处理学习数据'}
      </h2>
      <p role="status">
        {cancelling
          ? '正在取消，请等待处理进程退出；文件夹选择窗口也需要取消或关闭。'
          : state?.progress?.message}
      </p>
      {state?.progress && state.progress.total > 0 && (
        <>
          <progress
            max={state.progress.total}
            value={state.progress.current}
            aria-label="备份文件处理进度"
          />
          <p className="muted">
            {state.progress.current} / {state.progress.total}
          </p>
        </>
      )}
      <p className="field-hint">其他学习操作暂时锁定。请等待完成或取消后再退出应用。</p>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      <button
        className="button secondary"
        autoFocus
        disabled={cancelling || state?.operation === 'restart' || state?.operation === 'commit'}
        onClick={() => void cancel()}
      >
        <X size={16} />
        {state?.operation === 'commit' ? '正在完成写入…' : cancelling ? '正在取消…' : '取消操作'}
      </button>
    </dialog>
  );
}
