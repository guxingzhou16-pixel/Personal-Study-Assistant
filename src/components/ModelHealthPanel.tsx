import { useEffect, useRef, useState } from 'react';
import { desktop, errorMessage, isDesktop } from '../lib/desktop';
import type { Settings, EmbeddingStatus, ModelProbeReport, ConnectionReport } from '../lib/types';

export function ModelHealthPanel({ settings }: { settings: Settings }) {
  const profile = settings[settings.provider];
  const signature = `${settings.provider}|${profile.baseUrl}|${profile.model}`;
  const current = useRef(signature);
  current.current = signature;
  const [connection, setConnection] = useState<ConnectionReport | null>(null);
  const [files, setFiles] = useState<EmbeddingStatus | null>(null);
  const [generation, setGeneration] = useState<ModelProbeReport | null>(null);
  const [embedding, setEmbedding] = useState<ModelProbeReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [consent, setConsent] = useState(false);
  const remote = !['localhost', '127.0.0.1', '[::1]'].includes(new URL(profile.baseUrl).hostname);
  useEffect(() => {
    setGeneration(null);
    setConnection(null);
    setConsent(false);
    setError('');
  }, [signature]);
  useEffect(() => {
    if (!isDesktop) return;
    let cancelled = false;
    void desktop
      .embeddingStatus()
      .then((value) => {
        if (!cancelled) setFiles(value);
      })
      .catch((reason) => {
        if (!cancelled) setError(errorMessage(reason));
      });
    return () => {
      cancelled = true;
    };
  }, []);
  async function check(kind: 'connection' | 'generation' | 'embedding') {
    if (busy) return;
    const expected = signature;
    setBusy(true);
    setError('');
    try {
      if (kind === 'connection') {
        const value = await desktop.checkConnection(settings.provider, profile);
        if (expected === current.current) setConnection(value);
      } else if (kind === 'generation') {
        const value = await desktop.probeGeneration(
          signature,
          remote && consent ? profile.baseUrl : undefined,
        );
        if (expected === current.current) setGeneration(value);
      } else {
        setEmbedding(null);
        setFiles(await desktop.embeddingStatus());
        setEmbedding(await desktop.probeEmbedding());
      }
    } catch (reason) {
      if (expected === current.current) setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="settings-section model-health" aria-labelledby="health-heading">
      <h2 id="health-heading">模型能力分别检查</h2>
      <p className="field-hint">
        使用已保存的配置。每项只说明本次检查；连接、文件、推理和回答质量是不同状态。不会读取你的资料或自动调用云端。
      </p>
      <ul>
        <li>
          <strong>服务连接与模型列表：</strong>
          {connection
            ? connection.selectedModelAvailable
              ? '本次列表存在所选模型；生成仍需另测。'
              : connection.message
            : '未检查'}
        </li>
        <li>
          <strong>聊天实际生成：</strong>
          {generation?.message ?? '未测试'}
          {generation?.sample && <pre>{generation.sample}</pre>}
        </li>
        <li>
          <strong>嵌入模型文件：</strong>
          {files
            ? files.state === 'ready'
              ? '固定文件已校验；不代表能推理。'
              : files.message
            : '未检查'}
        </li>
        <li>
          <strong>嵌入实际推理：</strong>
          {embedding?.message ?? '未测试；未下载模型时仍可用关键词检索。'}
        </li>
      </ul>
      {remote && (
        <label className="consent-label">
          <input
            type="checkbox"
            checked={consent}
            onChange={(event) => setConsent(event.target.checked)}
          />
          我选择测试当前远程模型，仅发送固定测试文字；可能产生 API 费用。
        </label>
      )}
      <div className="health-actions">
        <button
          className="button secondary"
          disabled={busy || !isDesktop}
          onClick={() => void check('connection')}
        >
          检查已保存连接
        </button>
        <button
          className="button secondary"
          disabled={busy || !isDesktop || !profile.model || (remote && !consent)}
          onClick={() => void check('generation')}
        >
          测试一次实际生成
        </button>
        <button
          className="button secondary"
          disabled={busy || !isDesktop}
          onClick={() => void check('embedding')}
        >
          测试本地嵌入推理
        </button>
      </div>
      {busy && <p role="status">正在检查，请等待结果…</p>}
      {error && (
        <p role="alert" className="feedback error">
          {error} 仍可阅读；嵌入不可用时保留关键词检索。请核对已保存配置、模型和错误提示后重试。
        </p>
      )}
    </section>
  );
}
