import { useEffect, useState } from 'react';
import { desktop, errorMessage, isDesktop } from '../../lib/desktop';
import type { Settings, Source } from '../../lib/types';
import { studyExample } from '../../lib/study-example';
import './FirstUseGuide.css';

export function FirstUseGuide({
  settings,
  onSettings,
  onAsk,
  onRead,
}: {
  settings: Settings;
  onSettings: () => void;
  onAsk: (id: string) => void;
  onRead: (id: string) => void;
}) {
  const [example, setExample] = useState<Source | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!isDesktop) return;
    let cancelled = false;
    void Promise.all([
      crypto.subtle.digest('SHA-256', new TextEncoder().encode(studyExample)),
      desktop.listSources(),
    ])
      .then(([digest, sources]) => {
        if (cancelled) return;
        const id = Array.from(new Uint8Array(digest), (value) =>
          value.toString(16).padStart(2, '0'),
        ).join('');
        const saved = sources.find((source) => source.id === id);
        if (saved) setExample((previous) => previous ?? saved);
      })
      .catch((reason) => {
        if (!cancelled) setError(errorMessage(reason));
      });
    return () => {
      cancelled = true;
    };
  }, []);
  async function importExample() {
    setBusy(true);
    setError('');
    try {
      setExample(await desktop.importExample());
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="first-use-guide">
      <summary>第一次使用：用一份示例开始学习</summary>
      <p>示例由本项目原创，以 MIT 许可提供。模型不可用时，阅读和手写笔记仍可继续。</p>
      <ol>
        <li>
          <strong>导入示例资料</strong>
          <button
            className="button secondary"
            disabled={!isDesktop || busy}
            onClick={() => void importExample()}
          >
            {example ? '核对／重新导入示例' : '导入学习示例'}
          </button>
          {example && (
            <button className="text-button" onClick={() => onRead(example.id)}>
              先阅读示例
            </button>
          )}
        </li>
        <li>
          <strong>选择模型并分别检查</strong>
          <span>
            {settings[settings.provider].model || '尚未配置模型'}；列表存在不代表实际生成可用。
          </span>
          <button className="text-button" onClick={onSettings}>
            前往模型配置与检查
          </button>
        </li>
        <li>
          <strong>完成一次资料问答</strong>
          <span>先预览证据，再决定发送；云端发送会另行确认。</span>
          <button
            className="button secondary"
            disabled={!example}
            onClick={() => onAsk(example!.id)}
          >
            用示例准备第一次提问
          </button>
        </li>
      </ol>
      {error && <p role="alert">{error}</p>}
    </details>
  );
}
