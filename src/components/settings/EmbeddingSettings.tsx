import { useEffect, useState } from 'react';
import { Download, LoaderCircle, Square } from 'lucide-react';
import { desktop, errorMessage, isDesktop } from '../../lib/desktop';
import type { EmbeddingStatus, RetrievalProgress } from '../../lib/types';

// Download lifecycle stays independent of the chat settings form. Selecting a
// cloud chat provider does not select, upload to, or reconfigure this local model.
export function EmbeddingSettings() {
  const [status, setStatus] = useState<EmbeddingStatus | null>(null);
  const [progress, setProgress] = useState<RetrievalProgress | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const downloading = busy || status?.state === 'downloading';
  useEffect(() => {
    if (!isDesktop) return;
    let active = true;
    const read = () =>
      void desktop
        .embeddingStatus()
        .then((value) => {
          if (active) setStatus(value);
        })
        .catch((error) => {
          if (active) setNotice(errorMessage(error));
        });
    read();
    // A download continues when navigating away. Read the final status after
    // returning, without starting another request or relying on a mounted form.
    const timer = downloading ? setInterval(read, 2000) : undefined;
    const stop = desktop.onEmbeddingProgress(setProgress);
    return () => {
      active = false;
      clearInterval(timer);
      stop();
    };
  }, [downloading]);
  async function download() {
    setBusy(true);
    setNotice('');
    setProgress(null);
    try {
      setStatus(await desktop.downloadEmbedding());
      setNotice('检索模型文件已下载并校验，下一次资料问答将尝试混合检索。');
    } catch (error) {
      setNotice(errorMessage(error));
      try {
        setStatus(await desktop.embeddingStatus());
      } catch (failure) {
        setNotice(errorMessage(failure));
      }
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="settings-section embedding-settings" aria-labelledby="embedding-heading">
      <div className="section-heading">
        <h2 id="embedding-heading">本地语义检索</h2>
        <span>资料留在本机</span>
      </div>
      <p>
        让表达不同但意思相关的原文也能被找到。检索模型独立运行，无需安装
        Ollama；聊天模型仍按上方配置使用。
      </p>
      <p className="field-hint">
        {status
          ? `${status.name} · ${Math.ceil(status.bytes / 1024 / 1024)} MB · 下载来源 Hugging Face`
          : '中文 BGE-small 量化模型 · 约 24 MB · 下载来源 Hugging Face'}
      </p>
      <details>
        <summary>检索模型来源与许可</summary>
        <p className="field-hint">
          本应用使用 Xenova/bge-small-zh-v1.5 的固定量化版本，来源于
          BAAI/bge-small-zh-v1.5。原始模型卡标注
          MIT；量化版本的完整版权通知仍待核对，不能把运行库的许可当作模型许可。
        </p>
        <p className="field-hint">
          安装目录的 resources/third-party
          中保留当前已取得的许可全文、来源和待核对事项。聊天模型由你另行配置，适用各自的条款。
        </p>
      </details>
      <p className="field-hint">
        点击下载只获取模型文件，不上传资料。首次检索会在后台建立向量索引，可能需要等待；可取消，模型不可用时仍能关键词检索。
      </p>
      <p className="field-hint">
        Windows 本地语义检索需要 Microsoft Visual C++ v14
        运行库（x64）。首次使用请从微软官方下载并安装，完成后重启拾知。 官方下载地址：
        <code>https://aka.ms/vc14/vc_redist.x64.exe</code>。
        “模型文件已校验”只表示固定文件通过校验，推理是否成功以能力检查和检索结果为准。
      </p>
      <p role="status">
        {downloading
          ? (progress?.message ?? '正在准备下载…')
          : (status?.message ?? (isDesktop ? '正在检查本地模型…' : '请在桌面版下载检索模型。'))}
      </p>
      {downloading && progress && (
        <progress aria-label="模型下载进度" max={progress.total} value={progress.current} />
      )}
      <div
        className="connection-footer"
        data-motion="state"
        data-motion-key={downloading ? 'downloading' : status?.state}
      >
        {downloading ? (
          <button
            type="button"
            className="button secondary"
            onClick={() =>
              void desktop
                .cancelEmbeddingDownload()
                .catch((error) => setNotice(errorMessage(error)))
            }
          >
            <Square size={15} />
            取消模型下载
          </button>
        ) : (
          <button
            type="button"
            className="button secondary"
            disabled={!isDesktop || !status || status.state === 'ready'}
            onClick={() => void download()}
          >
            <Download size={16} />
            {status?.state === 'ready' ? '模型文件已校验' : '下载检索模型'}
          </button>
        )}
        {downloading && <LoaderCircle size={16} className="spin" aria-hidden="true" />}
      </div>
      {notice && (
        <p className="field-hint" role="status" data-motion="fade" data-motion-key={notice}>
          {notice}
        </p>
      )}
    </section>
  );
}
