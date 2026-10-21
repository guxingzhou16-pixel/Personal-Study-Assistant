import { useEffect, useRef, useState } from 'react';
import { desktop, errorMessage, isDesktop } from '../../lib/desktop';
import type { StudyReview } from '../../lib/types';
import './ReviewsPage.css';

export function ReviewsPage({
  visible,
  onCitation,
}: {
  visible: boolean;
  onCitation: (id: string, number: number) => Promise<void>;
}) {
  const [records, setRecords] = useState<StudyReview[]>([]);
  const [current, setCurrent] = useState<StudyReview | null>(null);
  const [response, setResponse] = useState('');
  const [question, setQuestion] = useState(false);
  const [day, setDay] = useState('');
  const [recalling, setRecalling] = useState(false);
  const [reference, setReference] = useState(false);
  const [previous, setPrevious] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [latest, setLatest] = useState<StudyReview | null>(null);
  const version = useRef(0);
  const dirty =
    current &&
    (response !== current.response ||
      question !== current.hasQuestion ||
      day !== (current.reviewDay ?? ''));
  useEffect(() => {
    if (!visible || !isDesktop) return;
    let cancelled = false;
    void desktop
      .listReviews(null)
      .then((items) => {
        if (!cancelled) setRecords(items);
      })
      .catch((reason) => {
        if (!cancelled) setNotice(errorMessage(reason));
      });
    return () => {
      cancelled = true;
    };
  }, [visible]);
  async function open(id: string) {
    if (dirty && !window.confirm('当前复习输入未保存。放弃这次输入并打开另一条？')) return;
    const expected = ++version.current;
    setBusy(true);
    setNotice('');
    try {
      const item = await desktop.getReview(id);
      if (expected !== version.current) return;
      setCurrent(item);
      setLatest(null);
      setResponse(item.response);
      setQuestion(item.hasQuestion);
      setDay(item.reviewDay ?? '');
      setRecalling(false);
      setReference(false);
      setPrevious(false);
    } catch (reason) {
      setNotice(errorMessage(reason));
    } finally {
      if (expected === version.current) setBusy(false);
    }
  }
  async function save() {
    if (!current || busy) return;
    setBusy(true);
    setNotice('');
    try {
      const item = await desktop.saveReview({
        turnId: current.turnId,
        itemIndex: current.itemIndex,
        revision: current.revision,
        response,
        hasQuestion: question,
        reviewDay: day || null,
      });
      setCurrent(item);
      setLatest(null);
      setResponse(item.response);
      setRecords(await desktop.listReviews(null));
      setNotice('这份作答和复习安排已保存，没有评分或掌握判断。');
    } catch (reason) {
      setNotice(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  }
  async function readLatest() {
    if (!current || busy) return;
    const expected = ++version.current;
    setBusy(true);
    setNotice('');
    setLatest(null);
    try {
      const item = await desktop.getReview(current.id);
      if (expected !== version.current) return;
      setLatest(item);
      setRecords((items) => items.map((record) => (record.id === item.id ? item : record)));
    } catch (reason) {
      if (expected === version.current) setNotice(errorMessage(reason));
    } finally {
      if (expected === version.current) setBusy(false);
    }
  }
  function acceptLatest(replaceInput: boolean) {
    if (!latest || latest.id !== current?.id || busy) return;
    setCurrent(latest);
    if (replaceInput) {
      setResponse(latest.response);
      setQuestion(latest.hasQuestion);
      setDay(latest.reviewDay ?? '');
    }
    setRecalling(true);
    setLatest(null);
    setNotice(
      replaceInput
        ? '已载入最新保存内容。'
        : '当前输入已保留；再次保存时将替换最新作答与安排，请先核对。',
    );
  }
  return (
    <section className="page reviews-page" aria-label="轻量复习">
      <h1>轻量复习与疑问</h1>
      <p className="muted">
        先尝试回忆，再查看上次作答、参考答案和出处。日期由你安排，不自动判断掌握。
      </p>
      <p className="field-hint">
        保存内容进入本机和完整备份；导出包含作答、参考答案及原文。这里不发送给模型。未保存输入关闭时可能丢失。
      </p>
      {notice && <p role="status">{notice}</p>}
      <div className="reviews-workspace">
        <aside aria-label="已保存作答">
          {records.map((item) => (
            <button
              key={item.id}
              className="review-list-item"
              disabled={busy}
              aria-current={item.id === current?.id ? 'true' : undefined}
              onClick={() => void open(item.id)}
            >
              <strong>{item.question}</strong>
              <span>
                {item.hasQuestion ? '仍有疑问 · ' : ''}
                {item.reviewDay ?? '未安排日期'}
              </span>
            </button>
          ))}
          {!records.length && <p>还没有保存作答。可以在短测验中选择保存某道题。</p>}
        </aside>
        {current && (
          <article className="review-editor">
            <h2>{current.question}</h2>
            <button className="text-button" disabled={busy} onClick={() => void readLatest()}>
              读取最新作答（保留当前输入）
            </button>
            {latest && (
              <section className="review-latest" aria-label="最新已保存作答">
                <p>当前输入仍保留。请比较后选择如何继续；读取不会自动保存。</p>
                <p className="review-text">{latest.response || '尚未填写作答。'}</p>
                <small>
                  {latest.hasQuestion ? '仍有疑问' : '未标记疑问'} ·{' '}
                  {latest.reviewDay ?? '未安排日期'}
                </small>
                <div className="agent-actions">
                  <button
                    className="button secondary"
                    disabled={busy}
                    onClick={() => acceptLatest(true)}
                  >
                    使用最新作答替换本页输入
                  </button>
                  <button
                    className="button secondary"
                    disabled={busy}
                    onClick={() => acceptLatest(false)}
                  >
                    保留当前输入，使用最新版本继续编辑
                  </button>
                </div>
              </section>
            )}
            {!recalling && (
              <button
                className="button primary"
                disabled={busy}
                onClick={() => {
                  setRecalling(true);
                  setResponse('');
                }}
              >
                开始这次回忆
              </button>
            )}
            {recalling && (
              <label>
                这次的回忆与作答
                <textarea
                  aria-label="这次的回忆与作答"
                  value={response}
                  disabled={busy}
                  maxLength={2000}
                  rows={6}
                  onChange={(event) => setResponse(event.target.value)}
                />
              </label>
            )}
            <button
              className="text-button"
              aria-expanded={previous}
              onClick={() => setPrevious(!previous)}
            >
              查看上次保存的作答
            </button>
            {previous && <p className="review-text">{current.response || '上次尚未填写作答。'}</p>}
            <button
              className="button secondary"
              aria-expanded={reference}
              onClick={() => setReference(!reference)}
            >
              查看参考答案与出处
            </button>
            {reference && (
              <div>
                <h3>参考答案（AI生成，需核对）</h3>
                <p className="review-text">{current.referenceAnswer}</p>
                {current.citations.map((number) => (
                  <button
                    className="citation-link"
                    key={number}
                    onClick={() =>
                      void onCitation(current.id, number).catch((reason) =>
                        setNotice(errorMessage(reason)),
                      )
                    }
                  >
                    复习出处 [{number}]
                  </button>
                ))}
              </div>
            )}
            <label>
              <input
                type="checkbox"
                checked={question}
                disabled={busy}
                onChange={(event) => setQuestion(event.target.checked)}
              />
              仍有疑问
            </label>
            <label>
              安排复习日期
              <input
                type="date"
                value={day}
                disabled={busy}
                onChange={(event) => setDay(event.target.value)}
              />
            </label>
            <button className="button primary" disabled={busy} onClick={() => void save()}>
              保存作答与复习安排
            </button>
            <p className="field-hint">明确保存后替换这道题的上一份作答；取消或离开不产生写入。</p>
            <button
              className="text-button"
              disabled={busy}
              onClick={() =>
                void desktop
                  .exportReview(current.id, current.revision)
                  .then((result) =>
                    setNotice(result.cancelled ? '导出已取消。' : '已导出 ' + result.fileName),
                  )
                  .catch((reason) => setNotice(errorMessage(reason)))
              }
            >
              导出已保存作答（不含未保存输入）
            </button>
          </article>
        )}
      </div>
    </section>
  );
}
