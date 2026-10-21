import { useEffect, useRef, useState } from 'react';
import { Search, Send, Square, Settings2 } from 'lucide-react';
import { desktop, errorMessage, isDesktop } from '../../lib/desktop';
import { noteFeedbackLimits, noteSections } from '../../lib/notes';
import type {
  ChatTurn,
  NoteFeedbackPreview,
  RetrievalProgress,
  Settings,
  StudyNote,
} from '../../lib/types';
import { EvidenceCards } from '../shared/EvidenceCards';
import { ModelAnswer } from '../chat/ModelAnswer';
import { GenerationStatus } from '../shared/GenerationStatus';

const statusLabels: Record<ChatTurn['status'], string> = {
  streaming: '正在生成反馈…',
  completed: '反馈已保存',
  stopped: '已停止，保留部分反馈',
  error: '反馈未完成',
  interrupted: '上次反馈已中断',
};
function mergeTurn(turns: ChatTurn[], turn: ChatTurn): ChatTurn[] {
  const previous = turns.find((item) => item.id === turn.id);
  if (previous && previous.revision > turn.revision) return turns;
  return previous ? turns.map((item) => (item.id === turn.id ? turn : item)) : [...turns, turn];
}

function NoteSnapshot({ note, summary }: { note: StudyNote; summary: string }) {
  return (
    <details className="note-snapshot">
      <summary>{summary}</summary>
      <strong>{note.title}</strong>
      {noteSections.map(({ key, label }) => (
        <div key={key}>
          <h4>{label}</h4>
          <p>{note[key] || '（未填写）'}</p>
        </div>
      ))}
    </details>
  );
}

export function NoteFeedbackPanel({
  note,
  hasUnsavedChanges,
  disabled,
  settings,
  onSettings,
  onOpenCitation,
}: {
  note: StudyNote;
  hasUnsavedChanges: boolean;
  disabled: boolean;
  settings: Settings;
  onSettings: () => void;
  onOpenCitation: (turnId: string, number: number) => Promise<void>;
}) {
  const [question, setQuestion] = useState(note.title);
  const [preview, setPreview] = useState<NoteFeedbackPreview | null>(null);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [active, setActive] = useState<ChatTurn | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [searching, setSearching] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState<RetrievalProgress | null>(null);
  const [consentKey, setConsentKey] = useState<string | null>(null);
  const mounted = useRef(true);
  const seen = useRef(new Map<string, ChatTurn>());
  const currentNote = useRef({ revision: note.revision, dirty: hasUnsavedChanges });
  currentNote.current = { revision: note.revision, dirty: hasUnsavedChanges };
  const profile = settings[settings.provider];
  const signature = `${settings.provider}|${profile.baseUrl}|${profile.model}`;
  const confirmationKey = `${signature}|${preview?.evidence.id ?? ''}`;
  const consent = consentKey === confirmationKey;
  const remote = !['localhost', '127.0.0.1', '[::1]'].includes(new URL(profile.baseUrl).hostname);
  const needsModel = Boolean(preview?.evidence.hits.length);
  const previewValid = Boolean(
    preview &&
    preview.note.revision === note.revision &&
    preview.evidence.question === question.trim() &&
    !hasUnsavedChanges,
  );
  const selected = turns.find((turn) => turn.id === selectedId);
  const runningHere = active?.noteSnapshot?.id === note.id;

  function applyTurn(turn: ChatTurn) {
    if (turn.noteSnapshot?.id === note.id) {
      const old = seen.current.get(turn.id);
      if (old && old.revision > turn.revision) return;
      seen.current.set(turn.id, turn);
      setTurns((previous) => mergeTurn(previous, turn));
      setSelectedId((previous) => previous ?? turn.id);
    }
    setActive((previous) => {
      if (previous?.id === turn.id && previous.revision > turn.revision) return previous;
      return turn.status === 'streaming' ? turn : previous?.id === turn.id ? null : previous;
    });
  }

  useEffect(() => {
    mounted.current = true;
    if (!isDesktop) return;
    let cancelled = false;
    let events = 0;
    const stopUpdates = desktop.onChatUpdate((turn) => {
      events++;
      applyTurn(turn);
    });
    const stopProgress = desktop.onRetrievalProgress(setProgress);
    void Promise.allSettled([desktop.listNoteFeedback(note.id), desktop.activeChat()]).then(
      ([saved, running]) => {
        if (cancelled) return;
        const failures: string[] = [];
        if (saved.status === 'fulfilled') {
          let items = saved.value;
          for (const turn of seen.current.values()) items = mergeTurn(items, turn);
          setTurns(items);
          setSelectedId((previous) => previous ?? items.at(-1)?.id ?? null);
          setHistoryLoaded(true);
        } else failures.push(errorMessage(saved.reason));
        if (running.status === 'fulfilled') {
          // A live update can finish a request while the initial snapshot is in flight.
          if (!events) {
            setActive(running.value?.status === 'streaming' ? running.value : null);
            if (running.value?.noteSnapshot?.id === note.id) applyTurn(running.value);
          }
        } else failures.push(errorMessage(running.reason));
        if (failures.length) setError(failures.join(' '));
        setLoaded(true);
      },
    );
    return () => {
      cancelled = true;
      mounted.current = false;
      stopUpdates();
      stopProgress();
    };
  }, [note.id]);

  useEffect(() => {
    setPreview(null);
    setConsentKey(null);
  }, [note.revision, hasUnsavedChanges]);

  async function prepare() {
    if (searching || sending || disabled || hasUnsavedChanges) return;
    setSearching(true);
    setError('');
    setPreview(null);
    setConsentKey(null);
    setProgress(null);
    try {
      const result = await desktop.prepareNoteFeedback(note.id, note.revision, question);
      if (!mounted.current) return;
      if (currentNote.current.revision !== result.note.revision || currentNote.current.dirty)
        setError('笔记内容已变化，请保存后重新准备反馈。');
      else setPreview(result);
    } catch (reason) {
      if (mounted.current) setError(errorMessage(reason));
    } finally {
      if (mounted.current) {
        setSearching(false);
        setProgress(null);
      }
    }
  }
  async function generate() {
    if (
      !previewValid ||
      !preview ||
      active ||
      sending ||
      disabled ||
      (remote && needsModel && !consent)
    )
      return;
    setSending(true);
    setError('');
    try {
      const turn = await desktop.sendNoteFeedback({
        retrievalId: preview.evidence.id,
        expectedProfile: signature,
        ...(remote && consent ? { consentEndpoint: profile.baseUrl } : {}),
      });
      if (!mounted.current) return;
      applyTurn(seen.current.get(turn.id) ?? turn);
      setSelectedId(turn.id);
      setPreview(null);
      setConsentKey(null);
    } catch (reason) {
      if (mounted.current) setError(errorMessage(reason));
    } finally {
      if (mounted.current) setSending(false);
    }
  }
  async function stop() {
    if (!active || !runningHere) return;
    setSending(true);
    setError('');
    try {
      await desktop.stopChat(active.id);
    } catch (reason) {
      if (mounted.current) setError(errorMessage(reason));
    } finally {
      if (mounted.current) setSending(false);
    }
  }
  async function cancelSearch() {
    try {
      await desktop.cancelRetrieval();
    } catch (reason) {
      if (mounted.current) setError(errorMessage(reason));
    }
  }
  async function openCitation(turnId: string, number: number) {
    try {
      await onOpenCitation(turnId, number);
    } catch (reason) {
      if (mounted.current) setError(errorMessage(reason));
    }
  }
  async function refreshHistory() {
    setError('');
    try {
      const saved = await desktop.listNoteFeedback(note.id);
      if (!mounted.current) return;
      let items = saved;
      for (const turn of seen.current.values()) items = mergeTurn(items, turn);
      setTurns(items);
      setHistoryLoaded(true);
      setSelectedId((previous) => previous ?? items.at(-1)?.id ?? null);
    } catch (reason) {
      if (mounted.current) setError(errorMessage(reason));
    }
  }

  return (
    <section className="note-feedback-panel" aria-label="AI 笔记反馈">
      <div className="note-feedback-heading">
        <div>
          <h2>让理解经得起原文核对</h2>
          <p className="muted">反馈单独保存，不改写笔记，也不代替实际掌握情况。</p>
        </div>
        <button type="button" className="text-button" onClick={onSettings}>
          <Settings2 size={15} /> 模型设置
        </button>
      </div>
      {error && (
        <p className="feedback error" role="alert">
          {error}
        </p>
      )}
      {hasUnsavedChanges && (
        <p className="note-unsaved" role="status">
          有未保存修改。请先保存，再为这份内容准备反馈。
        </p>
      )}
      <label className="note-feedback-question">
        希望核对的概念或问题
        <input
          value={question}
          maxLength={noteFeedbackLimits.question}
          disabled={disabled || searching || sending}
          onChange={(event) => {
            setQuestion(event.target.value);
            setPreview(null);
            setConsentKey(null);
          }}
        />
      </label>
      <p className="field-hint">
        {note.sourceId ? '只检索笔记关联的资料。' : '从全部已导入资料检索。'}{' '}
        使用具体概念提问，手写依据不会直接当作可信证据。
      </p>
      <div className="note-feedback-actions">
        <button
          type="button"
          className="button secondary"
          disabled={
            !isDesktop ||
            !loaded ||
            disabled ||
            hasUnsavedChanges ||
            searching ||
            sending ||
            !question.trim()
          }
          onClick={() => void prepare()}
        >
          <Search size={15} /> 准备反馈证据
        </button>
        {searching && (
          <>
            <span role="status">{progress?.message ?? '正在检索资料…'}</span>
            <button type="button" className="text-button" onClick={() => void cancelSearch()}>
              取消检索
            </button>
          </>
        )}
      </div>
      {preview && previewValid && (
        <div className="evidence-preview" role="region" aria-label="笔记反馈预览">
          <h3>本次反馈将使用的内容</h3>
          <p>
            已保存笔记第 {preview.note.revision} 版 · {preview.evidence.sourceCount} 份资料范围 ·{' '}
            {preview.evidence.hits.length} 个片段
          </p>
          <NoteSnapshot note={preview.note} summary="查看将发送的笔记内容" />
          <EvidenceCards hits={preview.evidence.hits} />
          <p className="evidence-note">{preview.evidence.notice}</p>
          {!needsModel && <p>没有匹配证据，只保存本地说明，不请求聊天模型。</p>}
          {needsModel && (
            <p className="field-hint">
              聊天模型：{profile.model || '尚未选择'} · {profile.baseUrl}
            </p>
          )}
          {remote && needsModel && (
            <label className="chat-consent">
              <input
                type="checkbox"
                checked={consent}
                onChange={(event) => setConsentKey(event.target.checked ? confirmationKey : null)}
              />
              允许将上面的笔记内容、本次问题和检索片段发送至 {profile.baseUrl}（
              {profile.model || '未选择模型'}）；服务费用由我承担。
            </label>
          )}
          <button
            type="button"
            className="button primary"
            disabled={
              !loaded ||
              disabled ||
              searching ||
              sending ||
              Boolean(active) ||
              (needsModel && !profile.model) ||
              (remote && needsModel && !consent)
            }
            onClick={() => void generate()}
          >
            <Send size={15} />
            {needsModel ? '生成笔记反馈' : '保存证据不足说明'}
          </button>
        </div>
      )}
      {active && (
        <div className="note-feedback-actions" role="status">
          <span>
            {runningHere ? '这份笔记的反馈正在生成。' : '其他回答正在生成，结束后才能生成新反馈。'}
          </span>
          {runningHere && (
            <button
              type="button"
              className="button secondary"
              disabled={sending}
              onClick={() => void stop()}
            >
              <Square size={14} />
              停止反馈
            </button>
          )}
        </div>
      )}
      <div className="note-feedback-history-heading">
        <h3>反馈记录</h3>
        <button
          type="button"
          className="text-button"
          disabled={!isDesktop}
          onClick={() => void refreshHistory()}
        >
          刷新记录
        </button>
      </div>
      {!historyLoaded && (
        <p className="muted">{loaded ? '记录未能加载，请刷新重试。' : '正在读取反馈记录…'}</p>
      )}
      {historyLoaded && !turns.length && (
        <p className="muted">还没有反馈。先写下自己的理解，再用资料核对。</p>
      )}
      {turns.length > 0 && (
        <label className="note-feedback-history-select">
          选择反馈
          <select value={selectedId ?? ''} onChange={(event) => setSelectedId(event.target.value)}>
            {turns
              .slice()
              .reverse()
              .map((turn) => (
                <option key={turn.id} value={turn.id}>
                  {new Date(turn.createdAt).toLocaleString('zh-CN')} · 笔记第{' '}
                  {turn.noteSnapshot?.revision} 版 · {statusLabels[turn.status]}
                </option>
              ))}
          </select>
        </label>
      )}
      {selected && (
        <article className="note-feedback-result">
          <p className="note-feedback-context">关注问题：{selected.question}</p>
          {selected.noteSnapshot?.revision !== note.revision && (
            <p className="note-unsaved">这条反馈针对旧笔记版本，不代表当前内容。</p>
          )}
          <p className="field-hint">
            {selected.evidence.length
              ? `${selected.model} · ${selected.baseUrl}`
              : '本地证据不足说明 · 未调用模型'}
          </p>
          <GenerationStatus turn={selected} />
          <div className="chat-answer" data-testid="note-feedback-answer">
            <ModelAnswer
              turn={selected}
              onOpenCitation={(number) => void openCitation(selected.id, number)}
            />
          </div>
          <p className="chat-turn-status" role="status">
            {statusLabels[selected.status]}
          </p>
          {selected.notice && (
            <p className={'chat-turn-notice' + (selected.status === 'error' ? ' is-error' : '')}>
              {selected.notice}
            </p>
          )}
          <EvidenceCards
            hits={selected.evidence}
            onOpen={(number) => void openCitation(selected.id, number)}
          />
          {selected.noteSnapshot && (
            <NoteSnapshot
              note={selected.noteSnapshot}
              summary={`查看反馈依据的笔记第 ${selected.noteSnapshot.revision} 版`}
            />
          )}
          <p className="field-hint">
            引用编号只核对出处，不能保证每个判断被原文支持。请返回资料核查反馈。
          </p>
        </article>
      )}
    </section>
  );
}
