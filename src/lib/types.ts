export type Provider = 'ollama' | 'openai';
export type ResponseStyle = 'gentle' | 'game' | 'coach';
export type Theme = 'modern' | 'study' | 'playful';

export interface ModelProfile {
  baseUrl: string;
  model: string;
}

export interface Settings {
  displayName: string;
  dailyGoalMinutes: number;
  responseStyle: ResponseStyle;
  theme: Theme;
  provider: Provider;
  ollama: ModelProfile;
  openai: ModelProfile;
}

export interface Bootstrap {
  settings: Settings;
  dataDir: string;
  schemaVersion: number;
  hasApiKey: boolean;
}

export interface ConnectionReport {
  models: string[];
  selectedModelAvailable: boolean;
  message: string;
}

export interface AppFailure {
  code: string;
  message: string;
}

export interface StudyDay {
  day: string;
  checkedIn: boolean;
  studySeconds: number;
}

export interface StudyOverview {
  today: StudyDay;
  days: StudyDay[];
  running: boolean;
}
export type Reply<T> = { ok: true; value: T } | { ok: false; error: AppFailure };
export type SourceKind = 'pdf' | 'markdown';
export interface OutlineEntry {
  anchor: string;
  title: string;
  depth: number;
  page?: number;
  line?: number;
}
export interface ReadingPosition {
  page: number;
  anchor: string;
  offset: number;
  zoom: number;
  tone: 'paper' | 'warm';
}
export interface Source {
  id: string;
  name: string;
  kind: SourceKind;
  bytes: number;
  pageCount: number;
  textStatus: 'ready' | 'partial' | 'none';
  importedAt: string;
  openedAt: string | null;
  outline: OutlineEntry[];
  position: ReadingPosition;
}
export interface SourceSegment extends OutlineEntry {
  text: string;
}
export interface ParsedDocument {
  pageCount: number;
  textStatus: Source['textStatus'];
  outline: OutlineEntry[];
  segments: SourceSegment[];
}
export interface OpenDocument {
  source: Source;
  text?: string;
  data?: Uint8Array;
}
export interface ImportProgress {
  file: string;
  current: number;
  total: number;
  message: string;
}
export interface ImportReport {
  added: number;
  duplicates: number;
  cancelled: boolean;
  failures: { file: string; message: string }[];
}
export interface ChatTurn {
  id: string;
  conversationId: string;
  question: string;
  answer: string;
  status: 'streaming' | 'completed' | 'stopped' | 'error' | 'interrupted';
  notice: string;
  provider: Provider;
  baseUrl: string;
  model: string;
  createdAt: string;
  revision: number;
  mode: 'chat' | 'sources';
  evidence: Evidence[];
  noteSnapshot?: StudyNote;
  learningRequest?: LearningRequest;
  learningMemories?: StudyMemory[];
  practiceRequest?: PracticeRequest;
}
export type PracticeKind = 'cards' | 'quiz';
export interface PracticeRequest {
  kind: PracticeKind;
  topic: string;
  sourceId: string | null;
}
export interface PracticeItem {
  question: string;
  answer: string;
  citations: number[];
}
export interface PracticePreview {
  request: PracticeRequest;
  evidence: EvidencePreview;
}
export interface PracticeSendRequest {
  conversationId: string;
  retrievalId: string;
  expectedProfile: string;
  consentEndpoint?: string;
}
export interface Evidence {
  number: number;
  sourceId: string;
  sourceName: string;
  kind: SourceKind;
  anchor: string;
  title: string;
  page?: number;
  line?: number;
  start: number;
  end: number;
  text: string;
}
export interface EvidencePreview {
  id: string;
  question: string;
  sourceId: string | null;
  sourceCount: number;
  notice: string;
  hits: Evidence[];
}
export interface RetrievalProgress {
  current: number;
  total: number;
  message: string;
}
export interface EmbeddingStatus {
  state: 'missing' | 'downloading' | 'invalid' | 'ready';
  name: string;
  dimensions: number;
  bytes: number;
  revision: string;
  message: string;
}
export interface ModelProbeReport {
  available: boolean;
  message: string;
  checkedAt: string;
  profile?: string;
  sample?: string;
}
export interface CitationTarget {
  sourceId: string;
  anchor: string;
  page: number;
}
export type ReadingSelection = Omit<Evidence, 'number'>;
export interface ReviewDraft {
  turnId: string;
  itemIndex: number;
  revision: number;
  response: string;
  hasQuestion: boolean;
  reviewDay: string | null;
}
export interface StudyReview extends ReviewDraft {
  id: string;
  turnRevision: number;
  topic: string;
  question: string;
  referenceAnswer: string;
  citations: number[];
  evidence: Evidence[];
  createdAt: string;
  updatedAt: string;
}
export interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: string;
}
export interface Conversation extends ConversationSummary {
  turns: ChatTurn[];
}
export interface HistoryTarget {
  kind: 'conversation' | 'learning';
  id: string;
}
export interface HistoryPreview {
  target: HistoryTarget;
  title: string;
  updatedAt: string;
  turnCount: number;
  version: string;
}
export interface HistoryExportResult {
  cancelled: boolean;
  fileName?: string;
}
export interface ChatRequest {
  conversationId: string;
  question: string;
  consentEndpoint?: string;
  expectedProfile?: string;
  retrievalId?: string;
}
export interface NoteDraft {
  title: string;
  sourceId: string | null;
  understanding: string;
  evidence: string;
  questions: string;
  nextStep: string;
}
export interface StudyNote extends NoteDraft {
  id: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
}
export interface NoteSummary {
  id: string;
  title: string;
  sourceId: string | null;
  sourceName: string | null;
  updatedAt: string;
}
export interface NoteSaveRequest extends NoteDraft {
  id: string | null;
  revision: number;
}
export interface NoteExportResult {
  cancelled: boolean;
  fileName?: string;
}
export interface NoteFeedbackPreview {
  note: StudyNote;
  evidence: EvidencePreview;
}
export interface NoteFeedbackRequest {
  retrievalId: string;
  expectedProfile: string;
  consentEndpoint?: string;
}
export interface LearningRequest {
  goal: string;
  query: string;
  sourceId: string | null;
  minutes: number;
  format?: 'steps-v1';
}
export interface LearningStep {
  title: string;
  action: string;
  minutes: number;
  citations: number[];
  artifact: string;
}
export interface LearningPlan {
  steps: LearningStep[];
  limitations: string;
}
export interface LearningPreview {
  request: LearningRequest;
  evidence: EvidencePreview;
  memories: StudyMemory[];
}
export interface LearningDraftRequest {
  retrievalId: string;
  expectedProfile: string;
  consentEndpoint?: string;
}
export type MemoryKind = 'preference' | 'learning';
export type MemoryScope = 'disabled' | 'local' | 'remote';
export interface MemoryDraft {
  title: string;
  content: string;
  kind: MemoryKind;
  scope: MemoryScope;
}
export interface StudyMemory extends MemoryDraft {
  id: string;
  revision: number;
  origin: 'manual' | 'learning-route';
  originTurnId: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface MemorySaveRequest extends MemoryDraft {
  id: string | null;
  revision: number;
}
export interface MemoryProposalEdit {
  title: string;
  content: string;
  scope: MemoryScope;
}
export interface MemoryProposal {
  id: string;
  turnId: string;
  turnRevision: number;
  expiresAt: string;
  draft: MemoryDraft;
}
export interface ProjectDraft {
  title: string;
  goal: string;
  archived: boolean;
}
export interface StudyProject extends ProjectDraft {
  id: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
}
export interface ProjectSaveRequest extends ProjectDraft {
  id: string | null;
  revision: number;
}
export interface TaskDraft {
  title: string;
  details: string;
  projectId: string | null;
  day: string;
  minutes: number;
}
export interface DailyTask extends TaskDraft {
  id: string;
  revision: number;
  status: 'todo' | 'completed';
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  origin: 'manual' | 'learning-route';
  originTurnId: string | null;
  originTurnRevision: number | null;
}
export interface TaskSaveRequest extends TaskDraft {
  id: string | null;
  revision: number;
}
export interface PlanningOverview {
  day: string;
  projects: StudyProject[];
  tasks: DailyTask[];
}
export interface TaskProposalEdit {
  title: string;
  details: string;
  minutes: number;
}
export interface TaskProposalRequest {
  day: string;
  projectId: string | null;
  edit?: TaskProposalEdit;
}
export interface TaskProposal {
  id: string;
  turnId: string;
  turnRevision: number;
  expiresAt: string;
  draft: TaskDraft;
  project: StudyProject | null;
}
export interface TaskBatchRequest {
  plan: LearningPlan;
  indices: number[];
  day: string;
  projectId: string | null;
}
export interface TaskBatchProposal {
  id: string;
  turnId: string;
  turnRevision: number;
  expiresAt: string;
  plan: LearningPlan;
  indices: number[];
  tasks: TaskDraft[];
  project: StudyProject | null;
  budgetMinutes: number;
}
export type FocusStatus = 'running' | 'paused' | 'completed' | 'stopped' | 'interrupted';
export type FocusEndReason =
  | 'elapsed'
  | 'user-stop'
  | 'sleep'
  | 'heartbeat-gap'
  | 'app-exit'
  | 'app-restart'
  | 'renderer-reload'
  | 'storage-error';
export interface FocusSession {
  id: string;
  taskId: string;
  taskRevision: number;
  taskTitle: string;
  taskDay: string;
  plannedMinutes: number;
  elapsedMs: number;
  status: FocusStatus;
  reason: FocusEndReason | null;
  review: string;
  startedAt: string;
  endedAt: string | null;
  updatedAt: string;
  revision: number;
}
export interface FocusStartRequest {
  taskId: string;
  taskRevision: number;
  minutes: number;
}
export type FocusAction = 'pause' | 'resume' | 'stop';
export interface FocusOverview {
  current: FocusSession | null;
  recent: FocusSession[];
  version: number;
}
export interface FocusHistoryQuery {
  day: string | null;
  page: number;
}
export interface FocusHistoryPage {
  day: string | null;
  page: number;
  pageSize: number;
  total: number;
  sessions: FocusSession[];
}
export interface FocusReviewResult {
  session: FocusSession;
  overview: FocusOverview;
}
export interface BackupCounts {
  sources: number;
  notes: number;
  conversations: number;
  turns: number;
  memories: number;
  projects: number;
  tasks: number;
  focusSessions: number;
  studyDays: number;
  reviews: number;
}
export interface BackupFile {
  path: string;
  bytes: number;
  sha256: string;
}
export interface BackupManifest {
  format: 1;
  application: 'StudyCompanion';
  createdAt: string;
  mainVersion: number;
  activityVersion: number;
  counts: BackupCounts;
  files: BackupFile[];
}
export interface RestorePreview {
  id: string;
  folderName: string;
  createdAt: string;
  expiresAt: string;
  mainVersion: number;
  activityVersion: number;
  counts: BackupCounts;
  bytes: number;
}
export interface RestoreReceipt {
  restoredAt: string;
  preservedDirectory: string;
}
export interface BackupState {
  revision: number;
  learningDirectory: string;
  operation: 'idle' | 'export' | 'inspect' | 'confirm' | 'commit' | 'restart';
  progress: { current: number; total: number; message: string } | null;
  preview: RestorePreview | null;
  lastExport: { directory: string; createdAt: string; counts: BackupCounts } | null;
  lastError: string | null;
  restoreReceipt: RestoreReceipt | null;
}
export interface DesktopApi {
  bootstrap(): Promise<Bootstrap>;
  saveSettings(settings: Settings): Promise<Settings>;
  storeApiKey(baseUrl: string, key: string): Promise<void>;
  removeApiKey(baseUrl: string): Promise<void>;
  hasApiKey(baseUrl: string): Promise<boolean>;
  studyOverview(year: number, month: number): Promise<StudyOverview>;
  checkIn(year: number, month: number): Promise<StudyOverview>;
  setStudyRunning(running: boolean, year: number, month: number): Promise<StudyOverview>;
  checkConnection(
    provider: Provider,
    profile: ModelProfile,
    key?: string,
  ): Promise<ConnectionReport>;
  listSources(): Promise<Source[]>;
  importExample(): Promise<Source>;
  probeGeneration(expectedProfile: string, consentEndpoint?: string): Promise<ModelProbeReport>;
  probeEmbedding(): Promise<ModelProbeReport>;
  listReviews(turnId: string | null): Promise<StudyReview[]>;
  getReview(id: string): Promise<StudyReview>;
  saveReview(input: ReviewDraft): Promise<StudyReview>;
  resolveReviewCitation(id: string, number: number): Promise<CitationTarget>;
  exportReview(id: string, revision: number): Promise<NoteExportResult>;
  importSources(): Promise<ImportReport>;
  cancelImport(): Promise<void>;
  onImportProgress(listener: (progress: ImportProgress) => void): () => void;
  openSource(id: string): Promise<OpenDocument>;
  saveReadingPosition(id: string, position: ReadingPosition): Promise<void>;
  copyCitation(id: string, anchor: string, quote: string): Promise<void>;
  readSelection(id: string, anchor: string, quote: string): Promise<ReadingSelection>;
  listConversations(): Promise<ConversationSummary[]>;
  createConversation(): Promise<Conversation>;
  getConversation(id: string): Promise<Conversation>;
  previewHistory(target: HistoryTarget): Promise<HistoryPreview>;
  renameConversation(id: string, version: string, title: string): Promise<ConversationSummary>;
  deleteHistory(target: HistoryTarget, version: string): Promise<{ cancelled: boolean }>;
  exportHistory(target: HistoryTarget, version: string): Promise<HistoryExportResult>;
  sendChat(request: ChatRequest): Promise<ChatTurn>;
  stopChat(id: string): Promise<void>;
  activeChat(): Promise<ChatTurn | null>;
  onChatUpdate(listener: (turn: ChatTurn) => void): () => void;
  prepareQuestion(question: string, sourceId: string | null): Promise<EvidencePreview>;
  prepareReadingQuestion(
    question: string,
    id: string,
    anchor: string,
    quote: string,
  ): Promise<EvidencePreview>;
  preparePractice(request: PracticeRequest): Promise<PracticePreview>;
  sendPractice(request: PracticeSendRequest): Promise<ChatTurn>;
  cancelRetrieval(): Promise<void>;
  rebuildIndex(): Promise<string>;
  onRetrievalProgress(listener: (progress: RetrievalProgress) => void): () => void;
  resolveCitation(turnId: string, number: number): Promise<CitationTarget>;
  embeddingStatus(): Promise<EmbeddingStatus>;
  downloadEmbedding(): Promise<EmbeddingStatus>;
  cancelEmbeddingDownload(): Promise<void>;
  onEmbeddingProgress(listener: (progress: RetrievalProgress) => void): () => void;
  listNotes(): Promise<NoteSummary[]>;
  getNote(id: string): Promise<StudyNote>;
  saveNote(request: NoteSaveRequest): Promise<StudyNote>;
  deleteNote(id: string, revision: number): Promise<void>;
  exportNote(id: string, revision: number): Promise<NoteExportResult>;
  setNoteDraftDirty(dirty: boolean): Promise<void>;
  onShowNotes(listener: () => void): () => void;
  listNoteFeedback(id: string): Promise<ChatTurn[]>;
  prepareNoteFeedback(id: string, revision: number, question: string): Promise<NoteFeedbackPreview>;
  sendNoteFeedback(request: NoteFeedbackRequest): Promise<ChatTurn>;
  listLearningDrafts(): Promise<ChatTurn[]>;
  prepareLearningDraft(request: LearningRequest, memoryIds?: string[]): Promise<LearningPreview>;
  sendLearningDraft(request: LearningDraftRequest): Promise<ChatTurn>;
  listMemories(): Promise<StudyMemory[]>;
  saveMemory(request: MemorySaveRequest): Promise<StudyMemory>;
  deleteMemory(id: string, revision: number): Promise<void>;
  prepareMemoryProposal(turnId: string, edit?: MemoryProposalEdit): Promise<MemoryProposal>;
  confirmMemoryProposal(id: string): Promise<StudyMemory>;
  discardMemoryProposal(id: string): Promise<void>;
  planningOverview(day: string): Promise<PlanningOverview>;
  saveStudyProject(request: ProjectSaveRequest): Promise<StudyProject>;
  saveDailyTask(request: TaskSaveRequest): Promise<DailyTask>;
  setDailyTaskCompleted(id: string, revision: number, completed: boolean): Promise<DailyTask>;
  deleteDailyTask(id: string, revision: number): Promise<void>;
  prepareTaskProposal(turnId: string, request: TaskProposalRequest): Promise<TaskProposal>;
  confirmTaskProposal(id: string): Promise<DailyTask>;
  discardTaskProposal(id: string): Promise<void>;
  prepareTaskBatch(turnId: string, request: TaskBatchRequest): Promise<TaskBatchProposal>;
  confirmTaskBatch(id: string): Promise<DailyTask[]>;
  focusOverview(): Promise<FocusOverview>;
  focusHistory(query: FocusHistoryQuery): Promise<FocusHistoryPage>;
  getFocusSession(id: string): Promise<FocusSession>;
  startFocus(request: FocusStartRequest): Promise<FocusOverview>;
  controlFocus(id: string, revision: number, action: FocusAction): Promise<FocusOverview>;
  saveFocusReview(id: string, revision: number, review: string): Promise<FocusReviewResult>;
  backupState(): Promise<BackupState>;
  exportBackup(): Promise<BackupState>;
  inspectBackup(): Promise<BackupState>;
  confirmRestore(id: string): Promise<BackupState>;
  discardRestore(id: string): Promise<BackupState>;
  cancelBackup(): Promise<void>;
  onBackupUpdate(listener: (state: BackupState) => void): () => void;
}

declare global {
  interface Window {
    studyCompanion?: DesktopApi;
  }
}

export const defaultSettings: Settings = {
  displayName: '',
  dailyGoalMinutes: 45,
  responseStyle: 'gentle',
  theme: 'modern',
  provider: 'ollama',
  ollama: { baseUrl: 'http://127.0.0.1:11434', model: '' },
  openai: { baseUrl: 'https://api.openai.com/v1', model: '' },
};
