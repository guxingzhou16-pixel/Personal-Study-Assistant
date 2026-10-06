import { useEffect, useMemo, useState } from 'react';
import type { ChatTurn, PracticeItem } from '../lib/types';
import { parsePractice, practiceLabels, practiceLimits } from '../lib/practice';
import './PracticeResult.css';

export function PracticeResult({
  turn,
  onOpenCitation,
}: {
  turn: ChatTurn;
  onOpenCitation: (number: number) => void;
}) {
  const [answers, setAnswers] = useState<string[]>([]);
  const [revealed, setRevealed] = useState<boolean[]>([]);
  useEffect(() => {
    setAnswers([]);
    setRevealed([]);
  }, [turn.id, turn.revision]);
  const parsed = useMemo((): { items: PracticeItem[]; error: string } => {
    if (turn.status !== 'completed' || !turn.evidence.length) return { items: [], error: '' };
    try {
      return { items: parsePractice(turn.answer, turn.evidence), error: '' };
    } catch (error) {
      return { items: [], error: error instanceof Error ? error.message : '练习结构无效。' };
    }
  }, [turn.status, turn.answer, turn.evidence]);
  if (!turn.practiceRequest) return null;
  if (!turn.evidence.length) return <p className="practice-text">{turn.answer}</p>;
  const quiz = turn.practiceRequest.kind === 'quiz';
  return (
    <section className="practice-result" aria-label={practiceLabels[turn.practiceRequest.kind]}>
      <p className="field-hint">
        先回忆，再对照参考答案和原文。出处编号有效不等于答案正确，不记录分数或掌握程度。
      </p>
      {quiz && (
        <p className="field-hint">
          作答只留在当前界面；切换会话、重载或关闭可能丢失，不自动保存或发送给模型。
        </p>
      )}
      {parsed.items.map((item, index) => {
        const answerId = `practice-${turn.id}-${index}`;
        return (
          <article className="practice-item" key={index}>
            <h3>{quiz ? '第' + (index + 1) + '题' : '卡片 ' + (index + 1)}</h3>
            <p className="practice-text">{item.question}</p>
            {quiz && (
              <label>
                第 {index + 1} 题 · 我的作答
                <textarea
                  value={answers[index] ?? ''}
                  maxLength={practiceLimits.answer}
                  placeholder="先用自己的话写出要点…"
                  onChange={(event) =>
                    setAnswers((previous) => {
                      const next = [...previous];
                      next[index] = event.target.value;
                      return next;
                    })
                  }
                />
              </label>
            )}
            <button
              type="button"
              className="button secondary"
              aria-expanded={Boolean(revealed[index])}
              aria-controls={answerId}
              onClick={() =>
                setRevealed((previous) => {
                  const next = [...previous];
                  next[index] = !next[index];
                  return next;
                })
              }
            >
              {revealed[index] ? '收起参考答案' : quiz ? '对照参考答案' : '翻面查看答案'}
            </button>
            <div id={answerId} hidden={!revealed[index]}>
              <h4>参考答案</h4>
              <p className="practice-text">{item.answer}</p>
              <div className="practice-citations" aria-label={`第 ${index + 1} 项答案依据`}>
                {item.citations.map((number) => (
                  <button
                    type="button"
                    className="citation-link"
                    key={number}
                    onClick={() => onOpenCitation(number)}
                  >
                    查看出处 [{number}]
                  </button>
                ))}
              </div>
            </div>
          </article>
        );
      })}
      {!parsed.items.length && (
        <p role="status">
          {turn.status === 'streaming'
            ? '正在生成练习，结构校验完成后才提供卡片或题目。'
            : `练习未完成，不能作为有效题目使用。${parsed.error}`}
        </p>
      )}
      <details className="practice-raw">
        <summary>查看原始模型输出</summary>
        <pre>{turn.answer || '尚无输出。'}</pre>
      </details>
    </section>
  );
}
