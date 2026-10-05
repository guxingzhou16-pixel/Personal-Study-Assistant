import { randomUUID } from 'node:crypto';
import type { TaskProposal } from '../../src/lib/types';
import type { Storage } from './storage';
import { AppError } from './errors';
import { chatId } from './chat-storage';
import { readTaskDraft } from './planning-storage';
import { record } from './settings';

// A saved route can suggest one task. Only an explicitly confirmed preview writes it.
export class TaskProposalService {
  private readonly proposals = new Map<string, TaskProposal>();

  constructor(private readonly storage: Storage) {}

  private route(input: unknown) {
    const turn = this.storage.chat.getTurn(input);
    this.storage.chat.get(turn.conversationId, 'learning-agent');
    if (
      !turn.learningRequest ||
      turn.mode !== 'sources' ||
      turn.status !== 'completed' ||
      !Array.isArray(turn.evidence) ||
      !turn.evidence.length ||
      typeof turn.answer !== 'string' ||
      !turn.answer.trim() ||
      !Number.isSafeInteger(turn.revision) ||
      turn.revision < 1
    )
      throw new AppError('taskProposalSource', '请从已完成且有资料证据的学习路线起草任务提议。');
    return turn;
  }

  prepare(turnInput: unknown, requestInput: unknown): TaskProposal {
    const turn = this.route(turnInput);
    const request = record(requestInput);
    if (Object.keys(request).some((key) => !['day', 'projectId', 'edit'].includes(key)))
      throw new AppError('validation', '任务提议请求只能包含日期、关联项目和内容修改。');
    const learning = turn.learningRequest!;
    const content =
      request.edit === undefined
        ? {
            title:
              '学习：' +
              learning.goal
                .replace(/[\r\n]/g, ' ')
                .slice(0, 60)
                .replace(/[\uD800-\uDBFF]$/, ''),
            details: [
              `学习目标：${learning.goal}`,
              `检索词：${learning.query}`,
              '执行提示：回到来源路线，按资料证据阅读并求证；完成一个练习或学习作品；最后记录疑问与下一步。',
            ].join('\n\n'),
            minutes: learning.minutes,
          }
        : record(request.edit);
    if (Object.keys(content).some((key) => !['title', 'details', 'minutes'].includes(key)))
      throw new AppError('validation', '任务提议只能修改标题、说明和预计时长。');
    const draft = readTaskDraft({ ...content, day: request.day, projectId: request.projectId });
    const project =
      draft.projectId === null ? null : this.storage.planning.getProject(draft.projectId);
    if (project?.archived)
      throw new AppError('projectArchived', '不能关联归档项目，请恢复项目或重新选择。');

    const now = Date.now();
    for (const [id, proposal] of this.proposals)
      if (proposal.turnId === turn.id || Date.parse(proposal.expiresAt) <= now)
        this.proposals.delete(id);
    if (this.proposals.size >= 10) this.proposals.delete(this.proposals.keys().next().value!);
    const proposal: TaskProposal = {
      id: randomUUID(),
      turnId: turn.id,
      turnRevision: turn.revision,
      expiresAt: new Date(now + 600_000).toISOString(),
      draft,
      project,
    };
    this.proposals.set(proposal.id, structuredClone(proposal));
    return structuredClone(proposal);
  }

  confirm(input: unknown) {
    const id = chatId(input);
    const proposal = this.proposals.get(id);
    if (!proposal || Date.parse(proposal.expiresAt) <= Date.now())
      throw new AppError('taskProposalExpired', '任务提议已取消、过期或确认，请重新预览。');
    const turn = this.route(proposal.turnId);
    if (turn.revision !== proposal.turnRevision)
      throw new AppError('taskProposalChanged', '来源路线已变化，请重新预览任务提议。');
    const task = this.storage.planning.createFromProposal(proposal.draft, proposal.project, {
      turnId: turn.id,
      turnRevision: turn.revision,
    });
    this.proposals.delete(id);
    return task;
  }

  discard(input: unknown): void {
    this.proposals.delete(chatId(input));
  }
}
