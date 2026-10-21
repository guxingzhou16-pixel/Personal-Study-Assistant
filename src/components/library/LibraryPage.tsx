import { useEffect, useState } from 'react';
import {
  BookOpen,
  FileText,
  FolderOpen,
  LoaderCircle,
  Plus,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { desktop, errorMessage, isDesktop } from '../../lib/desktop';
import type { ImportProgress, ImportReport, Source } from '../../lib/types';

export function LibraryPage({ onOpen }: { onOpen: (id: string) => void }) {
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState('all');
  async function refresh() {
    setSources(isDesktop ? await desktop.listSources() : []);
  }
  useEffect(() => {
    let alive = true;
    if (!isDesktop) {
      setLoading(false);
      return;
    }
    void desktop
      .listSources()
      .then((data) => {
        if (alive) setSources(data);
      })
      .catch((reason) => {
        if (alive) setError(errorMessage(reason));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    const unsubscribe = desktop.onImportProgress(setProgress);
    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);
  async function importFiles() {
    setBusy(true);
    setError('');
    setReport(null);
    setProgress(null);
    try {
      setReport(await desktop.importSources());
      await refresh();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }
  const filtered = sources.filter(
    (source) =>
      (kind === 'all' || source.kind === kind) &&
      source.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  );
  return (
    <div className="page library-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">A PLACE FOR YOUR CURIOSITY</p>
          <h1>我的资料库</h1>
          <p className="muted">把想读懂的资料放在一起，慢慢建立自己的知识。</p>
        </div>
        <button
          className="button primary"
          disabled={!isDesktop || busy}
          onClick={() => void importFiles()}
        >
          <Plus size={16} />
          导入资料
        </button>
      </div>
      <div className="library-note">
        <ShieldCheck size={18} />
        <p>
          资料复制到本机，阅读无需网络。支持 PDF（50 MB 内）与 UTF-8 Markdown（5 MB 内），每次最多
          20 份。
        </p>
      </div>
      {busy && (
        <div className="import-progress" role="status">
          <LoaderCircle className="spin" size={18} />
          <div>
            <strong>
              {progress
                ? `${progress.current} / ${progress.total} · ${progress.file}`
                : '请选择学习资料'}
            </strong>
            <p>{progress?.message ?? '原文件会保留在原位置。'}</p>
          </div>
          <button
            className="text-button"
            onClick={() =>
              void desktop.cancelImport().catch((reason) => setError(errorMessage(reason)))
            }
          >
            取消导入
          </button>
        </div>
      )}
      {report && (
        <div className="import-report" role="status">
          <p>
            {report.cancelled
              ? `导入已取消：已完成 ${report.added} 份，${report.duplicates} 份重复。`
              : `导入完成：${report.added} 份新增，${report.duplicates} 份重复，${report.failures.length} 份失败。`}
          </p>
          {report.failures.length > 0 && (
            <ul>
              {report.failures.map((item, index) => (
                <li key={index}>
                  <strong>{item.file}</strong>：{item.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {error && (
        <div className="feedback error" role="alert">
          {error}
          <button
            className="text-button"
            onClick={() =>
              void refresh()
                .then(() => setError(''))
                .catch((reason) => setError(errorMessage(reason)))
            }
          >
            重新加载资料库
          </button>
        </div>
      )}
      {loading ? (
        <p role="status" className="muted">
          正在整理资料…
        </p>
      ) : sources.length === 0 ? (
        <section className="library-empty">
          <div className="library-symbol">
            <BookOpen size={38} strokeWidth={1.3} />
          </div>
          <h2>第一份资料，值得一个安静的位置</h2>
          <p>选一份 PDF 或 Markdown，从一个好奇的问题开始。</p>
          <div className="format-tags">
            <span>
              <FileText size={15} />
              PDF 原页阅读
            </span>
            <span>
              <FileText size={15} />
              Markdown 舒适排版
            </span>
          </div>
          {!isDesktop && <p className="field-hint">请启动桌面版，使用本地资料导入。</p>}
        </section>
      ) : (
        <>
          <div className="library-filters">
            <label className="source-search">
              <Search size={17} />
              <input
                aria-label="搜索资料"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="找到想读的那一份…"
              />
            </label>
            <select
              aria-label="资料类型"
              value={kind}
              onChange={(event) => setKind(event.target.value)}
            >
              <option value="all">全部格式</option>
              <option value="pdf">PDF</option>
              <option value="markdown">Markdown</option>
            </select>
            <span>{filtered.length} 份资料</span>
          </div>
          <div className="source-list">
            {filtered.map((source) => (
              <article className="source-card" key={source.id}>
                <div className={`source-icon ${source.kind}`}>
                  <FileText size={24} />
                  <span>{source.kind === 'pdf' ? 'PDF' : 'MD'}</span>
                </div>
                <div className="source-description">
                  <h2>{source.name}</h2>
                  <p>
                    {source.kind === 'pdf'
                      ? `${source.pageCount} 页`
                      : `${source.outline.length} 个目录位置`}{' '}
                    · {(source.bytes / 1024).toFixed(1)} KB ·{' '}
                    {source.textStatus === 'none' ? '仅原页阅读' : '已提取文字'}
                  </p>
                  <span>
                    {source.openedAt
                      ? source.kind === 'pdf'
                        ? `读到第 ${source.position.page} 页`
                        : `读到「${source.outline.find((entry) => entry.anchor === source.position.anchor)?.title ?? '文档开头'}」`
                      : '等你翻开第一页'}
                  </span>
                </div>
                <button
                  className="button secondary"
                  aria-label={`阅读 ${source.name}`}
                  onClick={() => onOpen(source.id)}
                >
                  <BookOpen size={16} />
                  {source.openedAt ? '继续阅读' : '开始阅读'}
                </button>
              </article>
            ))}
          </div>
          {filtered.length === 0 && (
            <div className="empty-reading">
              <FolderOpen size={28} />
              <p>没有找到匹配的资料，换个关键词试试。</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
