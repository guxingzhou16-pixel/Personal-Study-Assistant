import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ChatTurn } from '../lib/types';
import { citationNumber, remarkEvidence } from '../lib/citations';

export function ModelAnswer({
  turn,
  onOpenCitation,
}: {
  turn: ChatTurn;
  onOpenCitation: (number: number) => void;
}) {
  return (
    <ReactMarkdown
      remarkPlugins={turn.mode === 'sources' ? [remarkGfm, remarkEvidence] : [remarkGfm]}
      skipHtml
      urlTransform={(url) => (citationNumber(url, turn.evidence) !== null ? url : '')}
      components={{
        img: () => null,
        a: ({ href, children }) => {
          const number = citationNumber(href, turn.evidence);
          return number === null ? (
            <span>{children}</span>
          ) : (
            <button
              type="button"
              className="citation-link"
              aria-label={`引用 ${number}`}
              onClick={() => onOpenCitation(number)}
            >
              {children}
            </button>
          );
        },
      }}
    >
      {turn.answer || (turn.status === 'streaming' ? '正在等待模型回应…' : '本次没有收到回答。')}
    </ReactMarkdown>
  );
}
