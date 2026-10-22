import { ArrowUpRight, BookOpen, Brain, Target, Timer } from 'lucide-react';
import { ReviewDue } from '../home/ReviewDue';
import './LearningTools.css';

export type LearningTool = 'focus' | 'planning' | 'reviews' | 'memories';
const tools = [
  { id: 'focus', name: '专注时光', detail: '番茄钟、历史与复盘', icon: Timer },
  { id: 'planning', name: '学习计划', detail: '学习项目与每日任务', icon: Target },
  { id: 'reviews', name: '轻量复习', detail: '回看作答与未解疑问', icon: BookOpen },
  { id: 'memories', name: '长期记忆', detail: '查看与管理学习记忆', icon: Brain },
] as const;

export function LearningTools({
  onOpen,
  paused,
}: {
  onOpen: (page: LearningTool) => void;
  paused: boolean;
}) {
  return (
    <section className="learning-tools" aria-labelledby="learning-tools-title">
      <div className="section-heading">
        <h2 id="learning-tools-title">学习工具</h2>
        <span>按需要使用</span>
      </div>
      <div className="learning-tool-grid">
        {tools.map(({ id, name, detail, icon: Icon }) => (
          <button type="button" key={id} aria-label={name} onClick={() => onOpen(id)}>
            <Icon size={20} aria-hidden="true" />
            <span>
              <strong>{name}</strong>
              <small>{detail}</small>
            </span>
            <ArrowUpRight size={17} aria-hidden="true" />
          </button>
        ))}
      </div>
      <ReviewDue onOpen={() => onOpen('reviews')} paused={paused} />
    </section>
  );
}
