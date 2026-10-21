import { useEffect, useState } from 'react';
import type { ChatTurn } from '../../lib/types';
import { desktop, errorMessage, isDesktop } from '../../lib/desktop';
import './GenerationStatus.css';

export function GenerationStatus({ turn }: { turn: ChatTurn }) {
  const [now, setNow] = useState(Date.now);
  const [stopping, setStopping] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    setNow(Date.now());
    setStopping(false);
    setError('');
    if (turn.status !== 'streaming') return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [turn.id, turn.status]);
  if (turn.status !== 'streaming') return null;
  const seconds = Math.max(0, Math.floor((now - Date.parse(turn.createdAt)) / 1000));
  const elapsed = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  async function stop() {
    setStopping(true);
    setError('');
    try {
      await desktop.stopChat(turn.id);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setStopping(false);
    }
  }
  return (
    <section className="generation-status" aria-label="生成状态">
      <div>
        <p role="status">
          {turn.answer ? '正在接收正文，尚未完成。' : '请求已发出，尚未收到正文。'}
        </p>
        <span>
          本次请求已用{' '}
          <time aria-live="off" dateTime={`PT${seconds}S`}>
            {elapsed}
          </time>
        </span>
        {seconds >= 30 && (
          <p className="field-hint">
            模型响应可能较慢。你可以继续等待，或停止后在设置中选择更小的模型。
          </p>
        )}
        {error && <p role="alert">{error}</p>}
      </div>
      <button
        type="button"
        className="button secondary"
        disabled={stopping || !isDesktop}
        onClick={() => void stop()}
      >
        {stopping ? '正在停止…' : '停止本次生成'}
      </button>
    </section>
  );
}
