import { useEffect, useState } from 'react';
import { ArrowRight, NotebookPen, Sparkles } from 'lucide-react';
import { desktop, errorMessage, isDesktop } from '../../lib/desktop';
import type { ChatTurn, NoteSummary } from '../../lib/types';
import './HomeStudy.css';

const routeStatus: Record<ChatTurn['status'], string> = {
  streaming: '正在起草',
  completed: '草稿已保存',
  stopped: '已停止，保留部分草稿',
  interrupted: '上次起草已中断',
  error: '草稿未完成',
};
function recordedAt(value: string) {
  return new Date(value).toLocaleString('zh-CN', {
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function HomeLearningSummary({
  paused,
  onOpenRoute,
  onOpenNote,
}: {
  paused: boolean;
  onOpenRoute: (id: string | null) => void;
  onOpenNote: (id: string | null) => void;
}) {
  const [notes, setNotes] = useState<NoteSummary[] | null>(null);
  const [routes, setRoutes] = useState<ChatTurn[] | null>(null);
  const [noteError, setNoteError] = useState('');
  const [routeError, setRouteError] = useState('');
  const [reload, setReload] = useState(0);
  useEffect(() => {
    if (!isDesktop || paused) return;
    return desktop.onChatUpdate((turn) => {
      if (turn.learningRequest && turn.status !== 'streaming')
        setReload((previous) => previous + 1);
    });
  }, [paused]);
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'visible') setReload((previous) => previous + 1);
    };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);
  useEffect(() => {
    let cancelled = false;
    setNotes(null);
    setRoutes(null);
    setNoteError('');
    setRouteError('');
    if (!isDesktop || paused) return;
    void Promise.allSettled([desktop.listNotes(), desktop.listLearningDrafts()]).then(
      ([savedNotes, savedRoutes]) => {
        if (cancelled) return;
        if (savedNotes.status === 'fulfilled')
          setNotes([...savedNotes.value].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
        else setNoteError(errorMessage(savedNotes.reason));
        if (savedRoutes.status === 'fulfilled')
          setRoutes([...savedRoutes.value].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
        else setRouteError(errorMessage(savedRoutes.reason));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [paused, reload]);
  const route = routes?.[0];
  const note = notes?.[0];
  const unavailable = !isDesktop
    ? '请在桌面版查看已保存的信息。'
    : paused
      ? '备份处理结束后会重新读取。'
      : '';

  return (
    <div className="home-learning-summary">
      <section className="learning-summary" aria-labelledby="home-route-title" data-motion="fade">
        <h3 id="home-route-title">
          <Sparkles size={17} aria-hidden="true" />
          学习路线
        </h3>
        {unavailable ? (
          <p role="status">{unavailable}</p>
        ) : routeError ? (
          <div>
            <p className="feedback error" role="alert">
              学习路线无法读取：{routeError}
            </p>
            <button className="text-button" onClick={() => setReload((previous) => previous + 1)}>
              重试读取学习路线
            </button>
          </div>
        ) : !routes ? (
          <p role="status">正在读取学习路线…</p>
        ) : route ? (
          <>
            <strong className="summary-title">
              {route.learningRequest?.goal ?? route.question}
            </strong>
            <p>
              {route.learningRequest
                ? `${route.learningRequest.minutes} 分钟预算`
                : '未记录时间预算'}{' '}
              · {routeStatus[route.status]}
            </p>
            <small>
              记录于 <time dateTime={route.createdAt}>{recordedAt(route.createdAt)}</time>
            </small>
          </>
        ) : (
          <p>还没有学习路线</p>
        )}
        <a
          className="text-button summary-link"
          href="#agent"
          onClick={(event) => {
            event.preventDefault();
            onOpenRoute(route?.id ?? null);
          }}
        >
          查看完整学习路线
          <ArrowRight size={14} aria-hidden="true" />
        </a>
      </section>
      <section className="learning-summary" aria-labelledby="home-notes-title" data-motion="fade">
        <h3 id="home-notes-title">
          <NotebookPen size={17} aria-hidden="true" />
          学习笔记
        </h3>
        {unavailable ? (
          <p role="status">{unavailable}</p>
        ) : noteError ? (
          <div>
            <p className="feedback error" role="alert">
              学习笔记无法读取：{noteError}
            </p>
            <button className="text-button" onClick={() => setReload((previous) => previous + 1)}>
              重试读取学习笔记
            </button>
          </div>
        ) : !notes ? (
          <p role="status">正在读取学习笔记…</p>
        ) : note ? (
          <>
            <strong className="summary-title">{note.title}</strong>
            <p>
              {note.sourceName ?? '未关联资料'} · 共 {notes.length} 份笔记
            </p>
            <small>
              更新于 <time dateTime={note.updatedAt}>{recordedAt(note.updatedAt)}</time>
            </small>
          </>
        ) : (
          <p>还没有学习笔记</p>
        )}
        <a
          className="text-button summary-link"
          href="#notes"
          onClick={(event) => {
            event.preventDefault();
            onOpenNote(note?.id ?? null);
          }}
        >
          查看完整学习笔记
          <ArrowRight size={14} aria-hidden="true" />
        </a>
      </section>
    </div>
  );
}
