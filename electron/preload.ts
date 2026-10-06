import { contextBridge, ipcRenderer } from 'electron';
import type {
  Bootstrap,
  ConnectionReport,
  DesktopApi,
  ModelProfile,
  Provider,
  Reply,
  Settings,
  Source,
  ImportReport,
  ImportProgress,
  OpenDocument,
  StudyOverview,
  ConversationSummary,
  HistoryPreview,
  HistoryExportResult,
  Conversation,
  ChatTurn,
  EvidencePreview,
  RetrievalProgress,
  CitationTarget,
  EmbeddingStatus,
  NoteSummary,
  StudyNote,
  NoteExportResult,
  NoteFeedbackPreview,
  LearningPreview,
  StudyMemory,
  MemoryProposal,
  PlanningOverview,
  StudyProject,
  DailyTask,
  TaskProposal,
  FocusOverview,
  FocusSession,
  FocusReviewResult,
  BackupState,
} from '../src/lib/types';

async function call<T>(channel: string, ...args: unknown[]): Promise<T> {
  const reply = (await ipcRenderer.invoke(channel, ...args)) as Reply<T>;
  if (!reply.ok) throw reply.error;
  return reply.value;
}

const api: DesktopApi = {
  bootstrap: () => call<Bootstrap>('study:bootstrap'),
  saveSettings: (settings: Settings) => call<Settings>('study:save-settings', settings),
  storeApiKey: (baseUrl: string, key: string) => call<void>('study:store-key', baseUrl, key),
  removeApiKey: (baseUrl: string) => call<void>('study:remove-key', baseUrl),
  hasApiKey: (baseUrl: string) => call<boolean>('study:has-key', baseUrl),
  studyOverview: (year, month) => call<StudyOverview>('study:overview', year, month),
  checkIn: (year, month) => call<StudyOverview>('study:check-in', year, month),
  setStudyRunning: (running, year, month) =>
    call<StudyOverview>('study:set-running', running, year, month),
  checkConnection: (provider: Provider, profile: ModelProfile, key?: string) =>
    call<ConnectionReport>('study:check-connection', provider, profile, key),
  listSources: () => call<Source[]>('study:list-sources'),
  importSources: () => call<ImportReport>('study:import-sources'),
  cancelImport: () => call<void>('study:cancel-import'),
  onImportProgress: (listener) => {
    const receive = (_event: Electron.IpcRendererEvent, progress: ImportProgress) =>
      listener(progress);
    ipcRenderer.on('study:import-progress', receive);
    return () => {
      ipcRenderer.removeListener('study:import-progress', receive);
    };
  },
  openSource: (id) => call<OpenDocument>('study:open-source', id),
  saveReadingPosition: (id, position) => call<void>('study:save-reading-position', id, position),
  copyCitation: (id, anchor, quote) => call<void>('study:copy-citation', id, anchor, quote),
  listConversations: () => call<ConversationSummary[]>('study:list-conversations'),
  createConversation: () => call<Conversation>('study:create-conversation'),
  getConversation: (id) => call<Conversation>('study:get-conversation', id),
  previewHistory: (target) => call<HistoryPreview>('study:preview-history', target),
  renameConversation: (id, version, title) =>
    call<ConversationSummary>('study:rename-conversation', id, version, title),
  deleteHistory: (target, version) =>
    call<{ cancelled: boolean }>('study:delete-history', target, version),
  exportHistory: (target, version) =>
    call<HistoryExportResult>('study:export-history', target, version),
  sendChat: (request) => call<ChatTurn>('study:send-chat', request),
  stopChat: (id) => call<void>('study:stop-chat', id),
  activeChat: () => call<ChatTurn | null>('study:active-chat'),
  onChatUpdate: (listener) => {
    const receive = (_event: Electron.IpcRendererEvent, turn: ChatTurn) => listener(turn);
    ipcRenderer.on('study:chat-update', receive);
    return () => ipcRenderer.removeListener('study:chat-update', receive);
  },
  prepareQuestion: (question, sourceId) =>
    call<EvidencePreview>('study:prepare-question', question, sourceId),
  cancelRetrieval: () => call<void>('study:cancel-retrieval'),
  rebuildIndex: () => call<string>('study:rebuild-index'),
  onRetrievalProgress: (listener) => {
    const receive = (_event: Electron.IpcRendererEvent, progress: RetrievalProgress) =>
      listener(progress);
    ipcRenderer.on('study:retrieval-progress', receive);
    return () => ipcRenderer.removeListener('study:retrieval-progress', receive);
  },
  resolveCitation: (turnId, number) =>
    call<CitationTarget>('study:resolve-citation', turnId, number),
  embeddingStatus: () => call<EmbeddingStatus>('study:embedding-status'),
  downloadEmbedding: () => call<EmbeddingStatus>('study:download-embedding'),
  cancelEmbeddingDownload: () => call<void>('study:cancel-embedding-download'),
  onEmbeddingProgress: (listener) => {
    const receive = (_event: Electron.IpcRendererEvent, progress: RetrievalProgress) =>
      listener(progress);
    ipcRenderer.on('study:embedding-progress', receive);
    return () => ipcRenderer.removeListener('study:embedding-progress', receive);
  },
  listNotes: () => call<NoteSummary[]>('study:list-notes'),
  getNote: (id) => call<StudyNote>('study:get-note', id),
  saveNote: (request) => call<StudyNote>('study:save-note', request),
  deleteNote: (id, revision) => call<void>('study:delete-note', id, revision),
  exportNote: (id, revision) => call<NoteExportResult>('study:export-note', id, revision),
  setNoteDraftDirty: (dirty) => call<void>('study:set-note-draft-dirty', dirty),
  onShowNotes: (listener) => {
    const receive = () => listener();
    ipcRenderer.on('study:show-notes', receive);
    return () => ipcRenderer.removeListener('study:show-notes', receive);
  },
  listNoteFeedback: (id) => call<ChatTurn[]>('study:list-note-feedback', id),
  prepareNoteFeedback: (id, revision, question) =>
    call<NoteFeedbackPreview>('study:prepare-note-feedback', id, revision, question),
  sendNoteFeedback: (request) => call<ChatTurn>('study:send-note-feedback', request),
  listLearningDrafts: () => call<ChatTurn[]>('study:list-learning-drafts'),
  prepareLearningDraft: (request, memoryIds) =>
    call<LearningPreview>('study:prepare-learning-draft', request, memoryIds),
  sendLearningDraft: (request) => call<ChatTurn>('study:send-learning-draft', request),
  listMemories: () => call<StudyMemory[]>('study:list-memories'),
  saveMemory: (request) => call<StudyMemory>('study:save-memory', request),
  deleteMemory: (id, revision) => call<void>('study:delete-memory', id, revision),
  prepareMemoryProposal: (turnId, edit) =>
    call<MemoryProposal>('study:prepare-memory-proposal', turnId, edit),
  confirmMemoryProposal: (id) => call<StudyMemory>('study:confirm-memory-proposal', id),
  discardMemoryProposal: (id) => call<void>('study:discard-memory-proposal', id),
  planningOverview: (day) => call<PlanningOverview>('study:planning-overview', day),
  saveStudyProject: (request) => call<StudyProject>('study:save-project', request),
  saveDailyTask: (request) => call<DailyTask>('study:save-task', request),
  setDailyTaskCompleted: (id, revision, completed) =>
    call<DailyTask>('study:set-task-completed', id, revision, completed),
  deleteDailyTask: (id, revision) => call<void>('study:delete-task', id, revision),
  prepareTaskProposal: (turnId, request) =>
    call<TaskProposal>('study:prepare-task-proposal', turnId, request),
  confirmTaskProposal: (id) => call<DailyTask>('study:confirm-task-proposal', id),
  discardTaskProposal: (id) => call<void>('study:discard-task-proposal', id),
  focusOverview: () => call<FocusOverview>('study:focus-overview'),
  getFocusSession: (id) => call<FocusSession>('study:get-focus-session', id),
  startFocus: (request) => call<FocusOverview>('study:start-focus', request),
  controlFocus: (id, revision, action) =>
    call<FocusOverview>('study:control-focus', id, revision, action),
  saveFocusReview: (id, revision, review) =>
    call<FocusReviewResult>('study:save-focus-review', id, revision, review),
  backupState: () => call<BackupState>('study:backup-state'),
  exportBackup: () => call<BackupState>('study:export-backup'),
  inspectBackup: () => call<BackupState>('study:inspect-backup'),
  confirmRestore: (id) => call<BackupState>('study:confirm-restore', id),
  discardRestore: (id) => call<BackupState>('study:discard-restore', id),
  cancelBackup: () => call<void>('study:cancel-backup'),
  onBackupUpdate: (listener) => {
    const receive = (_event: Electron.IpcRendererEvent, state: BackupState) => listener(state);
    ipcRenderer.on('study:backup-update', receive);
    return () => ipcRenderer.removeListener('study:backup-update', receive);
  },
};
contextBridge.exposeInMainWorld('studyCompanion', api);
