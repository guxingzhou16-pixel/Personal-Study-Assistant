import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import {
  defaultSettings,
  type Settings,
  type Source,
  type ParsedDocument,
  type ReadingPosition,
  type SourceSegment,
} from '../../src/lib/types';
import { AppError } from './errors';
import { record, validateSettings } from './settings';
import { DOCUMENT_LIMITS, sourceId } from './documents';
import {
  CHAT_MIGRATION,
  NOTE_FEEDBACK_MIGRATION,
  LEARNING_AGENT_MIGRATION,
  ChatStorage,
} from './chat-storage';
import { NOTES_MIGRATION, NoteStorage } from './note-storage';
import { MEMORIES_MIGRATION, MemoryStorage } from './memory-storage';
import { PLANNING_MIGRATION, TASK_ORIGIN_MIGRATION, PlanningStorage } from './planning-storage';
import { FOCUS_MIGRATION, FocusStorage } from './focus-storage';
import { PRACTICE_MIGRATION } from './practice';
import { REVIEW_MIGRATION, ReviewStorage } from './review-storage';

const SCHEMA_VERSION = 13;

const INITIAL_MIGRATION = `
  CREATE TABLE app_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    value TEXT NOT NULL CHECK (json_valid(value))
  );
  PRAGMA user_version = 1;
`;
const READING_MIGRATION = `
  CREATE TABLE sources (
    id TEXT PRIMARY KEY, name TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('pdf', 'markdown')),
    bytes INTEGER NOT NULL CHECK (bytes > 0),
    page_count INTEGER NOT NULL CHECK (page_count > 0),
    text_status TEXT NOT NULL CHECK (text_status IN ('ready', 'partial', 'none')),
    imported_at TEXT NOT NULL, opened_at TEXT,
    outline TEXT NOT NULL CHECK (json_valid(outline)),
    position TEXT NOT NULL CHECK (json_valid(position))
  );
  CREATE TABLE source_segments (
    source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
    anchor TEXT NOT NULL, title TEXT NOT NULL, depth INTEGER NOT NULL,
    page INTEGER, line INTEGER, text TEXT NOT NULL,
    PRIMARY KEY (source_id, anchor)
  );
  PRAGMA user_version = 2;
`;

export class Storage {
  private readonly db: DatabaseSync;
  readonly chat: ChatStorage;
  readonly notes: NoteStorage;
  readonly memories: MemoryStorage;
  readonly planning: PlanningStorage;
  readonly focus: FocusStorage;
  readonly reviews: ReviewStorage;

  constructor(path: string) {
    this.db = new DatabaseSync(path);
    try {
      this.db.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
      const version = this.schemaVersion;
      if (version > SCHEMA_VERSION)
        throw new AppError('databaseVersion', '数据来自更新的软件版本，请升级应用后再打开。');
      if (version > 0 && version < SCHEMA_VERSION && path !== ':memory:') {
        this.db
          .prepare('VACUUM INTO ?')
          .run(`${path}.before-v${version + 1}-${randomUUID()}.sqlite3`);
      }
      if (version < SCHEMA_VERSION) {
        this.db.exec('BEGIN IMMEDIATE;');
        try {
          if (version === 0) this.db.exec(INITIAL_MIGRATION);
          if (version < 2) this.db.exec(READING_MIGRATION);
          if (version < 3) this.db.exec(CHAT_MIGRATION);
          if (version < 4)
            this.db.exec(`
            ALTER TABLE chat_turns ADD COLUMN mode TEXT NOT NULL DEFAULT 'chat' CHECK(mode IN ('chat', 'sources'));
            ALTER TABLE chat_turns ADD COLUMN evidence TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(evidence));
            PRAGMA user_version = 4;
          `);
          if (version < 5) this.db.exec(NOTES_MIGRATION);
          if (version < 6) this.db.exec(NOTE_FEEDBACK_MIGRATION);
          if (version < 7) this.db.exec(LEARNING_AGENT_MIGRATION);
          if (version < 8) this.db.exec(MEMORIES_MIGRATION);
          if (version < 9) this.db.exec(PLANNING_MIGRATION);
          if (version < 10) this.db.exec(TASK_ORIGIN_MIGRATION);
          if (version < 11) this.db.exec(FOCUS_MIGRATION);
          if (version < 12) this.db.exec(PRACTICE_MIGRATION);
          if (version < 13) this.db.exec(REVIEW_MIGRATION);
          this.db.exec('COMMIT;');
        } catch (error) {
          this.db.exec('ROLLBACK;');
          throw error;
        }
      }
      this.db.exec(
        'CREATE VIRTUAL TABLE temp.fts_probe USING fts5(content); DROP TABLE temp.fts_probe;',
      );
      this.chat = new ChatStorage(this.db);
      this.notes = new NoteStorage(this.db);
      this.memories = new MemoryStorage(this.db);
      this.planning = new PlanningStorage(this.db);
      this.focus = new FocusStorage(this.db);
      this.reviews = new ReviewStorage(this.db, this.chat);
    } catch (error) {
      this.db.close();
      throw error;
    }
  }

  get schemaVersion(): number {
    return Number(this.db.prepare('PRAGMA user_version').get()?.user_version);
  }

  // Main/backup worker only: compare imported schemas with this version's migrations.
  schemaDefinition(): string {
    return JSON.stringify(
      this.db
        .prepare('SELECT type, name, tbl_name, sql FROM sqlite_schema ORDER BY type, name')
        .all(),
    );
  }

  loadSettings(): Settings {
    const row = this.db.prepare('SELECT value FROM app_settings WHERE id = 1').get();
    if (!row) return structuredClone(defaultSettings);
    try {
      return validateSettings(JSON.parse(String(row.value)));
    } catch {
      throw new AppError('settingsCorrupt', '本地设置格式损坏。请保留数据目录并检查备份。');
    }
  }

  saveSettings(input: unknown): Settings {
    const settings = validateSettings(input);
    this.db
      .prepare(
        'INSERT INTO app_settings (id, value) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET value = excluded.value',
      )
      .run(JSON.stringify(settings));
    return settings;
  }

  private source(row: Record<string, unknown>): Source {
    return {
      id: String(row.id),
      name: String(row.name),
      kind: row.kind as Source['kind'],
      bytes: Number(row.bytes),
      pageCount: Number(row.page_count),
      textStatus: row.text_status as Source['textStatus'],
      importedAt: String(row.imported_at),
      openedAt: row.opened_at ? String(row.opened_at) : null,
      outline: JSON.parse(String(row.outline)),
      position: JSON.parse(String(row.position)),
    };
  }
  listSources(): Source[] {
    return this.db
      .prepare('SELECT * FROM sources ORDER BY COALESCE(opened_at, imported_at) DESC, id')
      .all()
      .map((row) => this.source(row));
  }
  getSource(input: unknown): Source | undefined {
    const row = this.db.prepare('SELECT * FROM sources WHERE id = ?').get(sourceId(input));
    return row ? this.source(row) : undefined;
  }
  ensureSourceCapacity(): void {
    const count = Number(this.db.prepare('SELECT count(*) AS count FROM sources').get()!.count);
    if (count >= DOCUMENT_LIMITS.sources)
      throw new AppError(
        'sourceLimit',
        count > DOCUMENT_LIMITS.sources
          ? '现有资料已超过 10000 份支持上限，全部保留且仍可阅读；已停止新增导入。完整备份暂不可用，请先退出应用并完整复制学习数据目录留存，再联系维护者处理，勿删除原数据。'
          : '资料已达到 10000 份上限，不能继续新增；已有资料与阅读进度保留，仍可导出完整备份。',
      );
  }
  addSource(
    input: { id: string; name: string; kind: Source['kind']; bytes: number } & ParsedDocument,
  ): void {
    const id = sourceId(input.id);
    const position: ReadingPosition = {
      page: 1,
      anchor: input.kind === 'pdf' ? 'page-1' : (input.outline[0]?.anchor ?? ''),
      offset: 0,
      zoom: 1,
      tone: 'paper',
    };
    this.db.exec('BEGIN IMMEDIATE;');
    try {
      this.ensureSourceCapacity();
      this.db
        .prepare('INSERT INTO sources VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)')
        .run(
          id,
          input.name,
          input.kind,
          input.bytes,
          input.pageCount,
          input.textStatus,
          new Date().toISOString(),
          JSON.stringify(input.outline),
          JSON.stringify(position),
        );
      const insert = this.db.prepare('INSERT INTO source_segments VALUES (?, ?, ?, ?, ?, ?, ?)');
      for (const segment of input.segments)
        insert.run(
          id,
          segment.anchor,
          segment.title,
          segment.depth,
          segment.page ?? null,
          segment.line ?? null,
          segment.text,
        );
      this.db.exec('COMMIT;');
    } catch (error) {
      this.db.exec('ROLLBACK;');
      throw error;
    }
  }
  touchSource(input: unknown): void {
    this.db
      .prepare('UPDATE sources SET opened_at = ? WHERE id = ?')
      .run(new Date().toISOString(), sourceId(input));
  }
  saveReadingPosition(input: unknown, positionInput: unknown): void {
    const source = this.getSource(input);
    if (!source) throw new AppError('sourceMissing', '这份资料不存在。');
    const position = record(positionInput);
    if (
      Object.keys(position).some(
        (key) => !['page', 'anchor', 'offset', 'zoom', 'tone'].includes(key),
      ) ||
      typeof position.page !== 'number' ||
      !Number.isInteger(position.page) ||
      position.page < 1 ||
      position.page > source.pageCount ||
      typeof position.offset !== 'number' ||
      !Number.isFinite(position.offset) ||
      position.offset < 0 ||
      position.offset > 10_000_000 ||
      typeof position.zoom !== 'number' ||
      ![0.75, 1, 1.25, 1.5, 2].includes(position.zoom) ||
      typeof position.tone !== 'string' ||
      !['paper', 'warm'].includes(position.tone) ||
      typeof position.anchor !== 'string' ||
      (position.anchor !== '' &&
        !source.outline.some((entry) => entry.anchor === position.anchor) &&
        !this.getSegment(source.id, position.anchor))
    ) {
      throw new AppError('readingPosition', '阅读位置格式或页码无效。');
    }
    const safe: ReadingPosition = {
      page: position.page,
      anchor: position.anchor,
      offset: position.offset,
      zoom: position.zoom,
      tone: position.tone as ReadingPosition['tone'],
    };
    this.db
      .prepare('UPDATE sources SET position = ? WHERE id = ?')
      .run(JSON.stringify(safe), source.id);
  }
  getSegment(input: unknown, anchor: string): SourceSegment | undefined {
    const row = this.db
      .prepare('SELECT * FROM source_segments WHERE source_id = ? AND anchor = ?')
      .get(sourceId(input), anchor);
    if (!row) return undefined;
    return {
      anchor: String(row.anchor),
      title: String(row.title),
      depth: Number(row.depth),
      text: String(row.text),
      ...(row.page === null ? {} : { page: Number(row.page) }),
      ...(row.line === null ? {} : { line: Number(row.line) }),
    };
  }

  close(): void {
    this.db.close();
  }
}
