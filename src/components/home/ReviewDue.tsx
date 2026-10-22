import { useEffect, useState } from 'react';
import { desktop, errorMessage, isDesktop } from '../../lib/desktop';
import { localDayKey } from '../../lib/calendar';
import type { StudyReview } from '../../lib/types';

export function ReviewDue({ onOpen, paused = false }: { onOpen: () => void; paused?: boolean }) {
  const [records, setRecords] = useState<StudyReview[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    setRecords(null);
    setError('');
    if (!isDesktop || paused) return;
    let cancelled = false;
    void desktop
      .listReviews(null)
      .then((items) => {
        if (!cancelled) setRecords(items);
      })
      .catch((reason) => {
        if (!cancelled) setError(errorMessage(reason));
      });
    return () => {
      cancelled = true;
    };
  }, [paused]);
  const today = localDayKey(new Date());
  const due = records?.filter(
    (item) => item.hasQuestion || (item.reviewDay && item.reviewDay <= today),
  );
  return (
    <section className="review-due">
      <h2>待复习与疑问</h2>
      {!isDesktop ? (
        <p>请在桌面版查看复习记录。</p>
      ) : paused ? (
        <p role="status">备份处理结束后会重新读取。</p>
      ) : error ? (
        <p role="alert">复习记录无法读取：{error}</p>
      ) : !records ? (
        <p role="status">正在读取复习记录…</p>
      ) : (
        <p>
          {due?.length} 项到期安排或未解决疑问；已保存 {records.length} 份作答。
        </p>
      )}
      <button className="text-button" onClick={onOpen}>
        打开轻量复习
      </button>
    </section>
  );
}
