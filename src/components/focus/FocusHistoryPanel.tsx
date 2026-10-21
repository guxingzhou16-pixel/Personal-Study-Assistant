import { useEffect, useId, useRef, useState } from 'react';
import { desktop, errorMessage, isDesktop } from '../../lib/desktop';
import { focusStatusLabels, focusTime } from '../../lib/focus';
import { validPlanningDay } from '../../lib/planning';
import type { FocusHistoryPage, FocusHistoryQuery, FocusSession } from '../../lib/types';
import './FocusHistoryPanel.css';

interface Props {
  visible: boolean;
  disabled: boolean;
  selectedId: string | null;
  refreshKey: string;
  onSelect(session: FocusSession): void;
}

function reviewExcerpt(review: string): string {
  const characters = Array.from(review.trim().replace(/\s+/g, ' '));
  if (!characters.length) return '尚未写复盘';
  return characters.slice(0, 120).join('') + (characters.length > 120 ? '…' : '');
}

export function FocusHistoryPanel({ visible, disabled, selectedId, refreshKey, onSelect }: Props) {
  const id = useId();
  const [expanded, setExpanded] = useState(false);
  const [inputDay, setInputDay] = useState('');
  const [query, setQuery] = useState<FocusHistoryQuery>({ day: null, page: 1 });
  const [result, setResult] = useState<FocusHistoryPage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const mounted = useRef(false);
  const generation = useRef(0);
  const currentView = useRef({ visible, expanded, disabled, query, refreshKey });
  currentView.current = { visible, expanded, disabled, query, refreshKey };
  const blocked = !isDesktop || disabled;
  const pages = result ? Math.max(1, Math.ceil(result.total / result.pageSize)) : 1;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      generation.current++;
    };
  }, []);

  useEffect(() => {
    const version = ++generation.current;
    setResult(null);
    setError('');
    if (!visible || !expanded || disabled || !isDesktop) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const current = () =>
      mounted.current &&
      version === generation.current &&
      currentView.current.visible &&
      currentView.current.expanded &&
      !currentView.current.disabled &&
      currentView.current.query === query &&
      currentView.current.refreshKey === refreshKey;
    void desktop.focusHistory(query).then(
      (page) => {
        if (!current()) return;
        setResult(page);
        setLoading(false);
      },
      (reason) => {
        if (!current()) return;
        setError(errorMessage(reason));
        setLoading(false);
      },
    );
    return () => {
      generation.current++;
    };
  }, [visible, expanded, disabled, query, refreshKey]);

  function request(next: FocusHistoryQuery) {
    generation.current++;
    setResult(null);
    setError('');
    setQuery({ ...next });
  }

  function toggle() {
    generation.current++;
    currentView.current.expanded = !expanded;
    setResult(null);
    setError('');
    setLoading(false);
    setExpanded(!expanded);
  }

  return (
    <section className="focus-full-history" aria-labelledby={`${id}-heading`}>
      <div className="focus-full-history-heading">
        <h2 id={`${id}-heading`}>专注历史与复盘</h2>
        <button
          type="button"
          className="button secondary"
          aria-expanded={expanded}
          aria-controls={`${id}-content`}
          onClick={toggle}
        >
          {expanded ? '收起全部记录' : '全部专注记录'}
        </button>
      </div>
      <div id={`${id}-content`} hidden={!expanded}>
        <p className="field-hint">
          回看已结束的专注，选择记录后在复盘区查看或编辑。按本机当前时区的开始日期筛选，
          跨日专注归入开始当天；活动中的专注不在这个列表中。
        </p>
        <form
          className="focus-full-history-filter"
          onSubmit={(event) => {
            event.preventDefault();
            if (blocked) return;
            if (inputDay && !validPlanningDay(inputDay)) {
              setError('请选择有效的开始日期。');
              return;
            }
            request({ day: inputDay || null, page: 1 });
          }}
        >
          <label htmlFor={`${id}-day`}>
            开始日期
            <input
              id={`${id}-day`}
              type="date"
              min="0001-01-01"
              max="9999-12-31"
              value={inputDay}
              disabled={blocked}
              onChange={(event) => setInputDay(event.target.value)}
            />
          </label>
          <button type="submit" className="button secondary" disabled={blocked}>
            应用筛选
          </button>
          <button
            type="button"
            className="text-button"
            disabled={blocked}
            onClick={() => {
              setInputDay('');
              request({ day: null, page: 1 });
            }}
          >
            全部日期
          </button>
          <button
            type="button"
            className="text-button"
            disabled={blocked || loading}
            onClick={() => request({ day: query.day, page: result?.page ?? query.page })}
          >
            {error ? '重新读取' : '刷新记录'}
          </button>
        </form>
        {error && (
          <p className="feedback error" role="alert">
            {error}
          </p>
        )}
        {!isDesktop && <p className="field-hint">请在桌面版读取专注记录。</p>}
        {isDesktop && disabled && (
          <p className="field-hint" role="status">
            当前操作结束后可以继续读取专注记录。
          </p>
        )}
        {loading && (
          <p className="field-hint" role="status">
            正在读取{query.day ? `开始于 ${query.day} 的` : '全部日期的'}专注记录…
          </p>
        )}
        {result && (
          <>
            <p className="focus-full-history-count" role="status">
              当前筛选：{result.day ? `开始日期 ${result.day}` : '全部日期'} · {result.total} 条
              已结束记录 · 第 {result.page} / {pages} 页 · 每页 {result.pageSize} 条
            </p>
            {!result.sessions.length && <p className="muted">当前筛选下没有专注记录。</p>}
            <ul className="focus-full-history-list" aria-label="已结束的专注记录">
              {result.sessions.map((session) => (
                <li key={session.id}>
                  <button
                    type="button"
                    className="focus-full-history-record"
                    aria-pressed={selectedId === session.id}
                    disabled={blocked || loading}
                    onClick={() => onSelect(session)}
                  >
                    <strong>{session.taskTitle}</strong>
                    <time dateTime={session.startedAt}>
                      开始：{new Date(session.startedAt).toLocaleString('zh-CN')}
                    </time>
                    <span>
                      {focusStatusLabels[session.status]} · 实际专注 {focusTime(session.elapsedMs)}
                      （分:秒）
                    </span>
                    <small>复盘：{reviewExcerpt(session.review)}</small>
                  </button>
                </li>
              ))}
            </ul>
            <nav className="focus-full-history-pagination" aria-label="专注记录分页">
              <button
                type="button"
                className="button secondary"
                disabled={blocked || loading || result.page <= 1}
                onClick={() => request({ day: result.day, page: result.page - 1 })}
              >
                上一页
              </button>
              <button
                type="button"
                className="button secondary"
                disabled={blocked || loading || result.page >= pages}
                onClick={() => request({ day: result.day, page: result.page + 1 })}
              >
                下一页
              </button>
            </nav>
          </>
        )}
      </div>
    </section>
  );
}
