import { useCallback, useEffect, useRef, useState } from 'react';
import { NotebookPen, Search, Send, Settings2, Square } from 'lucide-react';
import { desktop, errorMessage, isDesktop } from '../lib/desktop';
import { learningLimits, sameLearningRequest } from '../lib/learning';
import { memoryAllowed, memoryKindLabels, memoryLimits, memoryScopeLabels } from '../lib/memories';
import type {
  ChatTurn,
  DailyTask,
  LearningPreview,
  LearningRequest,
  RetrievalProgress,
  Settings,
  Source,
  StudyMemory,
} from '../lib/types';
import { EvidenceCards } from './EvidenceCards';
import { ModelAnswer } from './ModelAnswer';
import { MemoryProposalPanel } from './MemoryProposalPanel';
import { TaskProposalPanel } from './TaskProposalPanel';
import { HistoryActions } from './HistoryActions';
import './AgentMemory.css';

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

function memorySelectionKey(memories: StudyMemory[]): string {
  return memories.map((memory) => `${memory.id}:${memory.revision}`).join('|');
}

function MemorySnapshots({ memories }: { memories: StudyMemory[] }) {
  return (
    <ul className="agent-memory-snapshots">
      {memories.map((memory) => (
        <li key={memory.id}>
          <strong>
            {memory.title} · 第 {memory.revision} 版
          </strong>
          <p>{memory.content}</p>
          <p className="field-hint">
            {memoryKindLabels[memory.kind]} · {memoryScopeLabels[memory.scope]} · 来源：
            {memory.origin === 'manual' ? '手动记录' : '学习路线提议'}
          </p>
          {memory.originTurnId && (
            <details>
              <summary>查看来源路线标识</summary>
              <small>{memory.originTurnId}</small>
            </details>
          )}
        </li>
      ))}
    </ul>
  );
}

export function AgentPage({
  visible,
  settings,
  onSettings,
  onOpenCitation,
  onTakeNote,
  onTaskSaved,
  onOpenTask,
  presetTurn,
}: {
  visible: boolean;
  settings: Settings;
  onSettings: () => void;
  onOpenCitation: (turnId: string, number: number) => Promise<void>;
  onTakeNote: (sourceId: string | null) => void;
  onTaskSaved: () => void;
  onOpenTask: (task: DailyTask) => void;
  presetTurn?: { id: string; sequence: number } | null;
}) {
  const [goal, setGoal] = useState('');
  const [query, setQuery] = useState('');
  const [sourceId, setSourceId] = useState('');
  const [minutes, setMinutes] = useState('30');
  const [sources, setSources] = useState<Source[]>([]);
  const [memories, setMemories] = useState<StudyMemory[]>([]);
  const [memoryIds, setMemoryIds] = useState<string[]>([]);
  const [memoriesLoaded, setMemoriesLoaded] = useState(false);
  const [memoriesLoading, setMemoriesLoading] = useState(false);
  const [memoryError, setMemoryError] = useState('');
  const [preview, setPreview] = useState<LearningPreview | null>(null);
  const [previewProfile, setPreviewProfile] = useState<string | null>(null);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [active, setActive] = useState<ChatTurn | null>(null);
  const [activeLoaded, setActiveLoaded] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [historyBusy, setHistoryBusy] = useState(false);
  const [searching, setSearching] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState<RetrievalProgress | null>(null);
  const [consentKey, setConsentKey] = useState<string | null>(null);
  const mounted = useRef(true);
  const revisions = useRef(new Map<string, number>());
  const seenDrafts = useRef(new Map<string, ChatTurn>());
  const deletedDrafts = useRef(new Set<string>());
  const activityVersion = useRef(0);
  const searchVersion = useRef(0);
  const loadVersion = useRef(0);
  const memoryLoadVersion = useRef(0);
  const handledPreset = useRef<number | null>(null);
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
  const currentProfile = useRef(profile.baseUrl);
  currentProfile.current = profile.baseUrl;
  const availableMemories = memories.filter((memory) =>
    memoryAllowed(memory.scope, profile.baseUrl),
  );
  const selectedMemories = memoryIds.flatMap((id) => {
    const memory = availableMemories.find((item) => item.id === id);
    return memory ? [memory] : [];
  });
  const selectionKey = memorySelectionKey(selectedMemories);
  const currentPreparation = useRef({ signature, selectionKey });
  currentPreparation.current = { signature, selectionKey };
  const confirmationKey = `${signature}|${preview?.evidence.id ?? ''}`;
  const consent = consentKey === confirmationKey;
  const remote = !['localhost', '127.0.0.1', '[::1]'].includes(new URL(profile.baseUrl).hostname);
  const previewValid = Boolean(
    preview &&
    sameLearningRequest(preview.request, request) &&
    previewProfile === signature &&
    selectedMemories.length === memoryIds.length &&
    memorySelectionKey(preview.memories) === selectionKey,
  );
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

  const invalidatePreview = useCallback(() => {
    searchVersion.current++;
    setPreview(null);
    setPreviewProfile(null);
    setConsentKey(null);
  }, []);

  const refreshMemories = useCallback(async () => {
    const version = ++memoryLoadVersion.current;
    invalidatePreview();
    setMemoriesLoading(true);
    setMemoryError('');
    try {
      const items = await desktop.listMemories();
      if (!mounted.current || version !== memoryLoadVersion.current) return;
      setMemories(items);
      setMemoryIds((previous) =>
        previous.filter((id) =>
          items.some(
            (memory) => memory.id === id && memoryAllowed(memory.scope, currentProfile.current),
          ),
        ),
      );
      setMemoriesLoaded(true);
    } catch (reason) {
      if (mounted.current && version === memoryLoadVersion.current)
        setMemoryError(errorMessage(reason));
    } finally {
      if (mounted.current && version === memoryLoadVersion.current) setMemoriesLoading(false);
    }
  }, [invalidatePreview]);

  const applyTurn = useCallback((turn: ChatTurn) => {
    if (deletedDrafts.current.has(turn.id)) return;
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
    const knownIds = new Set(seenDrafts.current.keys());
    setLoading(true);
    setError('');
    const [saved, running] = await Promise.allSettled([
      desktop.listLearningDrafts(),
      desktop.activeChat(),
    ]);
    if (!mounted.current || version !== loadVersion.current) return;
    const failures: string[] = [];
    if (saved.status === 'fulfilled') {
      // An absent record known before the read is really gone, even if its delete reply was lost.
      // Only new live drafts arriving during this read may supplement the saved list.
      const savedIds = new Set(saved.value.map((turn) => turn.id));
      for (const id of knownIds) {
        if (savedIds.has(id)) continue;
        deletedDrafts.current.add(id);
        seenDrafts.current.delete(id);
        revisions.current.delete(id);
      }
      let items = saved.value.filter((turn) => !deletedDrafts.current.has(turn.id));
      for (const turn of seenDrafts.current.values()) items = mergeDraft(items, turn);
      for (const turn of items) {
        revisions.current.set(
          turn.id,
          Math.max(revisions.current.get(turn.id) ?? -1, turn.revision),
        );
        seenDrafts.current.set(turn.id, turn);
      }
      setTurns(items);
      setSelectedId((previous) =>
        items.some((turn) => turn.id === previous) ? previous : (items.at(-1)?.id ?? null),
      );
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
      memoryLoadVersion.current++;
      stopUpdates();
      stopProgress();
    };
  }, [applyTurn, refreshHistory]);

  useEffect(() => {
    invalidatePreview();
    setMemoryIds((previous) =>
      previous.filter((id) =>
        memories.some((memory) => memory.id === id && memoryAllowed(memory.scope, profile.baseUrl)),
      ),
    );
  }, [signature, invalidatePreview]);

  useEffect(() => {
    if (!visible || !isDesktop) return;
    void refreshMemories();
    return () => {
      memoryLoadVersion.current++;
    };
  }, [visible, refreshMemories]);

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

  useEffect(() => {
    if (
      !visible ||
      !historyLoaded ||
      loading ||
      !presetTurn ||
      handledPreset.current === presetTurn.sequence
    )
      return;
    handledPreset.current = presetTurn.sequence;
    const source = turns.find((turn) => turn.id === presetTurn.id);
    if (!source?.learningRequest) {
      setError('未找到这项任务的来源路线，可能已删除。任务和来源标识仍保留，可刷新路线记录核对。');
      return;
    }
    setSelectedId(source.id);
    setError('');
  }, [visible, historyLoaded, loading, presetTurn, turns]);

  function scopeName(id: string | null, hits: ChatTurn['evidence'] = []) {
    if (!id) return '全部已导入资料';
    return (
      sources.find((source) => source.id === id)?.name ??
      hits.find((hit) => hit.sourceId === id)?.sourceName ??
      '指定资料'
    );
  }

  async function prepare() {
    if (
      searching ||
      sending ||
      historyBusy ||
      memoriesLoading ||
      !requestValid ||
      selectedMemories.length !== memoryIds.length
    )
      return;
    const version = ++searchVersion.current;
    const preparation = { signature, selectionKey };
    setSearching(true);
    setError('');
    setPreview(null);
    setConsentKey(null);
    setProgress(null);
    try {
      const result = await desktop.prepareLearningDraft(request, memoryIds);
      if (
        mounted.current &&
        version === searchVersion.current &&
        sameLearningRequest(result.request, currentRequest.current) &&
        preparation.signature === currentPreparation.current.signature &&
        preparation.selectionKey === currentPreparation.current.selectionKey
      ) {
        if (memorySelectionKey(result.memories) !== currentPreparation.current.selectionKey)
          setError('所选记忆已变化，请刷新记忆，再重新准备路线证据。');
        else {
          setPreview(result);
          setPreviewProfile(preparation.signature);
        }
      }
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
      historyBusy ||
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
      setPreviewProfile(null);
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

  function deletedDraft(id: string) {
    deletedDrafts.current.add(id);
    seenDrafts.current.delete(id);
    revisions.current.delete(id);
    setTurns((previous) => previous.filter((turn) => turn.id !== id));
    setSelectedId((previous) => (previous === id ? null : previous));
    void refreshHistory();
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
        <fieldset className="agent-memory-selection">
          <legend>本次参考的记忆（可选，最多 {memoryLimits.selection} 条）</legend>
          <p className="field-hint">
            默认不选。停用的记忆，以及当前远程地址不能使用的仅本机记忆，不出现在列表中。
          </p>
          <button
            type="button"
            className="text-button"
            disabled={!isDesktop || memoriesLoading || sending}
            onClick={() => void refreshMemories()}
          >
            刷新记忆
          </button>
          {memoryError && (
            <p className="feedback error" role="alert">
              {memoryError}
            </p>
          )}
          {!memoriesLoaded && (
            <p className="muted">
              {memoriesLoading ? '正在读取记忆…' : '记忆未加载，请刷新重试。'}
            </p>
          )}
          {memoriesLoaded && !availableMemories.length && (
            <p className="muted">当前没有可用记忆，可以直接准备路线。</p>
          )}
          <div className="agent-memory-options">
            {availableMemories.map((memory) => (
              <label key={memory.id}>
                <input
                  type="checkbox"
                  checked={memoryIds.includes(memory.id)}
                  disabled={
                    sending ||
                    memoriesLoading ||
                    (!memoryIds.includes(memory.id) && memoryIds.length >= memoryLimits.selection)
                  }
                  onChange={(event) => {
                    setMemoryIds((previous) =>
                      event.target.checked
                        ? [...previous, memory.id]
                        : previous.filter((id) => id !== memory.id),
                    );
                    invalidatePreview();
                  }}
                />
                <span>
                  <strong>{memory.title}</strong>
                  <small>
                    {memoryKindLabels[memory.kind]} · {memoryScopeLabels[memory.scope]}
                  </small>
                </span>
              </label>
            ))}
          </div>
          <p className="field-hint">
            已选 {memoryIds.length} 条。记忆只用来调整学习建议，不作为资料事实或已掌握的证明。
          </p>
        </fieldset>
        <div className="agent-actions">
          <button
            type="button"
            className="button secondary"
            disabled={
              !isDesktop ||
              searching ||
              sending ||
              memoriesLoading ||
              !requestValid ||
              selectedMemories.length !== memoryIds.length
            }
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
            <h4>本次参考的记忆</h4>
            {preview.memories.length ? (
              <MemorySnapshots memories={preview.memories} />
            ) : (
              <p>未选择记忆。</p>
            )}
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
                允许将上面的目标、检索词、时间安排、所选记忆和检索片段发送至 {profile.baseUrl}（
                {profile.model || '未选择模型'}）；服务费用由我承担。
              </label>
            )}
            <p className="field-hint">
              路线作为建议单独保存。它不会创建任务、标记进度或自动写入长期记忆。
            </p>
            <button
              type="button"
              className="button primary"
              disabled={
                !activeLoaded ||
                searching ||
                sending ||
                historyBusy ||
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
            disabled={!isDesktop || loading || historyBusy}
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
              disabled={historyBusy}
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
            <HistoryActions
              key={`history-${selected.id}`}
              target={{ kind: 'learning', id: selected.id }}
              disabled={loading || sending || searching || active?.id === selected.id}
              onDeleted={deletedDraft}
              onBusyChange={setHistoryBusy}
            />
            <RequestSummary
              request={selected.learningRequest}
              scope={scopeName(selected.learningRequest.sourceId, selected.evidence)}
            />
            <details className="agent-memory-history">
              <summary>本次选择的记忆快照（{selected.learningMemories?.length ?? 0} 条）</summary>
              <p className="field-hint">
                这是这条路线保存的选择快照，记录之后可能已更新、停用或删除；下次路线只使用你重新选择的当前记忆。
              </p>
              {!selected.evidence.length && (
                <p className="field-hint">当时仅保存本地说明，没有向模型发送记忆。</p>
              )}
              {selected.learningMemories?.length ? (
                <MemorySnapshots memories={selected.learningMemories} />
              ) : (
                <p>当时没有使用记忆。</p>
              )}
            </details>
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
            {selected.status === 'completed' &&
              selected.evidence.length > 0 &&
              Boolean(selected.answer.trim()) && (
                <>
                  <TaskProposalPanel
                    key={`task-${selected.id}`}
                    turn={selected}
                    visible={visible}
                    onSaved={onTaskSaved}
                    onOpenTask={onOpenTask}
                    onCleanupError={setError}
                  />
                  <MemoryProposalPanel
                    key={selected.id}
                    turn={selected}
                    visible={visible}
                    onSaved={() => void refreshMemories()}
                    onCleanupError={setError}
                  />
                </>
              )}
          </article>
        )}
      </section>
    </section>
  );
}
