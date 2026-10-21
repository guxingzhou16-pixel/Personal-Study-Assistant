import { ArrowRight } from 'lucide-react';
import type { Settings } from '../../lib/types';
import './HomeStudy.css';

type Destination = 'planning' | 'library' | 'chat' | 'notes' | 'focus' | 'agent' | 'settings';
const steps: { title: string; detail: string; page: Destination }[] = [
  { title: '设定目标', detail: '在学习计划里安排一个能动手完成的小任务。', page: 'planning' },
  { title: '阅读资料', detail: '打开 PDF 或 Markdown，读到一个具体问题。', page: 'library' },
  { title: '提问求证', detail: '选择资料问答，先看证据；也可生成卡片或短测验。', page: 'chat' },
  { title: '写出理解', detail: '用自己的话写笔记，保存理解、依据和疑问。', page: 'notes' },
  { title: '获得反馈', detail: '在已保存笔记中预览资料依据，再请求 AI 反馈。', page: 'notes' },
  { title: '复盘下一步', detail: '回看专注记录并写复盘，再调整任务或起草路线。', page: 'focus' },
];

export function HomeStudyFlow({
  settings,
  onNavigate,
}: {
  settings: Settings;
  onNavigate: (page: Destination) => void;
}) {
  const profile = settings[settings.provider];
  return (
    <section className="journey home-study-flow" aria-labelledby="home-flow-title">
      <h2 id="home-flow-title">让学习留下痕迹</h2>
      <p>这些入口帮助你安排一次学习，按需要选择；步骤编号不表示完成或掌握进度。</p>
      <ol>
        {steps.map((step, index) => (
          <li key={step.title}>
            <button type="button" onClick={() => onNavigate(step.page)}>
              <span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
              <strong>{step.title}</strong>
              <small>{step.detail}</small>
            </button>
          </li>
        ))}
      </ol>
      <div className="home-model-hint">
        <p>
          {profile.model
            ? `当前已保存的聊天模型：${profile.model}。实际回答需在提问后核对。`
            : '还没选择聊天模型。可以先读资料、写笔记、安排任务和专注，需要 AI 时再选择模型。'}
        </p>
        <button type="button" className="text-button" onClick={() => onNavigate('settings')}>
          {profile.model ? '查看模型设置' : '选择聊天模型'}
          <ArrowRight size={14} />
        </button>
      </div>
      <div className="home-study-actions">
        <button type="button" className="text-button" onClick={() => onNavigate('agent')}>
          起草学习路线
          <ArrowRight size={14} />
        </button>
        <button type="button" className="text-button" onClick={() => onNavigate('settings')}>
          查看学习数据备份
          <ArrowRight size={14} />
        </button>
      </div>
    </section>
  );
}
