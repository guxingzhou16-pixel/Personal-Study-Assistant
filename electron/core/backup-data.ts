import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import type { BackupCounts, SourceKind } from '../../src/lib/types';
import { backupLimits, backupCountLabels } from '../../src/lib/backup';
import { validPlanningDay } from '../../src/lib/planning';
import { AppError } from './errors';
import { record, validateProfile, validateProvider, validateSettings } from './settings';
import { Storage } from './storage';
import { StudyStorage } from './study-storage';
import { NoteStorage } from './note-storage';
import { MemoryStorage } from './memory-storage';
import { PlanningStorage } from './planning-storage';
import { FocusStorage } from './focus-storage';
import { ChatStorage, chatId } from './chat-storage';
import { DOCUMENT_LIMITS, sourceId } from './documents';
import { parsePractice } from '../../src/lib/practice';
import { ReviewStorage } from './review-storage';
import { parseLearningPlan } from '../../src/lib/learning-plan';
import { localEvidenceExplanation, onlyOverrideEvidence } from './evidence-policy';

export const MAIN_DATABASE = 'study-companion.sqlite3';
export const ACTIVITY_DATABASE = 'study-activity.sqlite3';
function invalid(message = '备份中的学习数据格式损坏，请保留原文件并重新导出。'): never {
  throw new AppError('backupInvalid', message);
}
function integer(value: unknown, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max)
    invalid();
  return value;
}

const schemaQuery = 'SELECT type, name, tbl_name, sql FROM sqlite_schema ORDER BY type, name';
const countTables: Record<keyof BackupCounts, string> = {
  sources: 'sources',
  notes: 'notes',
  conversations: 'conversations',
  turns: 'chat_turns',
  memories: 'memories',
  projects: 'study_projects',
  tasks: 'daily_tasks',
  focusSessions: 'focus_sessions',
  studyDays: 'study_days',
  reviews: 'practice_reviews',
};

function text(input: unknown, limit: number, allowEmpty = true): string {
  if (typeof input !== 'string' || input.length > limit || (!allowEmpty && !input.trim()))
    invalid();
  return input;
}
function timestamp(input: unknown): void {
  if (typeof input !== 'string' || !Number.isFinite(Date.parse(input))) invalid();
}
function anchor(
  input: unknown,
  kind: SourceKind,
  page: unknown,
  line: unknown,
  pages: number,
): string {
  const value = text(input, 100, false);
  if (kind === 'pdf') {
    const number = integer(page, 1, pages);
    if (value !== `page-${number}` || (line !== undefined && line !== null))
      invalid('PDF 出处位置无效。');
  } else {
    const number = integer(line, 1, DOCUMENT_LIMITS.markdown + 1);
    if (value !== `md-line-${number}` || (page !== undefined && page !== null))
      invalid('Markdown 出处位置无效。');
  }
  return value;
}
function checkEvidence(input: unknown, mode: unknown): void {
  if (!Array.isArray(input) || input.length > 4 || (mode === 'chat' && input.length !== 0))
    invalid('问答证据格式无效。');
  for (let index = 0; index < input.length; index++) {
    const hit = record(input[index]);
    if (hit.number !== index + 1 || !['pdf', 'markdown'].includes(String(hit.kind)))
      invalid('问答证据编号或格式无效。');
    sourceId(hit.sourceId);
    if (!text(hit.sourceName, 200).length) invalid();
    text(hit.title, 200);
    anchor(hit.anchor, hit.kind as SourceKind, hit.page, hit.line, DOCUMENT_LIMITS.pages);
    const start = integer(hit.start, 0, DOCUMENT_LIMITS.markdown);
    const end = integer(hit.end, start + 1, DOCUMENT_LIMITS.markdown);
    if (text(hit.text, 800, false).length !== end - start) invalid('问答证据文字与偏移不一致。');
  }
}

function checkDatabase(db: DatabaseSync, version: number, definition: string): void {
  db.exec('PRAGMA trusted_schema = OFF; PRAGMA query_only = ON;');
  if (
    Number(db.prepare('PRAGMA user_version').get()?.user_version) !== version ||
    JSON.stringify(db.prepare(schemaQuery).all()) !== definition
  )
    invalid('数据库版本标识或表结构与当前应用不一致。');
  const check = db.prepare('PRAGMA quick_check(1)').get();
  if (check?.quick_check !== 'ok' || db.prepare('PRAGMA foreign_key_check').get())
    invalid('备份数据库完整性或关联检查失败。');
}

export function inspectDatabases(directory: string): {
  mainVersion: number;
  counts: BackupCounts;
  sources: { path: string; bytes: number; sha256: string }[];
} {
  const expected = new Storage(':memory:');
  const expectedActivity = new StudyStorage(':memory:');
  let main: DatabaseSync | undefined;
  let activity: DatabaseSync | undefined;
  try {
    main = new DatabaseSync(join(directory, MAIN_DATABASE), {
      readOnly: true,
      allowExtension: false,
      defensive: true,
    });
    activity = new DatabaseSync(join(directory, ACTIVITY_DATABASE), {
      readOnly: true,
      allowExtension: false,
      defensive: true,
    });
    const mainVersion = Number(main.prepare('PRAGMA user_version').get()?.user_version);
    const definition =
      mainVersion === 12
        ? JSON.stringify(
            (JSON.parse(expected.schemaDefinition()) as { tbl_name: string }[]).filter(
              (row) => row.tbl_name !== 'practice_reviews',
            ),
          )
        : expected.schemaDefinition();
    if (mainVersion !== 12 && mainVersion !== backupLimits.mainVersion)
      invalid('不支持此备份的主库版本。');
    checkDatabase(main, mainVersion, definition);
    checkDatabase(activity, backupLimits.activityVersion, expectedActivity.schemaDefinition());
    const counts = Object.fromEntries(
      backupCountLabels.map(({ key }) => [
        key,
        key === 'reviews' && mainVersion === 12
          ? 0
          : integer(
              (key === 'studyDays' ? activity! : main!)
                .prepare('SELECT count(*) AS count FROM ' + countTables[key])
                .get()?.count,
              0,
              1_000_000,
            ),
      ]),
    ) as unknown as BackupCounts;
    if (
      counts.sources > backupLimits.files - 2 ||
      counts.notes > 1000 ||
      counts.conversations > 500 ||
      counts.memories > 500 ||
      counts.projects > 200 ||
      counts.tasks > 5000 ||
      counts.focusSessions > 10000 ||
      counts.reviews > 1000
    )
      invalid('备份记录数量超过当前应用限制。');
    if (
      main
        .prepare("SELECT 1 FROM focus_sessions WHERE status IN ('running', 'paused') LIMIT 1")
        .get() ||
      main.prepare("SELECT 1 FROM chat_turns WHERE status = 'streaming' LIMIT 1").get()
    )
      invalid('备份包含尚未结束的生成或专注记录，请先结束这些操作再导出。');
    if (
      main
        .prepare('SELECT 1 FROM chat_turns GROUP BY conversation_id HAVING count(*) > 100 LIMIT 1')
        .get()
    )
      invalid();
    const settings = main.prepare('SELECT value FROM app_settings WHERE id = 1').get();
    if (settings) validateSettings(JSON.parse(String(settings.value)));
    const notes = new NoteStorage(main),
      memories = new MemoryStorage(main),
      planning = new PlanningStorage(main),
      focus = new FocusStorage(main),
      chat = new ChatStorage(main);
    if (mainVersion === 13) {
      const reviews = new ReviewStorage(main, chat);
      for (const row of main.prepare('SELECT id FROM practice_reviews').iterate())
        checkEvidence(reviews.get(row.id).evidence, 'sources');
    }
    for (const row of main.prepare('SELECT id FROM notes').iterate()) notes.get(row.id);
    for (const row of main.prepare('SELECT id FROM memories').iterate()) memories.get(row.id);
    for (const row of main.prepare('SELECT id FROM study_projects').iterate())
      planning.getProject(row.id);
    for (const row of main.prepare('SELECT id FROM daily_tasks').iterate())
      planning.getTask(row.id);
    for (const row of main.prepare('SELECT id FROM focus_sessions').iterate()) focus.get(row.id);
    for (const row of main.prepare('SELECT id FROM chat_turns').iterate()) {
      const turn = chat.getTurn(row.id);
      chatId(turn.id);
      chatId(turn.conversationId);
      // Older releases saved local empty-evidence explanations with revision 0; preserve them.
      const legacyExplanation =
        turn.status === 'completed' &&
        turn.mode === 'sources' &&
        !turn.practiceRequest &&
        Array.isArray(turn.evidence) &&
        turn.evidence.length === 0;
      integer(turn.revision, legacyExplanation ? 0 : 1, Number.MAX_SAFE_INTEGER - 1);
      text(turn.question, 4000, false);
      text(turn.answer, 64000);
      text(turn.notice, 64000);
      timestamp(turn.createdAt);
      if (!['chat', 'sources'].includes(turn.mode)) invalid();
      checkEvidence(turn.evidence, turn.mode);
      const parent = main
        .prepare('SELECT purpose, note_id FROM conversations WHERE id = ?')
        .get(turn.conversationId);
      if (
        !parent ||
        (parent.purpose === 'chat' &&
          (turn.noteSnapshot || turn.learningRequest || turn.learningMemories)) ||
        (parent.purpose === 'note-feedback' &&
          (turn.mode !== 'sources' ||
            !turn.noteSnapshot ||
            turn.noteSnapshot.id !== parent.note_id ||
            turn.learningRequest ||
            turn.practiceRequest)) ||
        (parent.purpose === 'learning-agent' &&
          (turn.mode !== 'sources' ||
            !turn.learningRequest ||
            turn.noteSnapshot ||
            turn.practiceRequest))
      )
        invalid('回答快照与所属会话用途不一致。');
      if (turn.practiceRequest && turn.status === 'completed' && turn.evidence.length)
        parsePractice(turn.answer, turn.evidence);
      if (
        turn.learningRequest?.format === 'steps-v1' &&
        turn.status === 'completed' &&
        turn.evidence.length &&
        !(
          onlyOverrideEvidence(turn.evidence) &&
          turn.answer === localEvidenceExplanation.answer &&
          turn.notice === localEvidenceExplanation.notice
        )
      ) {
        try {
          parseLearningPlan(turn.answer, turn.evidence, turn.learningRequest.minutes);
        } catch {
          invalid('已完成的结构化学习路线格式、引用或时间预算无效。');
        }
      }
      validateProvider(turn.provider);
      validateProfile({ baseUrl: turn.baseUrl, model: turn.model });
    }
    for (const row of main.prepare('SELECT * FROM conversations').iterate()) {
      chatId(row.id);
      text(row.title, 120, false);
      timestamp(row.updated_at);
      if (
        !['chat', 'note-feedback', 'learning-agent'].includes(String(row.purpose)) ||
        (row.purpose === 'note-feedback' && row.note_id === null) ||
        (row.purpose !== 'note-feedback' && row.note_id !== null)
      )
        invalid('会话用途与笔记关联不一致。');
      if (row.note_id !== null) chatId(row.note_id);
    }
    for (const row of activity.prepare('SELECT * FROM study_days').iterate()) {
      if (!validPlanningDay(row.day) || ![0, 1].includes(Number(row.checked_in))) invalid();
      integer(row.study_ms, 0, Number.MAX_SAFE_INTEGER);
    }
    const sources: { path: string; bytes: number; sha256: string }[] = [];
    for (const row of main.prepare('SELECT * FROM sources ORDER BY id').iterate()) {
      const id = sourceId(row.id);
      if (
        !['pdf', 'markdown'].includes(String(row.kind)) ||
        typeof row.name !== 'string' ||
        !row.name ||
        row.name.length > 200
      )
        invalid();
      const kind = row.kind as SourceKind;
      timestamp(row.imported_at);
      if (row.opened_at !== null) timestamp(row.opened_at);
      const bytes = integer(row.bytes, 1, DOCUMENT_LIMITS[kind]);
      const pages = integer(row.page_count, 1, kind === 'pdf' ? DOCUMENT_LIMITS.pages : 1);
      const outline: unknown = JSON.parse(String(row.outline));
      const position = record(JSON.parse(String(row.position)));
      if (
        !Array.isArray(outline) ||
        Object.keys(position).some(
          (key) => !['page', 'anchor', 'offset', 'zoom', 'tone'].includes(key),
        ) ||
        typeof position.anchor !== 'string' ||
        typeof position.zoom !== 'number' ||
        ![0.75, 1, 1.25, 1.5, 2].includes(position.zoom) ||
        typeof position.tone !== 'string' ||
        !['paper', 'warm'].includes(position.tone)
      )
        invalid('资料目录或阅读位置无效。');
      integer(position.page, 1, pages);
      if (
        typeof position.offset !== 'number' ||
        !Number.isFinite(position.offset) ||
        position.offset < 0 ||
        position.offset > 10_000_000
      )
        invalid();
      for (const entry of outline) {
        const item = record(entry);
        anchor(item.anchor, kind, item.page, item.line, pages);
        text(item.title, 200);
        integer(item.depth, 1, kind === 'pdf' ? 10 : 6);
      }
      if (
        position.anchor &&
        !outline.some((item) => record(item).anchor === position.anchor) &&
        !main!
          .prepare('SELECT 1 FROM source_segments WHERE source_id = ? AND anchor = ?')
          .get(id, position.anchor)
      )
        invalid();
      for (const segment of main!
        .prepare('SELECT * FROM source_segments WHERE source_id = ?')
        .iterate(id)) {
        anchor(segment.anchor, kind, segment.page, segment.line, pages);
        text(segment.title, 200);
        integer(segment.depth, 1, kind === 'pdf' ? 1 : 6);
        text(segment.text, DOCUMENT_LIMITS.markdown);
      }
      sources.push({ path: `sources/${id}.${kind === 'pdf' ? 'pdf' : 'md'}`, bytes, sha256: id });
    }
    return { counts, sources, mainVersion };
  } finally {
    main?.close();
    activity?.close();
    expected.close();
    expectedActivity.close();
  }
}
