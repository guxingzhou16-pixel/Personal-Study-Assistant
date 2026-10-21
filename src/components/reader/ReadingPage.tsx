import { useCallback, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  List,
  LoaderCircle,
  Sun,
  MessageCircle,
  NotebookPen,
} from 'lucide-react';
import { desktop, errorMessage } from '../../lib/desktop';
import type {
  OpenDocument,
  ReadingPosition,
  CitationTarget,
  ReadingSelection,
} from '../../lib/types';
import { PdfPage } from './PdfPage';

function heading(level: number) {
  return function MarkdownHeading({
    node,
    children,
  }: {
    node?: { position?: { start: { line: number } } };
    children?: React.ReactNode;
  }) {
    const Tag = `h${level}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
    return (
      <Tag id={`md-line-${node?.position?.start.line ?? 1}`} data-reading-heading>
        {children}
      </Tag>
    );
  };
}
const headingComponents = {
  h1: heading(1),
  h2: heading(2),
  h3: heading(3),
  h4: heading(4),
  h5: heading(5),
  h6: heading(6),
};

export function ReadingPage({
  id,
  onBack,
  target,
  backLabel = '返回资料库',
  onAsk,
  onTakeNote,
  restorePosition,
  onPosition,
}: {
  id: string;
  onBack: () => void;
  target?: CitationTarget;
  backLabel?: string;
  onAsk: (selection?: ReadingSelection) => void;
  onTakeNote: (selection?: ReadingSelection) => void;
  restorePosition?: ReadingPosition;
  onPosition?: (position: ReadingPosition) => void;
}) {
  const [document, setDocument] = useState<OpenDocument | null>(null);
  const [position, setPosition] = useState<ReadingPosition>({
    page: 1,
    anchor: '',
    offset: 0,
    zoom: 1,
    tone: 'paper',
  });
  const [error, setError] = useState('');
  const [saveState, setSaveState] = useState('阅读位置已保存');
  const [toc, setToc] = useState(true);
  const [quote, setQuote] = useState<{ text: string; anchor: string } | null>(null);
  const [copyStatus, setCopyStatus] = useState('');
  const scroll = useRef<HTMLDivElement>(null);
  const latest = useRef(position);
  const ready = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pending = useRef<Promise<void>>(Promise.resolve());
  const alive = useRef(true);
  const save = useCallback(
    (value: ReadingPosition) => {
      setSaveState('正在保存阅读位置…');
      pending.current = pending.current
        .catch(() => {})
        .then(() => desktop.saveReadingPosition(id, value));
      void pending.current
        .then(() => {
          if (alive.current) setSaveState('阅读位置已保存');
        })
        .catch((reason) => {
          if (alive.current) setSaveState(`保存失败：${errorMessage(reason)}`);
        });
      return pending.current;
    },
    [id],
  );
  function update(value: ReadingPosition) {
    latest.current = value;
    onPosition?.(value);
    setPosition(value);
    setQuote(null);
    setCopyStatus('');
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(value), 300);
    setSaveState('正在保存阅读位置…');
  }
  useEffect(() => {
    alive.current = true;
    void desktop
      .openSource(id)
      .then((value) => {
        if (!alive.current) return;
        if (target || restorePosition)
          value = {
            ...value,
            source: {
              ...value.source,
              position: {
                ...value.source.position,
                ...(restorePosition ?? { page: target!.page, anchor: target!.anchor, offset: 0 }),
              },
            },
          };
        latest.current = value.source.position;
        onPosition?.(value.source.position);
        setPosition(value.source.position);
        setDocument(value);
      })
      .catch((reason) => {
        if (alive.current) setError(errorMessage(reason));
      });
    return () => {
      alive.current = false;
      clearTimeout(timer.current);
      if (ready.current) void save(latest.current);
    };
  }, [id, save, target, restorePosition]);
  useEffect(() => {
    if (!document || !scroll.current) return;
    const root = scroll.current;
    const target = root.querySelector<HTMLElement>(`[id="${document.source.position.anchor}"]`);
    if (document.source.kind === 'markdown') {
      if (target)
        root.scrollTop +=
          target.getBoundingClientRect().top -
          root.getBoundingClientRect().top +
          document.source.position.offset;
      else root.scrollTop = document.source.position.offset;
    }
    ready.current = true;
  }, [document]);
  async function leave(action: () => void) {
    clearTimeout(timer.current);
    try {
      if (ready.current) await save(latest.current);
      if (alive.current) action();
    } catch {
      /* Keep the reader open with its save error so the user can retry. */
    }
  }
  function scrollPosition() {
    if (!ready.current || document?.source.kind !== 'markdown' || !scroll.current) return;
    const root = scroll.current;
    const headings = Array.from(root.querySelectorAll<HTMLElement>('[data-reading-heading]'));
    let heading = headings[0];
    for (const candidate of headings) {
      if (candidate.getBoundingClientRect().top <= root.getBoundingClientRect().top + 28)
        heading = candidate;
      else break;
    }
    const anchor = heading?.id ?? 'md-line-1';
    const offset = heading
      ? Math.max(0, root.getBoundingClientRect().top - heading.getBoundingClientRect().top)
      : root.scrollTop;
    update({ ...latest.current, anchor, offset });
  }
  function jump(anchor: string, page?: number) {
    if (document?.source.kind === 'pdf') {
      update({ ...latest.current, page: page ?? 1, anchor, offset: 0 });
      scroll.current?.scrollTo(0, 0);
      return;
    }
    const root = scroll.current;
    const target = root?.querySelector<HTMLElement>(`[id="${anchor}"]`);
    if (root && target) {
      root.scrollTop += target.getBoundingClientRect().top - root.getBoundingClientRect().top - 20;
      update({ ...latest.current, anchor, offset: 0 });
    }
  }
  function selectQuote() {
    const selection = window.getSelection();
    const root = scroll.current;
    const text = selection?.toString().trim();
    if (
      !text ||
      !root ||
      !selection?.anchorNode ||
      !selection.focusNode ||
      !root.contains(selection.anchorNode) ||
      !root.contains(selection.focusNode)
    ) {
      setQuote(null);
      return;
    }
    let anchor = `page-${position.page}`;
    if (document?.source.kind === 'markdown') {
      const headings = Array.from(root.querySelectorAll<HTMLElement>('[data-reading-heading]'));
      const start = selection.getRangeAt(0).getBoundingClientRect().top;
      const previous = headings
        .filter((heading) => heading.getBoundingClientRect().top <= start + 2)
        .at(-1);
      anchor = previous?.id ?? 'md-line-1';
    }
    setQuote({ text, anchor });
    setCopyStatus('');
  }
  async function copyQuote() {
    if (!quote) return;
    try {
      await desktop.copyCitation(id, quote.anchor, quote.text);
      setCopyStatus('引用已复制，包含资料位置。');
    } catch (reason) {
      setCopyStatus(errorMessage(reason));
    }
  }
  async function useQuote(action: (selection: ReadingSelection) => void) {
    if (!quote) return;
    try {
      const selected = await desktop.readSelection(id, quote.anchor, quote.text);
      if (!alive.current) return;
      await leave(() => action(selected));
    } catch (reason) {
      setCopyStatus(errorMessage(reason));
    }
  }
  if (!document)
    return (
      <div className="center-state" role={error ? 'alert' : 'status'}>
        {error ? (
          <>
            <p>{error}</p>
            <button className="button secondary" onClick={onBack}>
              {backLabel}
            </button>
          </>
        ) : (
          <>
            <LoaderCircle className="spin" size={24} />
            <p>正在打开你的资料…</p>
          </>
        )}
      </div>
    );
  const source = document.source;
  return (
    <section
      className={`reader ${position.tone === 'warm' ? 'reader-warm' : ''}`}
      aria-label={`阅读 ${source.name}`}
    >
      <header className="reader-header">
        <button className="icon-button" aria-label={backLabel} onClick={() => void leave(onBack)}>
          <ArrowLeft size={18} />
        </button>
        <div>
          <strong className="reader-title">{source.name}</strong>
          <p>{source.kind === 'pdf' ? 'PDF 原页阅读' : 'Markdown 舒适阅读'} · 本机资料</p>
        </div>
        <span className="reader-save" role="status">
          <Check size={13} />
          {saveState}
        </span>
        <button className="button secondary reader-ask" onClick={() => void leave(() => onAsk())}>
          <MessageCircle size={16} />
          问这份资料
        </button>
      </header>
      <div className="reader-toolbar">
        <button className="toolbar-button" aria-pressed={toc} onClick={() => setToc(!toc)}>
          <List size={16} />
          目录
        </button>
        <button className="toolbar-button" onClick={() => void leave(() => onTakeNote())}>
          <NotebookPen size={16} />
          记笔记
        </button>
        {source.kind === 'pdf' && (
          <div className="page-controls">
            <button
              className="icon-button"
              aria-label="上一页"
              disabled={position.page <= 1}
              onClick={() => jump(`page-${position.page - 1}`, position.page - 1)}
            >
              <ChevronLeft size={18} />
            </button>
            <input
              type="number"
              aria-label="PDF 页码"
              min={1}
              max={source.pageCount}
              value={position.page}
              onChange={(event) => {
                const next = Number(event.target.value);
                if (Number.isInteger(next) && next >= 1 && next <= source.pageCount)
                  jump(`page-${next}`, next);
              }}
            />
            <span>/ {source.pageCount}</span>
            <button
              className="icon-button"
              aria-label="下一页"
              disabled={position.page >= source.pageCount}
              onClick={() => jump(`page-${position.page + 1}`, position.page + 1)}
            >
              <ChevronRight size={18} />
            </button>
            <select
              aria-label="PDF 缩放"
              value={position.zoom}
              onChange={(event) => update({ ...position, zoom: Number(event.target.value) })}
            >
              {[0.75, 1, 1.25, 1.5, 2].map((value) => (
                <option key={value} value={value}>
                  {value === 1 ? '适合宽度' : `${value * 100}%`}
                </option>
              ))}
            </select>
          </div>
        )}
        <button
          className="toolbar-button tone-button"
          aria-pressed={position.tone === 'warm'}
          onClick={() => update({ ...position, tone: position.tone === 'warm' ? 'paper' : 'warm' })}
        >
          <Sun size={16} />
          护眼
        </button>
      </div>
      {source.textStatus === 'none' && source.kind === 'pdf' && (
        <p className="reader-notice">这份 PDF 没有可提取文字，可以阅读原页；OCR 和检索暂不可用。</p>
      )}
      {source.textStatus === 'partial' && (
        <p className="reader-notice">部分页面没有可提取文字；这些页可阅读原页，OCR 暂不可用。</p>
      )}
      <div className="reader-body">
        {toc && (
          <aside className="reader-outline" aria-label="资料目录">
            <p className="small-label">阅读路线</p>
            <nav>
              {source.outline.map((entry, index) => (
                <button
                  key={`${entry.anchor}-${index}`}
                  className={
                    position.anchor === entry.anchor ||
                    (source.kind === 'pdf' && position.page === entry.page)
                      ? 'active'
                      : ''
                  }
                  style={{ paddingLeft: 12 + Math.min(entry.depth - 1, 4) * 12 }}
                  onClick={() => jump(entry.anchor, entry.page)}
                >
                  {entry.title}
                </button>
              ))}
            </nav>
          </aside>
        )}
        <div
          className="reader-scroll"
          ref={scroll}
          onScroll={scrollPosition}
          onMouseUp={selectQuote}
          onKeyUp={selectQuote}
          tabIndex={0}
          aria-label="资料正文"
        >
          {source.kind === 'pdf' && document.data ? (
            <PdfPage data={document.data} page={position.page} zoom={position.zoom} />
          ) : (
            <article className="markdown-reading">
              <ReactMarkdown
                skipHtml
                remarkPlugins={[remarkGfm]}
                components={{
                  ...headingComponents,
                  img: () => <span className="blocked-image">远程图片已阻止加载</span>,
                  a: ({ href, children }) =>
                    href?.startsWith('#') ? (
                      <button className="inline-link" onClick={() => jump(href.slice(1))}>
                        {children}
                      </button>
                    ) : (
                      <span className="external-reference" title="外部链接不会自动打开">
                        {children}
                        <small aria-hidden="true" />
                      </span>
                    ),
                }}
              >
                {document.text}
              </ReactMarkdown>
            </article>
          )}
        </div>
      </div>
      <footer className="reader-selection">
        <span>{quote ? `已选中 ${quote.text.length} 字` : '选中一段原文，为理解留下出处。'}</span>
        <button className="text-button" disabled={!quote} onClick={() => void copyQuote()}>
          <Copy size={14} />
          复制引用
        </button>
        <button className="text-button" disabled={!quote} onClick={() => void useQuote(onAsk)}>
          <MessageCircle size={14} />
          提问选中原文
        </button>
        <button className="text-button" disabled={!quote} onClick={() => void useQuote(onTakeNote)}>
          <NotebookPen size={14} />
          加入笔记草稿
        </button>
        <span role="status">{copyStatus}</span>
      </footer>
    </section>
  );
}
