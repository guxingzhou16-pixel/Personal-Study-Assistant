import type { ChatTurn, HistoryPreview } from '../../src/lib/types';

const statusLabels: Record<ChatTurn['status'], string> = {
  streaming: '生成中',
  completed: '已完成',
  stopped: '已停止',
  error: '未完成',
  interrupted: '已中断',
};

// Literal blocks preserve model/user text without turning HTML, images or links into active content.
function literal(text: string): string {
  const runs = text.match(/`+/g) ?? [];
  const fence = '`'.repeat(Math.max(3, ...runs.map((run) => run.length + 1)));
  return `${fence}text\n${text}\n${fence}`;
}

export function historyMarkdown(preview: HistoryPreview, turns: ChatTurn[]): string {
  const parts = [
    `# 拾知 · ${preview.target.kind === 'learning' ? '学习路线' : '会话'}记录`,
    literal(preview.title),
    `记录标识：${preview.target.id}\n\n记录时间：${preview.updatedAt}`,
    '仅包含已保存内容；模型回答不代表知识已掌握。原文与记忆快照可能包含私人内容。引用位置供人工核对，导出文件不提供应用内跳转，也不能用于恢复数据。',
  ];
  for (const [index, turn] of turns.entries()) {
    parts.push(
      `## 第 ${index + 1} 份问答`,
      `保存时间：${turn.createdAt}\n\n状态：${statusLabels[turn.status]}\n\n轮次标识：${turn.id} · 版本 ${turn.revision}`,
      '### 问题',
      literal(turn.question),
      '### 回答',
      literal(turn.answer),
      '### 模型与提示',
      literal(
        `方式：${turn.mode === 'sources' ? '资料问答' : '普通聊天'}\n服务：${turn.provider}\n地址：${turn.baseUrl}\n模型：${turn.model}\n${turn.notice}`,
      ),
    );
    if (turn.learningRequest) {
      const request = turn.learningRequest;
      parts.push(
        '### 学习请求',
        literal(
          `目标：${request.goal}\n检索词：${request.query}\n资料标识：${request.sourceId ?? '全部资料'}\n时间预算：${request.minutes} 分钟（不是实际学习时长）`,
        ),
      );
      parts.push('### 当时选择的记忆快照');
      for (const memory of turn.learningMemories ?? [])
        parts.push(
          literal(
            `标题：${memory.title}\n内容：${memory.content}\n类别：${memory.kind}\n范围：${memory.scope}\n标识：${memory.id}\n版本：${memory.revision}\n来源：${memory.origin}\n来源路线：${memory.originTurnId ?? '无'}`,
          ),
        );
      if (!turn.learningMemories?.length) parts.push('当时没有选择记忆。');
      if (!turn.evidence.length) parts.push('当时只保存本地说明，未调用模型或向模型发送记忆。');
    }
    parts.push('### 本次保存的资料证据');
    for (const evidence of turn.evidence)
      parts.push(
        `#### 证据 [${evidence.number}]`,
        literal(
          `资料：${evidence.sourceName}\n格式：${evidence.kind}\n标题：${evidence.title}\n资料标识：${evidence.sourceId}\n锚点：${evidence.anchor}\n页码：${evidence.page ?? '无'}\n标题行号：${evidence.line ?? '无'}\nUTF-16 偏移：[${evidence.start}, ${evidence.end})\n\n${evidence.text}`,
        ),
      );
    if (!turn.evidence.length) parts.push('无保存的资料证据。');
  }
  return parts.join('\n\n') + '\n';
}
