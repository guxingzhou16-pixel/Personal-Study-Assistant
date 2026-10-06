import { createHash } from 'node:crypto';
import type { ChatTurn, Conversation, HistoryPreview, HistoryTarget } from '../../src/lib/types';
import type { ChatStorage } from './chat-storage';
import { chatId } from './chat-storage';
import { AppError } from './errors';
import { record, string } from './settings';

function targetInput(input: unknown): HistoryTarget {
  const value = record(input);
  if (
    Object.keys(value).some((key) => !['kind', 'id'].includes(key)) ||
    (value.kind !== 'conversation' && value.kind !== 'learning')
  )
    throw new AppError('validation', '历史记录类型无效。');
  return { kind: value.kind as HistoryTarget['kind'], id: chatId(value.id) };
}

// Versions describe exact saved content, without adding a second revision system to the database.
export class HistoryService {
  constructor(
    private readonly storage: ChatStorage,
    private readonly active: () => ChatTurn | null,
  ) {}

  read(input: unknown): { preview: HistoryPreview; turns: ChatTurn[] } {
    const target = targetInput(input);
    let saved: Conversation | ChatTurn;
    let turns: ChatTurn[];
    let title: string;
    let updatedAt: string;
    if (target.kind === 'conversation') {
      saved = this.storage.get(target.id);
      turns = saved.turns;
      title = saved.title;
      updatedAt = saved.updatedAt;
    } else {
      saved = this.storage.getTurn(target.id);
      this.storage.get(saved.conversationId, 'learning-agent');
      if (!saved.learningRequest) throw new AppError('chatPurpose', '这不是学习路线记录。');
      turns = [saved];
      title = saved.learningRequest.goal;
      updatedAt = saved.createdAt;
    }
    const active = this.active();
    if (
      (target.kind === 'conversation'
        ? active?.conversationId === target.id
        : active?.id === target.id) ||
      turns.some((turn) => turn.status === 'streaming')
    )
      throw new AppError('historyBusy', '请先停止这份记录的生成，再管理或导出。');
    return {
      preview: {
        target,
        title,
        updatedAt,
        turnCount: turns.length,
        version: createHash('sha256').update(JSON.stringify(saved)).digest('hex'),
      },
      turns,
    };
  }

  verify(input: unknown, version: unknown) {
    if (typeof version !== 'string' || !/^[a-f0-9]{64}$/.test(version))
      throw new AppError('validation', '历史记录版本无效，请重新读取。');
    const saved = this.read(input);
    if (saved.preview.version !== version)
      throw new AppError('historyConflict', '记录在操作期间已变化，请重新读取后再确认。');
    return saved;
  }

  rename(input: unknown, version: unknown, titleInput: unknown) {
    const target = { kind: 'conversation' as const, id: chatId(input) };
    this.verify(target, version);
    const title = string(titleInput, '会话标题', 120);
    if (!title || /[\x00-\x1f\x7f]/.test(title))
      throw new AppError('validation', '请填写 1～120 字符的单行会话标题。');
    return this.storage.rename(target.id, title);
  }

  delete(input: unknown, version: unknown): void {
    const { target } = this.verify(input, version).preview;
    if (target.kind === 'conversation') this.storage.deleteConversation(target.id);
    else this.storage.deleteLearningTurn(target.id);
  }
}
