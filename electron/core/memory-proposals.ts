import { randomUUID } from 'node:crypto';
import type { MemoryProposal } from '../../src/lib/types';
import type { Storage } from './storage';
import { AppError } from './errors';
import { record } from './settings';
import { memoryId, readMemoryDraft } from './memory-storage';

// Proposals are local previews, not saved memory. No model output authorizes writes.
export class MemoryProposalService {
  private readonly proposals = new Map<string, MemoryProposal>();
  constructor(private readonly storage: Storage) {}

  private route(input: unknown) {
    const turn = this.storage.chat.getTurn(input);
    if (
      !turn.learningRequest ||
      turn.status !== 'completed' ||
      !turn.evidence.length ||
      !turn.answer.trim()
    )
      throw new AppError('memoryProposalSource', '请从已完成且有资料证据的路线起草记忆提议。');
    return turn;
  }
  prepare(turnInput: unknown, editInput?: unknown): MemoryProposal {
    const turn = this.route(turnInput);
    const goal = turn.learningRequest!.goal;
    let draft = readMemoryDraft({
      title: '待学习：' + goal.replace(/[\r\n]/g, ' ').slice(0, 60),
      content: goal,
      kind: 'learning',
      scope: 'local',
    });
    if (editInput !== undefined) {
      const edit = record(editInput);
      if (Object.keys(edit).some((key) => !['title', 'content', 'scope'].includes(key)))
        throw new AppError('validation', '记忆提议只能修改标题、内容和使用范围。');
      draft = readMemoryDraft({ ...edit, kind: 'learning' });
    }
    for (const [id, proposal] of this.proposals)
      if (proposal.turnId === turn.id || Date.parse(proposal.expiresAt) < Date.now())
        this.proposals.delete(id);
    if (this.proposals.size >= 10) this.proposals.delete(this.proposals.keys().next().value!);
    const proposal: MemoryProposal = {
      id: randomUUID(),
      turnId: turn.id,
      turnRevision: turn.revision,
      expiresAt: new Date(Date.now() + 600_000).toISOString(),
      draft,
    };
    this.proposals.set(proposal.id, structuredClone(proposal));
    return proposal;
  }
  confirm(input: unknown) {
    const id = memoryId(input);
    const proposal = this.proposals.get(id);
    if (!proposal || Date.parse(proposal.expiresAt) < Date.now())
      throw new AppError('memoryProposalExpired', '记忆提议已取消、过期或确认，请重新预览。');
    const turn = this.route(proposal.turnId);
    if (turn.revision !== proposal.turnRevision)
      throw new AppError('memoryProposalChanged', '来源路线已变化，请重新预览记忆提议。');
    const saved = this.storage.memories.create(proposal.draft, turn.id);
    this.proposals.delete(id);
    return saved;
  }
  discard(input: unknown): void {
    this.proposals.delete(memoryId(input));
  }
}
