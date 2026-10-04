import { useCallback, useEffect, useRef, useState } from 'react';
import { NotebookPen, Search, Send, Settings2, Square } from 'lucide-react';
import { desktop, errorMessage, isDesktop } from '../lib/desktop';
import { learningLimits, sameLearningRequest } from '../lib/learning';
import type {
  ChatTurn,
  LearningPreview,
  LearningRequest,
  RetrievalProgress,
  Settings,
  Source,
} from '../lib/types';
import { EvidenceCards } from './EvidenceCards';
import { ModelAnswer } from './ModelAnswer';

const statusLabels: Record<ChatTurn['status'], string> = {
  streaming: '正在起草…',
  completed: '草稿已保存',
  stopped: '已停止，保留部分草稿',
  error: '草稿未完成',
  interrupted: '上次起草已中断',
};

function mergeDraft(turns: ChatTurn[], turn: ChatTurn): ChatTurn[] {
  const previous = turns.find((item) => item.id === turn.id);
  if (previous && previous.revision > turn.revision) return turns;
  return previous ? turns.map((item) => (item.id === turn.id ? turn : item)) : [...turns, turn];
}

function RequestSummary({ request, scope }: { request: LearningRequest; scope: string }) {
  return (
    <dl className="agent-request-summary">
      <dt>学习目标</dt>
      <dd>{request.goal}</dd>
      <dt>检索词</dt>
      <dd>{request.query}</dd>
      <dt>资料范围</dt>
      <dd>{scope}</dd>
      <dt>可用时间</dt>
      <dd>{request.minutes} 分钟（用于建议安排，不是计时记录）</dd>
    </dl>
  );
}

export function AgentPage({
  visible,
  settings,
  onSettings,
  onOpenCitation,
  onTakeNote,
}: {
  visible: boolean;
  settings: Settings;
  onSettings: () => void;
  onOpenCitation: (turnId: string, number: number) => Promise<void>;
  onTakeNote: (sourceId: string | null) => void;
}) {
  const [goal, setGoal] = useState('');
  const [query, setQuery] = useState('');
  const [sourceId, setSourceId] = useState('');
  const [minutes, setMinutes] = useState('30');
  const [sources, setSources] = useState<Source[]>([]);
  const [preview, setPreview] = useState<LearningPreview | null>(null);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [active, setActive] = useState<ChatTurn | null>(null);
  const [activeLoaded, setActiveLoaded] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState<RetrievalProgress | null>(null);
  const [consentKey, setConsentKey] = useState<string | null>(null);
  const mounted = useRef(true);
  const revisions = useRef(new Map<string, number>());
  const seenDrafts = useRef(new Map<string, ChatTurn>());
  const activityVersion = useRef(0);
  const searchVersion = useRef(0);
  const loadVersion = useRef(0);
  const request: LearningRequest = {
    goal,
    query,
    sourceId: sourceId || null,
    minutes: Number(minutes),
  };
  const currentRequest = useRef(request);
  currentRequest.current = request;
  const profile = settings[settings.provider];
  const signature = `${settings.provider}|${profile.baseUrl}|${profile.model}`;
  const confirmationKey = `${signature}|${preview?.evidence.id ?? ''}`;
  const consent = consentKey === confirmationKey;
  const remote = !['localhost', '127.0.0.1', '[::1]'].includes(new URL(profile.baseUrl).hostname);
  const previewValid = Boolean(preview && sameLearningRequest(preview.request, request));
  const needsModel = Boolean(preview?.evidence.hits.length);
  const requestValid = Boolean(
    goal.trim() &&
    query.trim() &&
    Number.isSafeInteger(request.minutes) &&
    request.minutes >= learningLimits.minMinutes &&
    request.minutes <= learningLimits.maxMinutes,
  );
  const selected = turns.find((turn) => turn.id === selectedId);
  const runningHere = Boolean(active?.learningRequest);

  const applyTurn = useCallback((turn: ChatTurn) => {
    if ((revisions.current.get(turn.id) ?? -1) > turn.revision) return;
    revisions.current.set(turn.id, turn.revision);
    activityVersion.current++;
    if (turn.learningRequest) {
      seenDrafts.current.set(turn.id, turn);
      setTurns((previous) => mergeDraft(previous, turn));
      setSelectedId((previous) => previous ?? turn.id);
    }
    setActive((previous) =>
      turn.status === 'streaming' ? turn : previous?.id === turn.id ? null : previous,
    );
    setActiveLoaded(true);
  }, []);

  const refreshHistory = useCallback(async () => {
    const version = ++loadVersion.current;
    const activity = activityVersion.current;
    setLoading(true);
    setError('');
    const [saved, running] = await Promise.allSettled([
      desktop.listLearningDrafts(),
      desktop.activeChat(),
    ]);
    if (!mounted.current || version !== loadVersion.current) return;
    const failures: string[] = [];
    if (saved.status === 'fulfilled') {
      let items = saved.value;
      for (const turn of seenDrafts.current.values()) items = mergeDraft(items, turn);
      for (const turn of items) {
        revisions.current.set(
          turn.id,
          Math.max(revisions.current.get(turn.id) ?? -1, turn.revision),
        );
        seenDrafts.current.set(turn.id, turn);
      }
      setTurns(items);
      setSelectedId((previous) => previous ?? items.at(-1)?.id ?? null);
      setHistoryLoaded(true);
    } else failures.push(errorMessage(saved.reason));
    if (running.status === 'fulfilled') {
      // Do not let an initial snapshot revive a request already finished by a live event.
      if (activity === activityVersion.current) {
        if (running.value) applyTurn(running.value);
        else setActive(null);
      }
      setActiveLoaded(true);
    } else failures.push(errorMessage(running.reason));
    if (failures.length) setError(failures.join(' '));
    setLoading(false);
  }, [applyTurn]);

  useEffect(() => {
    mounted.current = true;
    if (!isDesktop) return;
    const stopUpdates = desktop.onChatUpdate(applyTurn);
    const stopProgress = desktop.onRetrievalProgress(setProgress);
    void refreshHistory();
    return () => {
      mounted.current = false;
      loadVersion.current++;
      searchVersion.current++;
      stopUpdates();
      stopProgress();
    };
  }, [applyTurn, refreshHistory]);

  useEffect(() => {
    if (!visible || !isDesktop) return;
    let cancelled = false;
    void desktop.listSources().then(
      (items) => {
        if (!cancelled) setSources(items);
      },
      (reason) => {
        if (!cancelled) setError(errorMessage(reason));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [visible]);

  function invalidatePreview() {
    searchVersion.current++;
    setPreview(null);
    setConsentKey(null);
  }

  function scopeName(id: string | null, hits: ChatTurn['evidence'] = []) {
    if (!id) return '全部已导入资料';
    return (
      sources.find((source) => source.id === id)?.name ??
      hits.find((hit) => hit.sourceId === id)?.sourceName ??
      '指定资料'
    );
  }

  async function prepare() {
    if (searching || sending || !requestValid) return;
    const version = ++searchVersion.current;
    setSearching(true);
    setError('');
    setPreview(null);
    setConsentKey(null);
    setProgress(null);
    try {
      const result = await desktop.prepareLearningDraft(request);
      if (
        mounted.current &&
        version === searchVersion.current &&
        sameLearningRequest(result.request, currentRequest.current)
      )
        setPreview(result);
    } catch (reason) {
      if (mounted.current && version === searchVersion.current) setError(errorMessage(reason));
    } finally {
      if (mounted.current) {
        setSearching(false);
        setProgress(null);
      }
    }
  }

  async function generate() {
    if (
      !preview ||
      !previewValid ||
      active ||
      !activeLoaded ||
      sending ||
      searching ||
      (needsModel && !profile.model) ||
      (remote && needsModel && !consent)
    )
      return;
    setSending(true);
    setError('');
    try {
      const turn = await desktop.sendLearningDraft({
        retrievalId: preview.evidence.id,
        expectedProfile: signature,
        ...(remote && consent ? { consentEndpoint: profile.baseUrl } : {}),
      });
      if (!mounted.current) return;
      applyTurn(seenDrafts.current.get(turn.id) ?? turn);
      setSelectedId(turn.id);
      setPreview(null);
      setConsentKey(null);
    } catch (reason) {
      if (mounted.current) setError(errorMessage(reason));
    } finally {
      if (mounted.current) setSending(false);
    }
  }

  async function cancelSearch() {
    if (!searching) return;
    invalidatePreview();
    try {
      await desktop.cancelRetrieval();
    } catch (reason) {
      if (mounted.current) setError(errorMessage(reason));
    }
  }

  async function stop() {
    if (!active || !runningHere || sending) return;
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

  async function openCitation(turnId: string, number: number) {
    setError('');
    try {
      await onOpenCitation(turnId, number);
    } catch (reason) {
      if (mounted.current) setError(errorMessage(reason));
    }
  }

  return (
    <section className="page agent-page" aria-label="学习路线 Agent">
      <div className="page-heading">
        <div>
          <p className="eyebrow">A SMALL STEP YOU CAN PRACTISE</p>
          <h1>把目标变成一次学习路线</h1>
          <p className="muted">先核对资料，再起草建议，最后由你阅读、实践和复盘。</p>
        </div>
        <button type="button" className="button secondary" onClick={onSettings}>
          <Settings2 size={16} /> 模型设置
        </button>
      </div>
      <ol className="agent-flow" aria-label="学习路线步骤">
        <li>明确目标</li>
        <li>核对证据</li>
        <li>起草路线</li>
        <li>自己实践</li>
      </ol>
      {error && (
        <p className="feedback error" role="alert">
          {error}
        </p>
      )}
      {!isDesktop && <p className="field-hint">请在桌面版使用资料检索与草稿保存。</p>}
      <section className="agent-panel" aria-labelledby="agent-request-heading">
        <h2 id="agent-request-heading">今天想弄懂什么？</h2>
        <label className="agent-field">
          学习目标
          <textarea
            value={goal}
            maxLength={learningLimits.goal}
            disabled={sending}
            placeholder="例如：能用自己的话解释缓存失效，并写出一个小例子。"
            onChange={(event) => {
              setGoal(event.target.value);
              invalidatePreview();
            }}
          />
        </label>
        <label className="agent-field">
          用来查找原文的概念或问题
          <input
            value={query}
            maxLength={learningLimits.query}
            disabled={sending}
            placeholder="例如：缓存失效"
            onChange={(event) => {
              setQuery(event.target.value);
              invalidatePreview();
            }}
          />
        </label>
        <div className="agent-request-options">
          <label className="agent-field">
            资料范围
            <select
              value={sourceId}
              disabled={sending}
              onChange={(event) => {
                setSourceId(event.target.value);
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
          <label className="agent-field">
            可用时间（分钟）
            <input
              type="number"
              min={learningLimits.minMinutes}
              max={learningLimits.maxMinutes}
              step={1}
              inputMode="numeric"
              value={minutes}
              disabled={sending}
              onChange={(event) => {
                setMinutes(event.target.value);
                invalidatePreview();
              }}
            />
          </label>
        </div>
        <p className="field-hint">
          时间范围 10–180 分钟。每次只检索一次；修改目标或范围后，需要重新准备证据。
        </p>
        <div className="agent-actions">
          <button
            type="button"
            className="button secondary"
            disabled={!isDesktop || searching || sending || !requestValid}
            onClick={() => void prepare()}
          >
            <Search size={16} /> 准备路线证据
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
          <div className="evidence-preview" role="region" aria-label="学习路线请求预览">
            <h3>核对本次请求</h3>
            <RequestSummary
              request={preview.request}
              scope={scopeName(preview.request.sourceId, preview.evidence.hits)}
            />
            <p>
              {preview.evidence.sourceCount} 份资料范围 · {preview.evidence.hits.length} 个检索片段
            </p>
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
                允许将上面的目标、检索词、时间安排和检索片段发送至 {profile.baseUrl}（
                {profile.model || '未选择模型'}）；服务费用由我承担。
              </label>
            )}
            <p className="field-hint">
              路线作为建议单独保存。它不会创建任务、标记进度或写入长期记忆。
            </p>
            <button
              type="button"
              className="button primary"
              disabled={
                !activeLoaded ||
                searching ||
                sending ||
                Boolean(active) ||
                (needsModel && !profile.model) ||
                (remote && needsModel && !consent)
              }
              onClick={() => void generate()}
            >
              <Send size={16} /> {needsModel ? '起草学习路线' : '保存证据不足说明'}
            </button>
          </div>
        )}
        {active && (
          <div className="agent-actions" role="status">
            <span>
              {runningHere ? '学习路线正在起草。' : '其他回答正在生成，结束后才能起草新路线。'}
            </span>
            {runningHere && (
              <button
                type="button"
                className="button secondary"
                disabled={sending}
                onClick={() => void stop()}
              >
                <Square size={14} /> 停止起草
              </button>
            )}
          </div>
        )}
      </section>
      <section className="agent-panel" aria-labelledby="agent-history-heading">
        <div className="agent-actions">
          <h2 id="agent-history-heading">路线草稿记录</h2>
          <button
            type="button"
            className="text-button"
            disabled={!isDesktop || loading}
            onClick={() => void refreshHistory()}
          >
            刷新记录
          </button>
        </div>
        {!historyLoaded && (
          <p className="muted">{loading ? '正在读取草稿…' : '记录未加载，请刷新重试。'}</p>
        )}
        {historyLoaded && !turns.length && (
          <p className="muted">还没有路线草稿。从一个具体目标开始，保持下一步足够小。</p>
        )}
        {turns.length > 0 && (
          <label className="agent-field">
            选择草稿
            <select
              value={selectedId ?? ''}
              onChange={(event) => setSelectedId(event.target.value)}
            >
              {turns
                .slice()
                .reverse()
                .map((turn) => (
                  <option key={turn.id} value={turn.id}>
                    {new Date(turn.createdAt).toLocaleString('zh-CN')} ·{' '}
                    {turn.learningRequest?.goal.slice(0, 32)} · {statusLabels[turn.status]}
                  </option>
                ))}
            </select>
          </label>
        )}
        {selected?.learningRequest && (
          <article className="agent-result">
            <RequestSummary
              request={selected.learningRequest}
              scope={scopeName(selected.learningRequest.sourceId, selected.evidence)}
            />
            <p className="field-hint">
              {selected.evidence.length
                ? `${selected.model} · ${selected.baseUrl}`
                : '本地证据不足说明 · 未调用模型'}
            </p>
            <div className="chat-answer" data-testid="learning-draft-answer">
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
            <p className="field-hint">
              请回到原文核查引用，并用自己的话完成作品。草稿不代表知识已经掌握，也不会自动记录学习时长。
            </p>
            <button
              type="button"
              className="button secondary"
              onClick={() => onTakeNote(selected.learningRequest?.sourceId ?? null)}
            >
              <NotebookPen size={16} /> 去写一份新笔记
            </button>
            <p className="field-hint">
              打开空白笔记供你手动填写，不自动复制或保存模型内容。写完保存后，可在笔记中核对反馈。
            </p>
          </article>
        )}
      </section>
    </section>
  );
}
