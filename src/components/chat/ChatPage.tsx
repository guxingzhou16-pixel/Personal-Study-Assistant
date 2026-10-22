import { useCallback, useEffect, useRef, useState } from 'react';
import { MessageCircle, Plus, Send, Square, Settings2 } from 'lucide-react';
import { desktop, errorMessage, isDesktop } from '../../lib/desktop';
import type {
  ChatTurn,
  Conversation,
  ConversationSummary,
  Settings,
  Source,
  EvidencePreview,
  RetrievalProgress,
  PracticeKind,
  PracticePreview,
  ReadingSelection,
} from '../../lib/types';
import { EvidenceCards } from '../shared/EvidenceCards';
import { ModelAnswer } from './ModelAnswer';
import { GenerationStatus } from '../shared/GenerationStatus';
import { HistoryActions } from '../shared/HistoryActions';
import { practiceLabels, practiceLimits } from '../../lib/practice';

function withTurn(conversation: Conversation, turn: ChatTurn): Conversation {
  const existing = conversation.turns.find((item) => item.id === turn.id);
  if (existing && existing.revision > turn.revision) return conversation;
  return {
    ...conversation,
    title:
      conversation.turns.length || conversation.title !== '新会话'
        ? conversation.title
        : turn.practiceRequest
          ? `${practiceLabels[turn.practiceRequest.kind]}：${turn.practiceRequest.topic.slice(0, 34)}`
          : turn.question.slice(0, 40),
    turns: existing
      ? conversation.turns.map((item) => (item.id === turn.id ? turn : item))
      : [...conversation.turns, turn],
  };
}
const labels: Record<ChatTurn['status'], string> = {
  streaming: '正在回答…',
  completed: '回答完成',
  stopped: '已停止',
  error: '回答未完成',
  interrupted: '上次生成已中断',
};

export function ChatPage({
  settings,
  onSettings,
  visible,
  presetSource,
  onOpenCitation,
  presetSelection,
}: {
  settings: Settings;
  onSettings: () => void;
  visible: boolean;
  presetSource: { id: string; sequence: number; question?: string } | null;
  onOpenCitation: (turnId: string, number: number) => Promise<void>;
  presetSelection?: { selection: ReadingSelection; sequence: number } | null;
}) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const currentConversation = useRef(conversation);
  currentConversation.current = conversation;
  const [active, setActive] = useState<ChatTurn | null>(null);
  const [question, setQuestion] = useState('');
  const [readingContext, setReadingContext] = useState<ReadingSelection | null>(null);
  const lastSelection = useRef(0);
  const questionRef = useRef(question);
  questionRef.current = question;
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [historyBusy, setHistoryBusy] = useState(false);
  const [historyQuery, setHistoryQuery] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [mode, setMode] = useState<'chat' | 'sources' | PracticeKind>('chat');
  const [scope, setScope] = useState('');
  const [sources, setSources] = useState<Source[]>([]);
  const [preview, setPreview] = useState<EvidencePreview | null>(null);
  const [practicePreview, setPracticePreview] = useState<PracticePreview | null>(null);
  const [practiceProfile, setPracticeProfile] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [progress, setProgress] = useState<RetrievalProgress | null>(null);
  const [indexNotice, setIndexNotice] = useState('');
  const searchVersion = useRef(0);
  const searchInFlight = useRef<number | null>(null);
  const cancelPending = useRef(false);
  const [consentProfile, setConsentProfile] = useState<string | null>(null);
  const lastUpdate = useRef<ChatTurn | null>(null);
  const turnRevisions = useRef(new Map<string, number>());
  const activityRevision = useRef(0);
  const loadVersion = useRef(0);
  const listVersion = useRef(0);
  const deletedConversations = useRef(new Set<string>());
  const transcript = useRef<HTMLDivElement>(null);
  const followOutput = useRef(true);
  const profile = settings[settings.provider];
  const signature = `${settings.provider}|${profile.baseUrl}|${profile.model}`;
  const practicing = mode === 'cards' || mode === 'quiz';
  const consentSignature = `${signature}|${mode}|${mode !== 'chat' ? (preview?.id ?? '') : ''}`;
  const consent = consentProfile === consentSignature;
  const needsModel = mode === 'chat' || Boolean(preview?.hits.length);
  const previewValid =
    preview !== null &&
    preview.question === question.trim() &&
    preview.sourceId === (scope || null) &&
    (!practicing ||
      (practicePreview?.evidence.id === preview.id &&
        practicePreview.request.kind === mode &&
        practiceProfile === signature));
  const remote = !['localhost', '127.0.0.1', '[::1]'].includes(new URL(profile.baseUrl).hostname);
  const invalidatePreview = useCallback(() => {
    searchVersion.current++;
    setPreview(null);
    setPracticePreview(null);
    setPracticeProfile(null);
    setConsentProfile(null);
  }, []);
  useEffect(() => {
    invalidatePreview();
  }, [signature, invalidatePreview]);
  const applyTurn = useCallback((turn: ChatTurn) => {
    if (deletedConversations.current.has(turn.conversationId)) return;
    if ((turnRevisions.current.get(turn.id) ?? -1) > turn.revision) return;
    turnRevisions.current.set(turn.id, turn.revision);
    activityRevision.current++;
    lastUpdate.current = turn;
    if (!turn.noteSnapshot && !turn.learningRequest)
      setConversation((previous) =>
        previous?.id === turn.conversationId ? withTurn(previous, turn) : previous,
      );
    setActive((previous) => {
      if (previous?.id === turn.id && previous.revision > turn.revision) return previous;
      if (turn.status === 'streaming') return turn;
      return previous?.id === turn.id ? null : previous;
    });
  }, []);
  const restoreActive = useCallback((snapshot: ChatTurn | null, expectedActivity: number) => {
    if (activityRevision.current !== expectedActivity) return;
    const latest = lastUpdate.current;
    const turn =
      snapshot && latest?.id === snapshot.id && latest.revision > snapshot.revision
        ? latest
        : snapshot;
    setActive(turn?.status === 'streaming' ? turn : null);
  }, []);
  const refresh = useCallback(async () => {
    const version = ++listVersion.current;
    const knownId = currentConversation.current?.id;
    const items = await desktop.listConversations();
    if (version !== listVersion.current) return;
    if (knownId && !items.some((item) => item.id === knownId)) {
      deletedConversations.current.add(knownId);
      if (lastUpdate.current?.conversationId === knownId) lastUpdate.current = null;
      setConversation((previous) => (previous?.id === knownId ? null : previous));
    }
    setConversations(items.filter((item) => !deletedConversations.current.has(item.id)));
  }, []);
  const openConversation = useCallback(
    async (id: string) => {
      invalidatePreview();
      const version = ++loadVersion.current;
      setBusy(true);
      setError('');
      try {
        const saved = await desktop.getConversation(id);
        const activity = activityRevision.current;
        const running = await desktop.activeChat();
        if (version !== loadVersion.current || deletedConversations.current.has(id)) return;
        setConversation((previous) => {
          let result = saved;
          if (previous?.id === saved.id)
            for (const turn of previous.turns) result = withTurn(result, turn);
          if (running?.conversationId === saved.id) result = withTurn(result, running);
          if (lastUpdate.current?.conversationId === saved.id)
            result = withTurn(result, lastUpdate.current);
          return result;
        });
        restoreActive(running, activity);
        followOutput.current = true;
      } catch (failure) {
        if (version === loadVersion.current) setError(errorMessage(failure));
      } finally {
        if (version === loadVersion.current) setBusy(false);
      }
    },
    [restoreActive, invalidatePreview],
  );
  useEffect(() => {
    if (!isDesktop) return;
    let cancelled = false;
    const stop = desktop.onChatUpdate((turn) => {
      applyTurn(turn);
      if (!turn.noteSnapshot && !turn.learningRequest && turn.status !== 'streaming')
        void refresh().catch((failure) => setError(errorMessage(failure)));
    });
    void (async () => {
      try {
        const items = await desktop.listConversations();
        if (cancelled) return;
        setConversations(items);
        if (items[0]) await openConversation(items[0].id);
        else {
          const activity = activityRevision.current;
          restoreActive(await desktop.activeChat(), activity);
        }
      } catch (failure) {
        if (!cancelled) setError(errorMessage(failure));
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
      loadVersion.current++;
      stop();
    };
  }, [applyTurn, openConversation, refresh, restoreActive]);
  useEffect(() => {
    if (visible && followOutput.current && transcript.current)
      transcript.current.scrollTop = conversation?.turns.length
        ? transcript.current.scrollHeight
        : 0;
  }, [conversation, preview, visible]);
  useEffect(() => {
    if (visible && isDesktop)
      void desktop
        .listSources()
        .then(setSources)
        .catch((failure) => setError(errorMessage(failure)));
  }, [visible]);
  useEffect(() => {
    if (!isDesktop) return;
    return desktop.onRetrievalProgress(setProgress);
  }, []);

  const newConversation = useCallback(async () => {
    invalidatePreview();
    setBusy(true);
    setError('');
    loadVersion.current++;
    listVersion.current++;
    try {
      const created = await desktop.createConversation();
      setConversation(created);
      setQuestion('');
      setReadingContext(null);
      setPreview(null);
      followOutput.current = true;
      await refresh();
      return created;
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }, [refresh, invalidatePreview]);
  useEffect(() => {
    if (!presetSource) return;
    if (
      questionRef.current.trim() &&
      !window.confirm('当前有尚未发送的问题。放弃这个问题并新建资料问答？')
    )
      return;
    setMode('sources');
    setScope(presetSource.id);
    setPreview(null);
    void newConversation().then((created) => {
      if (created && presetSource.question) setQuestion(presetSource.question);
    });
  }, [presetSource, newConversation]);
  useEffect(() => {
    if (
      !presetSelection ||
      !loaded ||
      busy ||
      searching ||
      active ||
      presetSelection.sequence === lastSelection.current
    )
      return;
    lastSelection.current = presetSelection.sequence;
    if (
      questionRef.current.trim() &&
      !window.confirm('保留当前会话，将未发送的问题替换为选中原文的问题？')
    )
      return;
    const selection = presetSelection.selection;
    async function apply() {
      if (!currentConversation.current && !(await newConversation())) return;
      invalidatePreview();
      setMode('sources');
      setScope(selection.sourceId);
      setReadingContext(selection);
      setQuestion('这段原文应该怎样理解？请区分原文支持的结论与待求证内容。');
    }
    void apply();
  }, [presetSelection, loaded, busy, searching, active, newConversation, invalidatePreview]);
  async function retrieve(rebuild = false) {
    if (searchInFlight.current !== null || cancelPending.current) return;
    invalidatePreview();
    const version = ++searchVersion.current;
    searchInFlight.current = version;
    setSearching(true);
    setError('');
    setPreview(null);
    setProgress(null);
    setIndexNotice('');
    followOutput.current = true;
    try {
      if (rebuild) {
        const notice = await desktop.rebuildIndex();
        if (version === searchVersion.current) setIndexNotice(`检索索引已重建。${notice}`);
      } else {
        if (mode === 'cards' || mode === 'quiz') {
          const result = await desktop.preparePractice({
            kind: mode,
            topic: question,
            sourceId: scope || null,
          });
          if (version === searchVersion.current) {
            setPracticePreview(result);
            setPracticeProfile(signature);
            setPreview(result.evidence);
          }
        } else {
          const result =
            readingContext && mode === 'sources' && readingContext.sourceId === scope
              ? await desktop.prepareReadingQuestion(
                  question,
                  readingContext.sourceId,
                  readingContext.anchor,
                  readingContext.text,
                )
              : await desktop.prepareQuestion(question, scope || null);
          if (version === searchVersion.current) setPreview(result);
        }
      }
    } catch (failure) {
      if (version === searchVersion.current) setError(errorMessage(failure));
    } finally {
      // Invalidating results must still release this request's busy state.
      if (searchInFlight.current === version) {
        searchInFlight.current = null;
        setSearching(cancelPending.current);
        setProgress(null);
      }
    }
  }
  async function cancelRetrieval() {
    if (cancelPending.current) return;
    cancelPending.current = true;
    invalidatePreview();
    setSearching(true);
    try {
      await desktop.cancelRetrieval();
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      cancelPending.current = false;
      setSearching(searchInFlight.current !== null);
    }
  }
  async function openEvidence(turnId: string, number: number) {
    setError('');
    try {
      await onOpenCitation(turnId, number);
    } catch (failure) {
      setError(errorMessage(failure));
    }
  }
  async function send() {
    if (busy || historyBusy || active || searching || !question.trim()) return;
    if (mode !== 'chat' && !previewValid) {
      setError('请先检索当前问题的原文，再发送。');
      return;
    }
    setBusy(true);
    setError('');
    followOutput.current = true;
    try {
      if (!conversation) listVersion.current++;
      const current = conversation ?? (await desktop.createConversation());
      if (!conversation) setConversation(current);
      const turn =
        practicing && preview
          ? await desktop.sendPractice({
              conversationId: current.id,
              retrievalId: preview.id,
              expectedProfile: signature,
              ...(remote && consent ? { consentEndpoint: profile.baseUrl } : {}),
            })
          : await desktop.sendChat({
              conversationId: current.id,
              question,
              expectedProfile: signature,
              ...(remote && consent ? { consentEndpoint: profile.baseUrl } : {}),
              ...(mode === 'sources' && preview ? { retrievalId: preview.id } : {}),
            });
      // The first stream event can arrive before the invoke reply; revision guards preserve it.
      applyTurn(turn);
      setQuestion('');
      setPreview(null);
      setPracticePreview(null);
      const latest = await desktop.getConversation(current.id);
      setConversation((previous) => {
        let result = latest;
        if (previous?.id === latest.id)
          for (const entry of previous.turns) result = withTurn(result, entry);
        return result;
      });
      const activity = activityRevision.current;
      restoreActive(await desktop.activeChat(), activity);
      await refresh();
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }
  async function stop() {
    if (!active) return;
    setBusy(true);
    setError('');
    try {
      await desktop.stopChat(active.id);
      setActive(null);
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  function renamed(saved: ConversationSummary) {
    setConversation((previous) =>
      previous?.id === saved.id ? { ...previous, ...saved } : previous,
    );
    setConversations((previous) => previous.map((item) => (item.id === saved.id ? saved : item)));
    void refresh().catch((reason) => setError(errorMessage(reason)));
  }
  function deleted(id: string) {
    deletedConversations.current.add(id);
    setConversation((previous) => (previous?.id === id ? null : previous));
    setConversations((previous) => previous.filter((item) => item.id !== id));
    if (lastUpdate.current?.conversationId === id) lastUpdate.current = null;
    void refresh().catch((reason) => setError(errorMessage(reason)));
  }

  return (
    <section className="chat-page" aria-label="学习助手">
      <div className="chat-heading">
        <div>
          <p className="eyebrow">LEARN THROUGH QUESTIONS</p>
          <h1>和拾知一起想明白</h1>
        </div>
        <button className="button secondary" onClick={onSettings}>
          <Settings2 size={16} />
          模型设置
        </button>
      </div>
      <p className="chat-scope" data-motion="fade" data-motion-key={mode}>
        {practicing
          ? `${practiceLabels[mode]} · 先预览原文，再生成 3 项练习。参考答案由你对照出处核查，不自动评分或记录掌握。`
          : mode === 'sources'
            ? '资料问答 · 先查看检索原文，再让拾知依据证据回答。每次问题独立检索，请写清具体概念。'
            : '普通聊天 · 不检索资料库。回答请结合原文核对。'}
      </p>
      {readingContext && (
        <div className="reading-context" aria-label="已选中原文">
          <p>
            《{readingContext.sourceName}》 ·{' '}
            {readingContext.page
              ? `第 ${readingContext.page} 页`
              : `${readingContext.title} · 第 ${readingContext.line} 行`}
          </p>
          <blockquote>{readingContext.text}</blockquote>
          <button
            className="text-button"
            onClick={() => {
              setReadingContext(null);
              invalidatePreview();
            }}
          >
            移除选文
          </button>
          <p className="field-hint">
            选文会加入本次证据预览；发送前可核对。问答和证据保存在本机，远程发送仍需确认。
          </p>
        </div>
      )}
      <div className="chat-workspace">
        <aside className="chat-history" aria-label="会话记录">
          <button
            className="button secondary"
            disabled={!isDesktop || !loaded || busy || historyBusy}
            onClick={() => void newConversation()}
          >
            <Plus size={16} />
            新会话
          </button>
          <label className="history-search">
            搜索会话标题
            <input
              value={historyQuery}
              maxLength={120}
              onChange={(event) => setHistoryQuery(event.target.value)}
            />
          </label>
          <button
            type="button"
            className="text-button"
            disabled={!isDesktop || busy || historyBusy}
            onClick={() => void refresh().catch((reason) => setError(errorMessage(reason)))}
          >
            刷新会话
          </button>
          <div className="chat-history-list">
            {conversations
              .filter((item) =>
                item.title.toLocaleLowerCase().includes(historyQuery.trim().toLocaleLowerCase()),
              )
              .map((item) => (
                <button
                  key={item.id}
                  aria-label={`会话：${item.title}`}
                  aria-current={conversation?.id === item.id ? 'true' : undefined}
                  disabled={busy || historyBusy}
                  onClick={() => void openConversation(item.id)}
                >
                  <MessageCircle size={14} />
                  <span>{item.title}</span>
                </button>
              ))}
          </div>
          {conversations.length > 0 &&
            !conversations.some((item) =>
              item.title.toLocaleLowerCase().includes(historyQuery.trim().toLocaleLowerCase()),
            ) && <p className="field-hint">没有匹配的会话标题。</p>}
          <small>会话保存在本机</small>
        </aside>
        <div className="chat-content">
          {conversation && (
            <HistoryActions
              key={conversation.id}
              target={{ kind: 'conversation', id: conversation.id }}
              disabled={busy || searching || active?.conversationId === conversation.id}
              onRenamed={renamed}
              onDeleted={deleted}
              onBusyChange={setHistoryBusy}
            />
          )}
          <div className="chat-model">
            <span>{profile.model || '尚未选择模型'}</span>
            <small>{profile.baseUrl}</small>
          </div>
          <div
            className="chat-retrieval-controls"
            data-motion="fade"
            data-motion-key={`${mode}:${scope}`}
          >
            <label>
              问答方式
              <select
                aria-label="问答方式"
                value={mode}
                disabled={searching || busy || historyBusy}
                onChange={(event) => {
                  setMode(event.target.value as 'chat' | 'sources' | PracticeKind);
                  invalidatePreview();
                }}
              >
                <option value="chat">普通聊天</option>
                <option value="sources">资料问答</option>
                <option value="cards">知识卡片</option>
                <option value="quiz">短测验</option>
              </select>
            </label>
            {mode !== 'chat' && (
              <>
                <label className="scope-select">
                  资料范围
                  <select
                    aria-label="资料范围"
                    value={scope}
                    disabled={searching}
                    onChange={(event) => {
                      setScope(event.target.value);
                      invalidatePreview();
                    }}
                  >
                    <option value="">全部已导入资料</option>
                    {sources.map((source) => (
                      <option key={source.id} value={source.id}>
                        {source.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className="text-button"
                  disabled={!isDesktop || searching || busy}
                  onClick={() => void retrieve(true)}
                >
                  重建检索索引
                </button>
              </>
            )}
          </div>
          <div
            className="chat-transcript"
            data-motion="fade"
            data-motion-key={conversation?.id ?? 'empty'}
            ref={transcript}
            tabIndex={0}
            aria-label="聊天内容"
            onScroll={() => {
              const element = transcript.current;
              if (element)
                followOutput.current =
                  element.scrollHeight - element.scrollTop - element.clientHeight < 60;
            }}
          >
            {!conversation?.turns.length && (
              <div className="chat-empty">
                <MessageCircle size={30} />
                <h2>从一个具体的问题开始</h2>
                <p>解释一个概念，讨论一段代码，或梳理下一步练习。</p>
                {!profile.model && (
                  <button className="button secondary" onClick={onSettings}>
                    先选择聊天模型
                  </button>
                )}
              </div>
            )}
            {conversation?.turns.map((turn) => (
              <article className="chat-turn" key={turn.id}>
                <div className="chat-question" data-motion="reveal">
                  <span>我</span>
                  <p>{turn.question}</p>
                </div>
                <div className="chat-response">
                  <span>
                    拾知 ·{' '}
                    {turn.practiceRequest
                      ? practiceLabels[turn.practiceRequest.kind]
                      : turn.mode === 'sources'
                        ? '资料问答'
                        : '普通聊天'}{' '}
                    ·{' '}
                    {turn.mode === 'sources' && !turn.evidence.length
                      ? '未调用模型'
                      : turn.model || '未选择模型'}
                  </span>
                  <GenerationStatus turn={turn} />
                  <div className="chat-answer" data-testid="chat-answer">
                    <ModelAnswer
                      turn={turn}
                      onOpenCitation={(number) => void openEvidence(turn.id, number)}
                    />
                  </div>
                  <p
                    className="chat-turn-status"
                    role="status"
                    data-motion="state"
                    data-motion-key={turn.status}
                  >
                    {labels[turn.status]}
                  </p>
                  {turn.notice && (
                    <p
                      className={`chat-turn-notice ${turn.status === 'error' ? 'is-error' : ''}`}
                      data-motion="fade"
                    >
                      {turn.notice}
                    </p>
                  )}
                  {turn.evidence.length > 0 && (
                    <EvidenceCards
                      hits={turn.evidence}
                      onOpen={(number) => void openEvidence(turn.id, number)}
                    />
                  )}
                </div>
              </article>
            ))}
            {preview && previewValid && (
              <div
                className="evidence-preview"
                role="region"
                aria-label="本次检索证据"
                data-motion="fade"
                data-motion-key={preview.id}
              >
                <h2>本次检索原文</h2>
                <p>
                  {preview.hits.length
                    ? `从 ${preview.sourceCount} 份资料范围中找到 ${preview.hits.length} 个片段。发送本次问题及下列原文。`
                    : '没有找到匹配的原文'}
                </p>
                <EvidenceCards hits={preview.hits} />
                <p className="evidence-note">{preview.notice}</p>
              </div>
            )}
          </div>
          <form
            className="chat-composer"
            onSubmit={(event) => {
              event.preventDefault();
              void send();
            }}
          >
            {error && (
              <p className="chat-error" role="alert" data-motion="fade" data-motion-key={error}>
                {error}
              </p>
            )}
            {!isDesktop && <p className="chat-error">请启动桌面版以保存会话并连接模型。</p>}
            {indexNotice && (
              <p
                className="chat-index-notice"
                role="status"
                data-motion="fade"
                data-motion-key={indexNotice}
              >
                {indexNotice}
              </p>
            )}
            {searching && (
              <div className="chat-index-progress" role="status" data-motion="fade">
                <span>{progress?.message ?? '正在准备索引和检索原文…'}</span>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => void cancelRetrieval()}
                >
                  取消检索
                </button>
              </div>
            )}
            {remote && needsModel && (
              <label className="chat-consent" data-motion="fade" data-motion-key={consentSignature}>
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(event) =>
                    setConsentProfile(event.target.checked ? consentSignature : null)
                  }
                />
                允许将
                {practicing
                  ? '练习主题、类型及本次预览原文（不包含我的作答）'
                  : mode === 'sources'
                    ? '问题及本次预览的原文'
                    : '问题及近期完整对话'}
                发送至 {profile.baseUrl}；服务费用由我承担。
              </label>
            )}
            {active?.noteSnapshot && (
              <p className="chat-running-link" role="status">
                笔记“{active.noteSnapshot.title}”正在生成反馈，可从学习笔记查看。
              </p>
            )}
            {active?.learningRequest && (
              <p className="chat-running-link" role="status">
                学习路线正在起草，可从“学习路线”查看。
              </p>
            )}
            {active &&
              !active.noteSnapshot &&
              !active.learningRequest &&
              active.conversationId !== conversation?.id && (
                <button
                  className="chat-running-link"
                  type="button"
                  onClick={() => void openConversation(active.conversationId)}
                >
                  另一会话正在回答，点击查看
                </button>
              )}
            <label className="sr-only" htmlFor="chat-question">
              {practicing ? '输入练习主题' : '输入学习问题'}
            </label>
            <textarea
              id="chat-question"
              value={question}
              maxLength={practicing ? practiceLimits.topic : 4000}
              placeholder={
                practicing ? '写下资料中的具体概念，用于查找练习依据…' : '写下你想弄明白的问题…'
              }
              onChange={(event) => {
                setQuestion(event.target.value);
                invalidatePreview();
              }}
              disabled={searching}
              onKeyDown={(event) => {
                if (
                  (event.ctrlKey || event.metaKey) &&
                  event.key === 'Enter' &&
                  !event.nativeEvent.isComposing
                ) {
                  event.preventDefault();
                  if (!remote || !needsModel || consent) void send();
                }
              }}
            />
            <div
              className="chat-actions"
              data-motion="state"
              data-motion-key={active ? 'running' : 'idle'}
            >
              <small>
                {mode !== 'chat'
                  ? '先检索原文，Ctrl + Enter 发送 · 引用编号可打开出处'
                  : 'Ctrl + Enter 发送 · 仅携带最近 6 轮完整回答，超长历史会截断'}
              </small>
              {mode !== 'chat' && (
                <button
                  type="button"
                  className="button secondary"
                  disabled={!isDesktop || searching || busy || !question.trim()}
                  onClick={() => void retrieve()}
                >
                  检索原文
                </button>
              )}
              {active ? (
                <button
                  className="button secondary"
                  type="button"
                  disabled={busy}
                  onClick={() => void stop()}
                >
                  <Square size={14} />
                  停止生成
                </button>
              ) : (
                <button
                  className="button primary"
                  type="submit"
                  disabled={
                    !isDesktop ||
                    !loaded ||
                    busy ||
                    historyBusy ||
                    searching ||
                    (needsModel && !profile.model) ||
                    !question.trim() ||
                    (mode !== 'chat' && !previewValid) ||
                    (remote && needsModel && !consent)
                  }
                >
                  <Send size={15} />
                  {practicing ? (needsModel ? '生成 3 项练习' : '保存证据不足说明') : '发送问题'}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
