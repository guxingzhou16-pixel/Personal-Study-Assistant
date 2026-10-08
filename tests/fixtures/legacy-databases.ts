import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { defaultSettings, type ChatTurn, type Evidence } from '../../src/lib/types';
import { historicalDDL } from './legacy-schemas';

export const fixtureTime = '2026-10-01T00:00:00.000Z';
export const fixtureText = '# 事务学习\n\n事务要么全部提交，要么全部回滚。\n';
export const fixtureSourceId = createHash('sha256').update(fixtureText).digest('hex');
export const fixtureIds = {
  chat: '11111111-1111-1111-1111-111111111111',
  turn: '22222222-2222-2222-2222-222222222222',
  note: '33333333-3333-3333-3333-333333333333',
  feedback: '44444444-4444-4444-4444-444444444444',
  feedbackTurn: '55555555-5555-5555-5555-555555555555',
  route: '66666666-6666-6666-6666-666666666666',
  routeTurn: '77777777-7777-7777-7777-777777777777',
  memory: '88888888-8888-8888-8888-888888888888',
  project: '99999999-9999-9999-9999-999999999999',
  task: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  focus: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
};
export const fixtureEvidence: Evidence[] = [
  {
    number: 1,
    sourceId: fixtureSourceId,
    sourceName: '事务学习.md',
    kind: 'markdown',
    anchor: 'md-line-1',
    title: '事务学习',
    line: 1,
    start: 0,
    end: '事务要么全部提交，要么全部回滚。'.length,
    text: '事务要么全部提交，要么全部回滚。',
  },
];
export const fixtureRequest = {
  goal: '理解事务',
  query: '事务提交回滚',
  sourceId: fixtureSourceId,
  minutes: 25,
};
export const fixtureMemory = {
  id: fixtureIds.memory,
  title: '学习偏好',
  content: '先阅读再练习',
  kind: 'preference' as const,
  scope: 'local' as const,
  origin: 'manual' as const,
  originTurnId: null,
  revision: 2,
  createdAt: fixtureTime,
  updatedAt: fixtureTime,
};
export const fixtureNote = {
  id: fixtureIds.note,
  sourceId: fixtureSourceId,
  title: '事务笔记',
  understanding: '全部提交或回滚',
  evidence: '手写依据待核对',
  questions: '如何验证？',
  nextStep: '做一次失败事务',
  revision: 3,
  createdAt: fixtureTime,
  updatedAt: fixtureTime,
};
export function fixtureTurn(conversationId: string, extra: Partial<ChatTurn> = {}): ChatTurn {
  return {
    id: fixtureIds.turn,
    conversationId,
    question: '事务是什么？',
    answer: '全部提交或回滚。[1]',
    status: 'completed',
    notice: '',
    provider: 'ollama',
    baseUrl: 'http://127.0.0.1:11434',
    model: 'fixture',
    createdAt: fixtureTime,
    revision: 3,
    mode: 'sources',
    evidence: fixtureEvidence,
    ...extra,
  };
}

// Only historical DDL is used here. Every version has its original columns, checks and indexes.
export function createLegacyDatabase(path: string, version: number, seed = true): void {
  if (!Number.isInteger(version) || version < 1 || version > 11)
    throw new Error('Invalid fixture version');
  const db = new DatabaseSync(path);
  try {
    db.exec('PRAGMA foreign_keys = ON');
    for (const sql of historicalDDL.slice(0, version)) db.exec(sql);
    if (!seed) return;
    const insert = (table: string, row: Record<string, string | number | null>) => {
      const present = new Set(
        db
          .prepare(`PRAGMA table_info(${table})`)
          .all()
          .map((x) => x.name),
      );
      const entries = Object.entries(row).filter(([key]) => key === 'rowid' || present.has(key));
      db.prepare(
        `INSERT INTO ${table} (${entries.map(([key]) => key).join(',')}) VALUES (${entries.map(() => '?').join(',')})`,
      ).run(...entries.map(([, value]) => value));
    };
    const { theme: _theme, ...oldSettings } = defaultSettings;
    insert('app_settings', {
      id: 1,
      value: JSON.stringify({ ...oldSettings, displayName: '独立迁移样本', dailyGoalMinutes: 65 }),
    });
    if (version >= 2) {
      insert('sources', {
        rowid: 8,
        id: fixtureSourceId,
        name: '事务学习.md',
        kind: 'markdown',
        bytes: Buffer.byteLength(fixtureText),
        page_count: 1,
        text_status: 'ready',
        imported_at: fixtureTime,
        opened_at: fixtureTime,
        outline: JSON.stringify([{ anchor: 'md-line-1', title: '事务学习', depth: 1, line: 1 }]),
        position: JSON.stringify({
          page: 1,
          anchor: 'md-line-1',
          offset: 18,
          zoom: 1.25,
          tone: 'warm',
        }),
      });
      insert('source_segments', {
        source_id: fixtureSourceId,
        anchor: 'md-line-1',
        title: '事务学习',
        depth: 1,
        page: null,
        line: 1,
        text: fixtureEvidence[0].text,
      });
    }
    const conversation = (id: string, purpose = 'chat', noteId: string | null = null) =>
      insert('conversations', {
        id,
        title: '历史记录',
        updated_at: fixtureTime,
        note_id: noteId,
        purpose,
      });
    const turn = (
      id: string,
      conversationId: string,
      snapshots: Record<string, string | null> = {},
    ) =>
      insert('chat_turns', {
        rowid: id === fixtureIds.turn ? 21 : id === fixtureIds.feedbackTurn ? 41 : 61,
        id,
        conversation_id: conversationId,
        question: '事务是什么？',
        answer: '全部提交或回滚。[1]',
        status: 'completed',
        notice: '',
        provider: 'ollama',
        base_url: 'http://127.0.0.1:11434',
        model: 'fixture',
        created_at: fixtureTime,
        revision: 3,
        mode: 'sources',
        evidence: JSON.stringify(fixtureEvidence),
        ...snapshots,
      });
    if (version >= 3) {
      conversation(fixtureIds.chat);
      turn(fixtureIds.turn, fixtureIds.chat);
    }
    if (version >= 5)
      insert('notes', {
        id: fixtureNote.id,
        source_id: fixtureSourceId,
        title: fixtureNote.title,
        understanding: fixtureNote.understanding,
        evidence: fixtureNote.evidence,
        questions: fixtureNote.questions,
        next_step: fixtureNote.nextStep,
        revision: 3,
        created_at: fixtureTime,
        updated_at: fixtureTime,
      });
    if (version >= 6) {
      conversation(fixtureIds.feedback, 'note-feedback', fixtureIds.note);
      turn(fixtureIds.feedbackTurn, fixtureIds.feedback, {
        note_snapshot: JSON.stringify(fixtureNote),
      });
    }
    if (version >= 7) {
      conversation(fixtureIds.route, 'learning-agent');
      turn(fixtureIds.routeTurn, fixtureIds.route, {
        learning_request: JSON.stringify(fixtureRequest),
        ...(version >= 8 ? { learning_memories: JSON.stringify([fixtureMemory]) } : {}),
      });
    }
    if (version >= 8)
      insert('memories', {
        id: fixtureMemory.id,
        title: fixtureMemory.title,
        content: fixtureMemory.content,
        kind: fixtureMemory.kind,
        scope: fixtureMemory.scope,
        origin: 'manual',
        origin_turn_id: null,
        revision: 2,
        created_at: fixtureTime,
        updated_at: fixtureTime,
      });
    if (version >= 9) {
      insert('study_projects', {
        id: fixtureIds.project,
        title: '数据库学习',
        goal: '核对事务',
        archived: 1,
        revision: 2,
        created_at: fixtureTime,
        updated_at: fixtureTime,
      });
      insert('daily_tasks', {
        id: fixtureIds.task,
        title: '旧任务',
        details: '已保存说明',
        project_id: fixtureIds.project,
        day: '2026-10-01',
        minutes: 25,
        status: 'completed',
        completed_at: fixtureTime,
        revision: 4,
        created_at: fixtureTime,
        updated_at: fixtureTime,
        ...(version >= 10
          ? {
              origin: 'learning-route',
              origin_turn_id: fixtureIds.routeTurn,
              origin_turn_revision: 3,
            }
          : {}),
      });
    }
    if (version >= 11)
      insert('focus_sessions', {
        id: fixtureIds.focus,
        task_id: fixtureIds.task,
        task_revision: 3,
        task_title: '当时任务',
        task_day: '2026-10-01',
        planned_minutes: 25,
        elapsed_ms: 3456,
        status: 'interrupted',
        reason: 'app-exit',
        review: '需要再练习',
        started_at: fixtureTime,
        ended_at: fixtureTime,
        updated_at: fixtureTime,
        revision: 2,
      });
  } finally {
    db.close();
  }
}

export function snapshotDatabase(path: string, rowids = true) {
  const db = new DatabaseSync(path, { readOnly: true });
  try {
    const tables = db
      .prepare(
        "SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
      )
      .all();
    return Object.fromEntries(
      tables.map(({ name }) => [
        String(name),
        db
          .prepare(
            `SELECT ${rowids ? 'rowid AS original_rowid,' : ''}* FROM ${name} ORDER BY rowid`,
          )
          .all(),
      ]),
    );
  } finally {
    db.close();
  }
}

// Reuse test DATA while independently constructing the actual old SQL structure.
export function copyIntoLegacy(sourcePath: string, destination: string, version: number): void {
  createLegacyDatabase(destination, version, false);
  const source = new DatabaseSync(sourcePath, { readOnly: true });
  const target = new DatabaseSync(destination);
  try {
    for (const { name } of target
      .prepare(
        "SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY rowid",
      )
      .all()) {
      const columns = target
        .prepare(`PRAGMA table_info(${name})`)
        .all()
        .map((row) => String(row.name));
      for (const row of source
        .prepare(`SELECT ${columns.join(',')} FROM ${name} ORDER BY rowid`)
        .all())
        target
          .prepare(
            `INSERT INTO ${name} (${columns.join(',')}) VALUES (${columns.map(() => '?').join(',')})`,
          )
          .run(...columns.map((column) => row[column]));
    }
  } finally {
    source.close();
    target.close();
  }
}
