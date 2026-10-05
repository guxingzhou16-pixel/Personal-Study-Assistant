import type { DesktopApi } from './types';

export const isDesktop = typeof window !== 'undefined' && window.studyCompanion !== undefined;

function api(): DesktopApi {
  if (!window.studyCompanion) throw new Error('请在桌面应用中使用此功能。');
  return window.studyCompanion;
}
export const desktop: DesktopApi = {
  bootstrap: () => api().bootstrap(),
  saveSettings: (settings) => api().saveSettings(settings),
  storeApiKey: (baseUrl, key) => api().storeApiKey(baseUrl, key),
  removeApiKey: (baseUrl) => api().removeApiKey(baseUrl),
  hasApiKey: (baseUrl) => api().hasApiKey(baseUrl),
  studyOverview: (year, month) => api().studyOverview(year, month),
  checkIn: (year, month) => api().checkIn(year, month),
  setStudyRunning: (running, year, month) => api().setStudyRunning(running, year, month),
  checkConnection: (provider, profile, key) => api().checkConnection(provider, profile, key),
  listSources: () => api().listSources(),
  importSources: () => api().importSources(),
  cancelImport: () => api().cancelImport(),
  onImportProgress: (listener) => api().onImportProgress(listener),
  openSource: (id) => api().openSource(id),
  saveReadingPosition: (id, position) => api().saveReadingPosition(id, position),
  copyCitation: (id, anchor, quote) => api().copyCitation(id, anchor, quote),
  listConversations: () => api().listConversations(),
  createConversation: () => api().createConversation(),
  getConversation: (id) => api().getConversation(id),
  sendChat: (request) => api().sendChat(request),
  stopChat: (id) => api().stopChat(id),
  activeChat: () => api().activeChat(),
  onChatUpdate: (listener) => api().onChatUpdate(listener),
  prepareQuestion: (question, sourceId) => api().prepareQuestion(question, sourceId),
  cancelRetrieval: () => api().cancelRetrieval(),
  rebuildIndex: () => api().rebuildIndex(),
  onRetrievalProgress: (listener) => api().onRetrievalProgress(listener),
  resolveCitation: (turnId, number) => api().resolveCitation(turnId, number),
  embeddingStatus: () => api().embeddingStatus(),
  downloadEmbedding: () => api().downloadEmbedding(),
  cancelEmbeddingDownload: () => api().cancelEmbeddingDownload(),
  onEmbeddingProgress: (listener) => api().onEmbeddingProgress(listener),
  listNotes: () => api().listNotes(),
  getNote: (id) => api().getNote(id),
  saveNote: (request) => api().saveNote(request),
  deleteNote: (id, revision) => api().deleteNote(id, revision),
  exportNote: (id, revision) => api().exportNote(id, revision),
  setNoteDraftDirty: (dirty) => api().setNoteDraftDirty(dirty),
  onShowNotes: (listener) => api().onShowNotes(listener),
  listNoteFeedback: (id) => api().listNoteFeedback(id),
  prepareNoteFeedback: (id, revision, question) =>
    api().prepareNoteFeedback(id, revision, question),
  sendNoteFeedback: (request) => api().sendNoteFeedback(request),
  listLearningDrafts: () => api().listLearningDrafts(),
  prepareLearningDraft: (request, memoryIds) => api().prepareLearningDraft(request, memoryIds),
  sendLearningDraft: (request) => api().sendLearningDraft(request),
  listMemories: () => api().listMemories(),
  saveMemory: (request) => api().saveMemory(request),
  deleteMemory: (id, revision) => api().deleteMemory(id, revision),
  prepareMemoryProposal: (turnId, edit) => api().prepareMemoryProposal(turnId, edit),
  confirmMemoryProposal: (id) => api().confirmMemoryProposal(id),
  discardMemoryProposal: (id) => api().discardMemoryProposal(id),
  planningOverview: (day) => api().planningOverview(day),
  saveStudyProject: (request) => api().saveStudyProject(request),
  saveDailyTask: (request) => api().saveDailyTask(request),
  setDailyTaskCompleted: (id, revision, completed) =>
    api().setDailyTaskCompleted(id, revision, completed),
  deleteDailyTask: (id, revision) => api().deleteDailyTask(id, revision),
};

export function errorMessage(error: unknown): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return error.message;
  }
  if (typeof error === 'string' && error.trim()) return error;
  return '操作未完成，请重试。';
}

export function sameEndpoint(left: string, right: string): boolean {
  try {
    return (
      new URL(left.trim()).href.replace(/\/$/, '') === new URL(right.trim()).href.replace(/\/$/, '')
    );
  } catch {
    return false;
  }
}
