import { useEffect, useState } from 'react';
import { desktop, errorMessage, isDesktop } from '../../lib/desktop';
import { localDayKey } from '../../lib/calendar';
import type { StudyReview } from '../../lib/types';

export function ReviewDue({ onOpen }: { onOpen: () => void }) {
  const [records, setRecords] = useState<StudyReview[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!isDesktop) return;
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
  }, []);
  const today = localDayKey(new Date());
  const due = records.filter(
    (item) => item.hasQuestion || (item.reviewDay && item.reviewDay <= today),
  );
  return (
    <section className="review-due">
      <h2>待复习与疑问</h2>
      <p>
        {due.length} 项到期安排或未解决疑问；已保存 {records.length} 份作答。
      </p>
      <button className="text-button" onClick={onOpen}>
        打开轻量复习
      </button>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
