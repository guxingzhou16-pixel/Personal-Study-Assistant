import type { Evidence } from '../lib/types';

export function EvidenceCards({
  hits,
  onOpen,
}: {
  hits: Evidence[];
  onOpen?: (number: number) => void;
}) {
  return (
    <ol className="evidence-list" aria-label="检索到的原文证据">
      {hits.map((hit) => (
        <li key={hit.number}>
          <div className="evidence-location">
            <strong>
              [{hit.number}] {hit.sourceName}
            </strong>
            <span>
              {hit.kind === 'pdf' ? `第 ${hit.page} 页` : `${hit.title} · 第 ${hit.line} 行`}
            </span>
            {onOpen && (
              <button
                type="button"
                className="text-button"
                aria-label={`打开证据 ${hit.number}`}
                onClick={() => onOpen(hit.number)}
              >
                查看原文
              </button>
            )}
          </div>
          <details>
            <summary>
              {hit.text.slice(0, 95)}
              {hit.text.length > 95 ? '…' : ''}
            </summary>
            <p>{hit.text}</p>
          </details>
        </li>
      ))}
    </ol>
  );
}
