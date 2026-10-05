export type Provider = 'ollama' | 'openai';
export type ResponseStyle = 'gentle' | 'game' | 'coach';

export interface ModelProfile {
  baseUrl: string;
  model: string;
}

export interface Settings {
  displayName: string;
  dailyGoalMinutes: number;
  responseStyle: ResponseStyle;
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
export interface CitationTarget {
  sourceId: string;
  anchor: string;
  page: number;
}
export interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: string;
}
export interface Conversation extends ConversationSummary {
  turns: ChatTurn[];
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
  importSources(): Promise<ImportReport>;
  cancelImport(): Promise<void>;
  onImportProgress(listener: (progress: ImportProgress) => void): () => void;
  openSource(id: string): Promise<OpenDocument>;
  saveReadingPosition(id: string, position: ReadingPosition): Promise<void>;
  copyCitation(id: string, anchor: string, quote: string): Promise<void>;
  listConversations(): Promise<ConversationSummary[]>;
  createConversation(): Promise<Conversation>;
  getConversation(id: string): Promise<Conversation>;
  sendChat(request: ChatRequest): Promise<ChatTurn>;
  stopChat(id: string): Promise<void>;
  activeChat(): Promise<ChatTurn | null>;
  onChatUpdate(listener: (turn: ChatTurn) => void): () => void;
  prepareQuestion(question: string, sourceId: string | null): Promise<EvidencePreview>;
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
  provider: 'ollama',
  ollama: { baseUrl: 'http://127.0.0.1:11434', model: '' },
  openai: { baseUrl: 'https://api.openai.com/v1', model: '' },
};
