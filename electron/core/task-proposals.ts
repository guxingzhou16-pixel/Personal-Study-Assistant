import { randomUUID } from 'node:crypto';
import type { TaskProposal, TaskBatchProposal } from '../../src/lib/types';
import { parseLearningPlan, validateLearningPlan } from '../../src/lib/learning-plan';
import type { Storage } from './storage';
import { AppError } from './errors';
import { chatId } from './chat-storage';
import { readTaskDraft } from './planning-storage';
import { record } from './settings';

// Both proposal forms share the source/version boundary and a single-use preview cache.
export class TaskProposalService {
  private readonly proposals = new Map<string, TaskProposal | TaskBatchProposal>();

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
    if (turn.learningRequest.format === 'steps-v1') {
      try {
        parseLearningPlan(turn.answer, turn.evidence, turn.learningRequest.minutes);
      } catch (error) {
        throw new AppError(
          'taskProposalSource',
          `来源路线未通过结构校验：${error instanceof Error ? error.message : '无效结构'}`,
        );
      }
    }
    return turn;
  }

  private remember<T extends TaskProposal | TaskBatchProposal>(proposal: T): T {
    for (const [id, old] of this.proposals)
      if (old.turnId === proposal.turnId || Date.parse(old.expiresAt) <= Date.now())
        this.proposals.delete(id);
    if (this.proposals.size >= 10) this.proposals.delete(this.proposals.keys().next().value!);
    this.proposals.set(proposal.id, structuredClone(proposal));
    return structuredClone(proposal);
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
    const proposal: TaskProposal = {
      id: randomUUID(),
      turnId: turn.id,
      turnRevision: turn.revision,
      expiresAt: new Date(now + 600_000).toISOString(),
      draft,
      project,
    };
    return this.remember(proposal);
  }

  prepareBatch(turnInput: unknown, requestInput: unknown): TaskBatchProposal {
    const turn = this.route(turnInput);
    const request = record(requestInput);
    if (Object.keys(request).some((key) => !['plan', 'indices', 'day', 'projectId'].includes(key)))
      throw new AppError('validation', '多步骤提议只接路线编辑、步骤选择、日期与项目。');
    let plan;
    try {
      parseLearningPlan(turn.answer, turn.evidence, turn.learningRequest!.minutes);
      plan = validateLearningPlan(request.plan, turn.evidence, turn.learningRequest!.minutes);
    } catch (error) {
      throw new AppError(
        'learningOutput',
        `路线未通过校验：${error instanceof Error ? error.message : '结构无效'}`,
      );
    }
    const indices = request.indices;
    if (
      !Array.isArray(indices) ||
      !indices.length ||
      indices.length > plan.steps.length ||
      indices.some(
        (index) => !Number.isSafeInteger(index) || index < 0 || index >= plan.steps.length,
      ) ||
      new Set(indices).size !== indices.length
    )
      throw new AppError('validation', '请勾选不重复的实际步骤，没有自动替你选择。');
    const tasks = indices.map((index) => {
      const step = plan.steps[index];
      const sources = step.citations
        .map((number) => {
          const hit = turn.evidence.find((item) => item.number === number)!;
          return `[${number}] 《${hit.sourceName}》${hit.page ? `第${hit.page}页` : `${hit.title}·第${hit.line}行`}\nstudy-companion://source/${hit.sourceId}#${hit.anchor}`;
        })
        .join('\n');
      return readTaskDraft({
        title: step.title,
        minutes: step.minutes,
        day: request.day,
        projectId: request.projectId,
        details: `步骤 ${index + 1}（用户核对并编辑的路线建议）\n${step.action}\n\n预期作品：${step.artifact}\n\n关联资料（编号有效不代表结论正确）：\n${sources}${plan.limitations ? `\n\n待求证范围：${plan.limitations}` : ''}`,
      });
    });
    const project =
      tasks[0].projectId === null ? null : this.storage.planning.getProject(tasks[0].projectId);
    if (project?.archived) throw new AppError('projectArchived', '不能关联归档项目，请重新选择。');
    return this.remember({
      id: randomUUID(),
      turnId: turn.id,
      turnRevision: turn.revision,
      expiresAt: new Date(Date.now() + 600_000).toISOString(),
      plan,
      indices,
      tasks,
      project,
      budgetMinutes: turn.learningRequest!.minutes,
    });
  }

  confirm(input: unknown) {
    const id = chatId(input);
    const proposal = this.proposals.get(id);
    if (!proposal || !('draft' in proposal) || Date.parse(proposal.expiresAt) <= Date.now())
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

  confirmBatch(input: unknown) {
    const id = chatId(input);
    const proposal = this.proposals.get(id);
    if (!proposal || !('tasks' in proposal) || Date.parse(proposal.expiresAt) <= Date.now())
      throw new AppError('taskProposalExpired', '多步骤预览已取消、过期或确认，请重新预览。');
    const turn = this.route(proposal.turnId);
    if (turn.revision !== proposal.turnRevision)
      throw new AppError('taskProposalChanged', '来源路线已变化，请重新预览。');
    const tasks = this.storage.planning.createManyFromProposal(proposal.tasks, proposal.project, {
      turnId: turn.id,
      turnRevision: turn.revision,
    });
    this.proposals.delete(id);
    return tasks;
  }

  discard(input: unknown): void {
    this.proposals.delete(chatId(input));
  }
}
