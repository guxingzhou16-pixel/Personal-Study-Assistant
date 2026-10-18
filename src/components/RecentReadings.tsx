import { useEffect, useState } from 'react';
import { ArrowUpRight, BookOpen, FolderOpen } from 'lucide-react';
import { desktop, errorMessage, isDesktop } from '../lib/desktop';
import type { Source } from '../lib/types';

export function RecentReadings({ onOpen }: { onOpen: (id: string) => void }) {
  const [sources, setSources] = useState<Source[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    if (isDesktop)
      void desktop
        .listSources()
        .then((data) => {
          if (alive) setSources(data.filter((source) => source.openedAt).slice(0, 3));
        })
        .catch((reason) => {
          if (alive) setError(errorMessage(reason));
        });
    return () => {
      alive = false;
    };
  }, []);
  if (error)
    return (
      <p className="feedback error" role="alert">
        最近阅读无法加载：{error}
      </p>
    );
  if (!sources.length)
    return (
      <div className="empty-reading">
        <FolderOpen size={30} strokeWidth={1.4} />
        <h3>还没有阅读中的资料</h3>
        <p>导入一份资料，给今天留一个小小的开始。</p>
        <span>支持 PDF 和 Markdown</span>
      </div>
    );
  return (
    <div className="recent-list">
      {sources.map((source, index) => (
        <button
          type="button"
          className={`recent-document ${index === 0 ? 'recent-feature' : 'recent-row'}`}
          key={source.id}
          onClick={() => onOpen(source.id)}
        >
          {index === 0 ? (
            <span className="recent-cover" aria-hidden="true">
              <BookOpen size={22} strokeWidth={1.4} />
              <strong>{source.kind === 'pdf' ? 'PDF' : 'MD'}</strong>
              <span>继续探索</span>
            </span>
          ) : (
            <span className="recent-file-icon" aria-hidden="true">
              <BookOpen size={21} strokeWidth={1.5} />
            </span>
          )}
          <span className="recent-document-copy">
            <span className="recent-format">{source.kind === 'pdf' ? 'PDF' : 'Markdown'}</span>
            <strong>{source.name}</strong>
            <small>
              {source.kind === 'pdf'
                ? `第 ${source.position.page} / ${source.pageCount} 页`
                : (source.outline.find((entry) => entry.anchor === source.position.anchor)?.title ??
                  'Markdown')}
            </small>
            {index === 0 && (
              <span className="recent-continue">
                <ArrowUpRight size={19} aria-hidden="true" />
                继续阅读
              </span>
            )}
          </span>
          {index > 0 && <ArrowUpRight size={20} className="recent-row-arrow" aria-hidden="true" />}
        </button>
      ))}
    </div>
  );
}
