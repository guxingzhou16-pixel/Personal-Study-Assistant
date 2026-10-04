import type { NoteDraft, StudyNote } from './types';

// One shared template keeps the editor, validation and Markdown export aligned.
export const noteSections = [
  {
    key: 'understanding',
    label: '我的理解',
    hint: '用自己的话解释概念，或者写一段能说明问题的代码。',
  },
  {
    key: 'evidence',
    label: '原文依据',
    hint: '粘贴原文和出处，记录页码或标题。这里是手动记录，尚未自动核验。',
  },
  { key: 'questions', label: '待解问题', hint: '哪些地方还不确定？写下需要返回资料求证的问题。' },
  {
    key: 'nextStep',
    label: '下一步练习',
    hint: '一个可以实际完成的小练习。这里不会自动创建任务。',
  },
] as const;

export const noteLimits = { title: 120, section: 20_000, count: 1000 };
export const noteFeedbackLimits = { content: 12_000, question: 1000 };

export function emptyNoteDraft(sourceId: string | null = null): NoteDraft {
  return { title: '', sourceId, understanding: '', evidence: '', questions: '', nextStep: '' };
}

export function noteDraft(note: NoteDraft): NoteDraft {
  return {
    title: note.title,
    sourceId: note.sourceId,
    understanding: note.understanding,
    evidence: note.evidence,
    questions: note.questions,
    nextStep: note.nextStep,
  };
}

export function sameNoteDraft(left: NoteDraft, right: NoteDraft): boolean {
  return (
    left.title === right.title &&
    left.sourceId === right.sourceId &&
    noteSections.every(({ key }) => left[key] === right[key])
  );
}

function metadataText(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').replace(/[\\`*_{}\[\]()#+.!|<>]/g, '\\$&');
}

export function noteMarkdown(note: StudyNote, sourceName: string | null): string {
  const lines = [
    '# ' + metadataText(note.title),
    '',
    '- 创建时间：' + note.createdAt,
    '- 更新时间：' + note.updatedAt,
    '- 关联资料：' + (sourceName ? metadataText(sourceName) : '未关联'),
    ...(note.sourceId ? ['- 资料标识：' + note.sourceId] : []),
    '',
  ];
  for (const { key, label } of noteSections) lines.push('## ' + label, '', note[key], '');
  return lines.join('\n');
}
