import { useCallback, useEffect, useRef, useState } from 'react';
import { MessageCircle, Plus, Send, Square, Settings2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { desktop, errorMessage, isDesktop } from '../lib/desktop';
import type {
  ChatTurn,
  Conversation,
  ConversationSummary,
  Settings,
  Source,
  EvidencePreview,
  RetrievalProgress,
} from '../lib/types';
import { EvidenceCards } from './EvidenceCards';
import { citationNumber, remarkEvidence } from '../lib/citations';

function withTurn(conversation: Conversation, turn: ChatTurn): Conversation {
  const existing = conversation.turns.find((item) => item.id === turn.id);
  if (existing && existing.revision > turn.revision) return conversation;
  return {
    ...conversation,
    title: conversation.turns.length ? conversation.title : turn.question.slice(0, 40),
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
}: {
  settings: Settings;
  onSettings: () => void;
  visible: boolean;
  presetSource: { id: string; sequence: number } | null;
  onOpenCitation: (turnId: string, number: number) => Promise<void>;
}) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [active, setActive] = useState<ChatTurn | null>(null);
  const [question, setQuestion] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [mode, setMode] = useState<'chat' | 'sources'>('chat');
  const [scope, setScope] = useState('');
  const [sources, setSources] = useState<Source[]>([]);
  const [preview, setPreview] = useState<EvidencePreview | null>(null);
  const [searching, setSearching] = useState(false);
  const [progress, setProgress] = useState<RetrievalProgress | null>(null);
  const [indexNotice, setIndexNotice] = useState('');
  const searchVersion = useRef(0);
  const [consentProfile, setConsentProfile] = useState<string | null>(null);
  const lastUpdate = useRef<ChatTurn | null>(null);
  const loadVersion = useRef(0);
  const transcript = useRef<HTMLDivElement>(null);
  const followOutput = useRef(true);
  const profile = settings[settings.provider];
  const signature = `${settings.provider}|${profile.baseUrl}|${profile.model}`;
  const consentSignature = `${signature}|${mode}|${mode === 'sources' ? (preview?.id ?? '') : ''}`;
  const consent = consentProfile === consentSignature;
  const needsModel = mode === 'chat' || Boolean(preview?.hits.length);
  const previewValid =
    preview !== null &&
    preview.question === question.trim() &&
    preview.sourceId === (scope || null);
  const remote = !['localhost', '127.0.0.1', '[::1]'].includes(new URL(profile.baseUrl).hostname);
  const applyTurn = useCallback((turn: ChatTurn) => {
    if (lastUpdate.current?.id === turn.id && lastUpdate.current.revision > turn.revision) return;
    lastUpdate.current = turn;
    setConversation((previous) =>
      previous?.id === turn.conversationId ? withTurn(previous, turn) : previous,
    );
    setActive((previous) => {
      if (previous?.id === turn.id && previous.revision > turn.revision) return previous;
      if (turn.status === 'streaming') return turn;
      return previous?.id === turn.id ? null : previous;
    });
  }, []);
  const restoreActive = useCallback((snapshot: ChatTurn | null) => {
    const latest = lastUpdate.current;
    const turn =
      snapshot && latest?.id === snapshot.id && latest.revision > snapshot.revision
        ? latest
        : snapshot;
    setActive(turn?.status === 'streaming' ? turn : null);
  }, []);
  const refresh = useCallback(async () => {
    setConversations(await desktop.listConversations());
  }, []);
  const openConversation = useCallback(
    async (id: string) => {
      const version = ++loadVersion.current;
      setBusy(true);
      setError('');
      try {
        const saved = await desktop.getConversation(id);
        const running = await desktop.activeChat();
        if (version !== loadVersion.current) return;
        setConversation((previous) => {
          let result = saved;
          if (previous?.id === saved.id)
            for (const turn of previous.turns) result = withTurn(result, turn);
          if (running?.conversationId === saved.id) result = withTurn(result, running);
          if (lastUpdate.current?.conversationId === saved.id)
            result = withTurn(result, lastUpdate.current);
          return result;
        });
        restoreActive(running);
        followOutput.current = true;
      } catch (failure) {
        if (version === loadVersion.current) setError(errorMessage(failure));
      } finally {
        if (version === loadVersion.current) setBusy(false);
      }
    },
    [restoreActive],
  );
  useEffect(() => {
    if (!isDesktop) return;
    let cancelled = false;
    const stop = desktop.onChatUpdate((turn) => {
      applyTurn(turn);
      if (turn.status !== 'streaming')
        void refresh().catch((failure) => setError(errorMessage(failure)));
    });
    void (async () => {
      try {
        const items = await desktop.listConversations();
        if (cancelled) return;
        setConversations(items);
        if (items[0]) await openConversation(items[0].id);
        else restoreActive(await desktop.activeChat());
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
      transcript.current.scrollTop = transcript.current.scrollHeight;
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
    setBusy(true);
    setError('');
    loadVersion.current++;
    try {
      const created = await desktop.createConversation();
      setConversation(created);
      setQuestion('');
      setPreview(null);
      followOutput.current = true;
      await refresh();
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }, [refresh]);
  useEffect(() => {
    if (!presetSource) return;
    setMode('sources');
    setScope(presetSource.id);
    setPreview(null);
    void newConversation();
  }, [presetSource, newConversation]);
  async function retrieve(rebuild = false) {
    const version = ++searchVersion.current;
    setSearching(true);
    setError('');
    setPreview(null);
    setProgress(null);
    setIndexNotice('');
    followOutput.current = true;
    try {
      if (rebuild) {
        await desktop.rebuildIndex();
        if (version === searchVersion.current) setIndexNotice('检索索引已重建。');
      } else {
        const result = await desktop.prepareQuestion(question, scope || null);
        if (version === searchVersion.current) setPreview(result);
      }
    } catch (failure) {
      if (version === searchVersion.current) setError(errorMessage(failure));
    } finally {
      if (version === searchVersion.current) {
        setSearching(false);
        setProgress(null);
      }
    }
  }
  async function cancelRetrieval() {
    try {
      await desktop.cancelRetrieval();
    } catch (failure) {
      setError(errorMessage(failure));
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
    if (busy || active || searching || !question.trim()) return;
    if (mode === 'sources' && !previewValid) {
      setError('请先检索当前问题的原文，再发送。');
      return;
    }
    setBusy(true);
    setError('');
    followOutput.current = true;
    try {
      const current = conversation ?? (await desktop.createConversation());
      if (!conversation) setConversation(current);
      const turn = await desktop.sendChat({
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
      const latest = await desktop.getConversation(current.id);
      setConversation((previous) => {
        let result = latest;
        if (previous?.id === latest.id)
          for (const entry of previous.turns) result = withTurn(result, entry);
        return result;
      });
      restoreActive(await desktop.activeChat());
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
      <p className="chat-scope">
        {mode === 'sources'
          ? '资料问答 · 先查看检索原文，再让拾知依据证据回答。每次问题独立检索，请写清具体概念。'
          : '普通聊天 · 不检索资料库。回答请结合原文核对。'}
      </p>
      <div className="chat-workspace">
        <aside className="chat-history" aria-label="会话记录">
          <button
            className="button secondary"
            disabled={!isDesktop || !loaded || busy}
            onClick={() => void newConversation()}
          >
            <Plus size={16} />
            新会话
          </button>
          <div className="chat-history-list">
            {conversations.map((item) => (
              <button
                key={item.id}
                aria-label={`会话：${item.title}`}
                aria-current={conversation?.id === item.id ? 'true' : undefined}
                disabled={busy}
                onClick={() => void openConversation(item.id)}
              >
                <MessageCircle size={14} />
                <span>{item.title}</span>
              </button>
            ))}
          </div>
          <small>会话保存在本机</small>
        </aside>
        <div className="chat-content">
          <div className="chat-model">
            <span>{profile.model || '尚未选择模型'}</span>
            <small>{profile.baseUrl}</small>
          </div>
          <div className="chat-retrieval-controls">
            <label>
              问答方式
              <select
                aria-label="问答方式"
                value={mode}
                disabled={searching}
                onChange={(event) => {
                  setMode(event.target.value as 'chat' | 'sources');
                  setPreview(null);
                }}
              >
                <option value="chat">普通聊天</option>
                <option value="sources">资料问答</option>
              </select>
            </label>
            {mode === 'sources' && (
              <>
                <label className="scope-select">
                  资料范围
                  <select
                    aria-label="资料范围"
                    value={scope}
                    disabled={searching}
                    onChange={(event) => {
                      setScope(event.target.value);
                      setPreview(null);
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
                <div className="chat-question">
                  <span>我</span>
                  <p>{turn.question}</p>
                </div>
                <div className="chat-response">
                  <span>
                    拾知 · {turn.mode === 'sources' ? '资料问答' : '普通聊天'} ·{' '}
                    {turn.mode === 'sources' && !turn.evidence.length
                      ? '未调用模型'
                      : turn.model || '未选择模型'}
                  </span>
                  <div className="chat-answer" data-testid="chat-answer">
                    <ReactMarkdown
                      remarkPlugins={
                        turn.mode === 'sources' ? [remarkGfm, remarkEvidence] : [remarkGfm]
                      }
                      skipHtml
                      urlTransform={(url) =>
                        citationNumber(url, turn.evidence) !== null ? url : ''
                      }
                      components={{
                        img: () => null,
                        a: ({ href, children }) => {
                          const number = citationNumber(href, turn.evidence);
                          return number === null ? (
                            <span>{children}</span>
                          ) : (
                            <button
                              className="citation-link"
                              aria-label={`引用 ${number}`}
                              onClick={() => void openEvidence(turn.id, number)}
                            >
                              {children}
                            </button>
                          );
                        },
                      }}
                    >
                      {turn.answer ||
                        (turn.status === 'streaming' ? '正在等待模型回应…' : '本次没有收到回答。')}
                    </ReactMarkdown>
                  </div>
                  <p className="chat-turn-status" role="status">
                    {labels[turn.status]}
                  </p>
                  {turn.notice && (
                    <p className={`chat-turn-notice ${turn.status === 'error' ? 'is-error' : ''}`}>
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
              <div className="evidence-preview" role="region" aria-label="本次检索证据">
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
              <p className="chat-error" role="alert">
                {error}
              </p>
            )}
            {!isDesktop && <p className="chat-error">请启动桌面版以保存会话并连接模型。</p>}
            {indexNotice && (
              <p className="chat-index-notice" role="status">
                {indexNotice}
              </p>
            )}
            {searching && (
              <div className="chat-index-progress" role="status">
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
              <label className="chat-consent">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(event) =>
                    setConsentProfile(event.target.checked ? consentSignature : null)
                  }
                />
                允许将{mode === 'sources' ? '问题及本次预览的原文' : '问题及近期完整对话'}发送至{' '}
                {profile.baseUrl}；服务费用由我承担。
              </label>
            )}
            {active && active.conversationId !== conversation?.id && (
              <button
                className="chat-running-link"
                type="button"
                onClick={() => void openConversation(active.conversationId)}
              >
                另一会话正在回答，点击查看
              </button>
            )}
            <label className="sr-only" htmlFor="chat-question">
              输入学习问题
            </label>
            <textarea
              id="chat-question"
              value={question}
              maxLength={4000}
              placeholder="写下你想弄明白的问题…"
              onChange={(event) => {
                setQuestion(event.target.value);
                setPreview(null);
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
            <div className="chat-actions">
              <small>
                {mode === 'sources'
                  ? '先检索原文，Ctrl + Enter 发送 · 引用编号可打开出处'
                  : 'Ctrl + Enter 发送 · 仅携带最近 6 轮完整回答，超长历史会截断'}
              </small>
              {mode === 'sources' && (
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
                    searching ||
                    (needsModel && !profile.model) ||
                    !question.trim() ||
                    (mode === 'sources' && !previewValid) ||
                    (remote && needsModel && !consent)
                  }
                >
                  <Send size={15} />
                  发送问题
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
