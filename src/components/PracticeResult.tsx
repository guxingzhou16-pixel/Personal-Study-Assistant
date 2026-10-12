import { useEffect, useMemo, useState } from 'react';
import type { ChatTurn, PracticeItem, StudyReview } from '../lib/types';
import { desktop, errorMessage, isDesktop } from '../lib/desktop';
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
  const [saved, setSaved] = useState<StudyReview[]>([]);
  const [questions, setQuestions] = useState<boolean[]>([]);
  const [dates, setDates] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setAnswers([]);
    setRevealed([]);
    setSaved([]);
    setQuestions([]);
    setDates([]);
    setNotice('');
  }, [turn.id]);
  useEffect(() => {
    if (!isDesktop || turn.status !== 'completed' || turn.practiceRequest?.kind !== 'quiz') {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void desktop
      .listReviews(turn.id)
      .then((items) => {
        if (cancelled) return;
        setSaved(items);
        setAnswers((previous) => {
          const next = [...previous];
          for (const item of items) next[item.itemIndex] = item.response;
          return next;
        });
        setQuestions((previous) => {
          const next = [...previous];
          for (const item of items) next[item.itemIndex] = item.hasQuestion;
          return next;
        });
        setDates((previous) => {
          const next = [...previous];
          for (const item of items) next[item.itemIndex] = item.reviewDay ?? '';
          return next;
        });
      })
      .catch((reason) => {
        if (!cancelled) setNotice(errorMessage(reason));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [turn.id, turn.status]);
  async function saveResponse(index: number) {
    setSaving(true);
    setNotice('');
    try {
      const item = await desktop.saveReview({
        turnId: turn.id,
        itemIndex: index,
        revision: saved.find((item) => item.itemIndex === index)?.revision ?? 0,
        response: answers[index] ?? '',
        hasQuestion: questions[index] ?? false,
        reviewDay: dates[index] || null,
      });
      setSaved((previous) => [...previous.filter((entry) => entry.id !== item.id), item]);
      setNotice(`第 ${index + 1} 题的作答与安排已保存；没有评分或掌握判断。`);
    } catch (reason) {
      setNotice(errorMessage(reason));
    } finally {
      setSaving(false);
    }
  }
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
          作答默认只在窗口内；明确保存后，问题、参考答案、原文快照、你的作答、疑问和复习日期进入本机与完整备份。可单独导出；不发送作答给模型，不评分。未保存内容关闭时可能丢失。
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
                  aria-label={`第 ${index + 1} 题 · 我的作答`}
                  value={answers[index] ?? ''}
                  disabled={loading || saving}
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
            {quiz && (
              <div className="review-controls">
                <label>
                  <input
                    type="checkbox"
                    checked={questions[index] ?? false}
                    disabled={loading || saving}
                    onChange={(event) =>
                      setQuestions((previous) => {
                        const next = [...previous];
                        next[index] = event.target.checked;
                        return next;
                      })
                    }
                  />
                  第 {index + 1} 题仍有疑问
                </label>
                <label>
                  第 {index + 1} 题复习日期
                  <input
                    type="date"
                    value={dates[index] ?? ''}
                    disabled={loading || saving}
                    onChange={(event) =>
                      setDates((previous) => {
                        const next = [...previous];
                        next[index] = event.target.value;
                        return next;
                      })
                    }
                  />
                </label>
                <button
                  className="button secondary"
                  disabled={loading || saving}
                  onClick={() => void saveResponse(index)}
                >
                  保存第 {index + 1} 题作答与安排
                </button>
                {saved.some((item) => item.itemIndex === index) && (
                  <small>这道题已有保存记录；再次保存会替换该题作答和安排。</small>
                )}
              </div>
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
      {notice && <p role="status">{notice}</p>}
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
